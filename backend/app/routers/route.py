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

    o_node, o_dist = rg.nearest_node(body.origin.lng, body.origin.lat)
    d_node, d_dist = rg.nearest_node(body.destination.lng, body.destination.lat)
    if max(o_dist, d_dist) > config.MAX_SNAP_M:
        raise HTTPException(
            422, "Điểm đi hoặc điểm đến nằm quá xa vùng mạng lưới giao thông Hà Nội (> 50 km). "
                 "Vui lòng chọn vị trí trong khu vực thành phố Hà Nội.")

    sources = fetch_flood_sources(use_ai_prediction=body.use_ai_prediction)
    flood = rg.flood_edges(sources)

    results, paths = {}, {}
    speed_m_per_min = config.SPEED_KMH[body.vehicle] * 1000 / 60
    for mode in ("fastest", "safe"):
        try:
            path = routing.find_path(rg.G, flood, o_node, d_node, body.vehicle, mode)
            res = routing.describe_route(rg.G, flood, path, body.vehicle, mode)
            # Nối điểm xuất phát và điểm đích thực tế của người dùng vào hình học lộ trình
            if res.get("found") and res.get("geometry", {}).get("coordinates"):
                coords = res["geometry"]["coordinates"]
                orig_pt = [round(body.origin.lng, 6), round(body.origin.lat, 6)]
                dest_pt = [round(body.destination.lng, 6), round(body.destination.lat, 6)]
                if coords and coords[0] != orig_pt:
                    coords.insert(0, orig_pt)
                if coords and coords[-1] != dest_pt:
                    coords.append(dest_pt)
                total_dist = round(res["distance_m"] + o_dist + d_dist)
                res["distance_m"] = total_dist
                res["duration_min"] = round(total_dist / speed_m_per_min, 1)
            results[mode] = res
            paths[mode] = path
        except nx.NetworkXNoPath:
            results[mode] = {"found": False, "mode": mode,
                             "reason": "Không còn đường đi an toàn cho loại xe này."}

    return {
        "vehicle": body.vehicle,
        "ai_prediction_applied": body.use_ai_prediction,
        "same_route": paths.get("fastest") == paths.get("safe"),
        "fastest": results["fastest"],
        "safe": results["safe"],
        "flood_sources_used": len(sources),
        "affected_road_segments": len(flood),
    }
