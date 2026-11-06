"""API tìm đường: lộ trình nhanh nhất và an toàn nhất."""
import json
import math
import urllib.request
import networkx as nx
from fastapi import APIRouter, HTTPException

from .. import config, routing
from ..graph import GraphNotReady, fetch_flood_sources, get_graph
from ..schemas import RouteRequest

router = APIRouter(tags=["Tìm đường"])


def route_via_osrm(body: RouteRequest, sources: list):
    """Fallback tìm lộ trình theo mạng lưới đường bộ OpenStreetMap (OSRM) khi điểm nằm xa graph nội đô."""
    try:
        o_lng, o_lat = body.origin.lng, body.origin.lat
        d_lng, d_lat = body.destination.lng, body.destination.lat
        url = f"https://router.project-osrm.org/route/v1/driving/{o_lng:.6f},{o_lat:.6f};{d_lng:.6f},{d_lat:.6f}?overview=full&geometries=geojson"
        req = urllib.request.Request(url, headers={"User-Agent": "FloodNav/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") == "Ok" and data.get("routes"):
                r = data["routes"][0]
                dist_m = round(r["distance"])
                speed_kmh = config.SPEED_KMH.get(body.vehicle, 25)
                speed_m_per_min = speed_kmh * 1000 / 60
                duration_min = round(dist_m / speed_m_per_min, 1)
                coords = r["geometry"]["coordinates"]

                # Quét cảnh báo ngập lụt dọc tuyến OSRM
                warnings = []
                for s in sources:
                    s_lng, s_lat = s["lng"], s["lat"]
                    s_depth = float(s.get("depth_cm", 0))
                    if s_depth >= 5.0:
                        for pt in coords[::3]:
                            d_m = math.sqrt(((pt[1] - s_lat) * 111000)**2 + ((pt[0] - s_lng) * 103000)**2)
                            if d_m <= config.FLOOD_RADIUS_M:
                                warnings.append(s.get("name") or "Điểm ngập trên tuyến")
                                break

                route_res = {
                    "found": True,
                    "mode": "safe",
                    "distance_m": dist_m,
                    "duration_min": duration_min,
                    "geometry": r["geometry"],
                    "flood_warnings": list(set(warnings))
                }
                return {
                    "vehicle": body.vehicle,
                    "ai_prediction_applied": body.use_ai_prediction,
                    "same_route": True,
                    "fastest": route_res,
                    "safe": route_res,
                    "flood_sources_used": len(sources),
                    "affected_road_segments": len(warnings),
                }
    except Exception:
        pass
    return None


@router.post("/api/route")
def find_route(body: RouteRequest):
    """
    Trả về 2 lộ trình:
      - fastest: ngắn nhất, KHÔNG quan tâm ngập (giống bản đồ thông thường)
      - safe:    tránh ngập, chặn đoạn vượt ngưỡng của loại xe, phạt đoạn ngập nhẹ
                 (kết hợp mô hình AI dự báo 30 phút nếu use_ai_prediction=True)
    """
    sources = fetch_flood_sources(use_ai_prediction=body.use_ai_prediction)

    try:
        rg = get_graph()
    except GraphNotReady as e:
        # Nếu graph chưa sẵn sàng, thử tìm đường qua OSRM trước khi báo lỗi 503
        osrm_res = route_via_osrm(body, sources)
        if osrm_res is not None:
            return osrm_res
        raise HTTPException(503, str(e))

    orig_snap = rg.snap_to_edge(body.origin.lng, body.origin.lat)
    dest_snap = rg.snap_to_edge(body.destination.lng, body.destination.lat)
    o_node = orig_snap["closer_node"]
    o_dist = orig_snap["dist_m"]
    d_dist = dest_snap["dist_m"]

    # Nếu điểm xuất phát hoặc điểm đến nằm ngoài graph nội đô (> MAX_SNAP_M)
    # Tự động chuyển tiếp sang định tuyến đường bộ mở rộng (OSRM) thay vì ném lỗi 422
    if max(o_dist, d_dist) > config.MAX_SNAP_M:
        osrm_res = route_via_osrm(body, sources)
        if osrm_res is not None:
            return osrm_res
        raise HTTPException(
            422, "Điểm đi hoặc điểm đến nằm quá xa vùng mạng lưới giao thông đường bộ có thể điều hướng. "
                 "Vui lòng chọn vị trí trong khu vực thành phố Hà Nội.")

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

    # Nếu cả hai chế độ đều không tìm được đường qua graph nội bộ, thử fallback sang OSRM
    if results.get("fastest", {}).get("found") is False and results.get("safe", {}).get("found") is False:
        osrm_fallback = route_via_osrm(body, sources)
        if osrm_fallback is not None:
            return osrm_fallback

    return {
        "vehicle": body.vehicle,
        "ai_prediction_applied": body.use_ai_prediction,
        "same_route": paths.get("fastest") == paths.get("safe"),
        "fastest": results["fastest"],
        "safe": results["safe"],
        "flood_sources_used": len(sources),
        "affected_road_segments": len(flood),
    }
