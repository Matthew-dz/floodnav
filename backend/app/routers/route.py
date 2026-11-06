"""API tìm đường: lộ trình nhanh nhất và an toàn nhất."""
import networkx as nx
from fastapi import APIRouter, HTTPException

from .. import config, routing
from ..graph import GraphNotReady, fetch_flood_sources, get_graph
from ..schemas import RouteRequest

router = APIRouter(tags=["Tìm đường"])


@router.post("/api/route")
def find_route(body: RouteRequest):
    """
    Trả về 2 lộ trình:
      - fastest: ngắn nhất, KHÔNG quan tâm ngập (giống bản đồ thông thường)
      - safe:    tránh ngập, chặn đoạn vượt ngưỡng của loại xe, phạt đoạn ngập nhẹ
                 (kết hợp mô hình AI dự báo 30 phút nếu use_ai_prediction=True)
    """
    try:
        rg = get_graph()
    except GraphNotReady as e:
        raise HTTPException(503, str(e))

    orig_snap = rg.snap_to_edge(body.origin.lng, body.origin.lat)
    dest_snap = rg.snap_to_edge(body.destination.lng, body.destination.lat)
    o_node = orig_snap["closer_node"]
    o_dist = orig_snap["dist_m"]
    d_dist = dest_snap["dist_m"]

    if max(o_dist, d_dist) > config.MAX_SNAP_M:
        raise HTTPException(
            422, "Điểm đi hoặc điểm đến nằm quá xa vùng mạng lưới giao thông Hà Nội (> 50 km). "
                 "Vui lòng chọn vị trí trong khu vực thành phố Hà Nội.")

    sources = fetch_flood_sources(use_ai_prediction=body.use_ai_prediction)
    flood = rg.flood_edges(sources)

    results, paths = {}, {}
    speed_m_per_min = config.SPEED_KMH[body.vehicle] * 1000 / 60
    for mode in ("fastest", "safe"):
        best_path = None
        best_d_node = None
        # Thử tìm đường tới cả hai đầu mút u và v của đoạn đường/ngõ tiếp cận điểm đích
        for d_cand in (dest_snap["u"], dest_snap["v"]):
            try:
                p = routing.find_path(rg.G, flood, o_node, d_cand, body.vehicle, mode)
                if best_path is None or len(p) < len(best_path):
                    best_path = p
                    best_d_node = d_cand
            except nx.NetworkXNoPath:
                pass

        if best_path is None:
            results[mode] = {"found": False, "mode": mode,
                             "reason": "Không còn đường đi an toàn cho loại xe này."}
            continue

        res = routing.describe_route(rg.G, flood, best_path, body.vehicle, mode)
        coords = res["geometry"]["coordinates"]

        # Nếu điểm đến gần đường (<= 300m), dẫn tiếp sâu vào ngõ/đoạn tiếp cận đến điểm chiếu
        if d_dist <= 300 and best_d_node in (dest_snap["u"], dest_snap["v"]):
            u, v, k = dest_snap["u"], dest_snap["v"], dest_snap["key"]
            full_c = routing.edge_coords(rg.G, u, v, rg.G[u][v][k])
            proj = dest_snap["proj_pt"]
            if best_d_node == u:
                alley_seg = routing.slice_coords_to_proj(full_c, proj, from_start=True)
            else:
                alley_seg = routing.slice_coords_to_proj(full_c[::-1], proj, from_start=True)
            if alley_seg:
                if coords and coords[-1] == alley_seg[0]:
                    coords.extend(alley_seg[1:])
                else:
                    coords.extend(alley_seg)

        # Chạm đúng điểm xuất phát và điểm đích khi trong phạm vi tiếp cận hợp lý (<= 300m)
        orig_pt = [round(body.origin.lng, 6), round(body.origin.lat, 6)]
        dest_pt = [round(body.destination.lng, 6), round(body.destination.lat, 6)]
        if o_dist <= 300 and coords and coords[0] != orig_pt:
            coords.insert(0, orig_pt)
        if d_dist <= 300 and coords and coords[-1] != dest_pt:
            coords.append(dest_pt)

        # Cập nhật tổng cự ly và thời gian di chuyển
        total_dist = round(res["distance_m"] + (o_dist if o_dist <= 300 else 0) + (d_dist if d_dist <= 300 else 0))
        res["distance_m"] = total_dist
        res["duration_min"] = round(total_dist / speed_m_per_min, 1)

        results[mode] = res
        paths[mode] = best_path

    return {
        "vehicle": body.vehicle,
        "ai_prediction_applied": body.use_ai_prediction,
        "same_route": paths.get("fastest") == paths.get("safe"),
        "fastest": results["fastest"],
        "safe": results["safe"],
        "flood_sources_used": len(sources),
        "affected_road_segments": len(flood),
    }
