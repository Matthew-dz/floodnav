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
            422,
            f"Điểm xuất phát hoặc điểm đến nằm ngoài phạm vi mạng lưới đường bộ của bản đồ (> {config.MAX_SNAP_M}m). "
            "Vui lòng chọn vị trí trong khu vực có dữ liệu giao thông."
        )

    sources = fetch_flood_sources(use_ai_prediction=body.use_ai_prediction)
    flood = rg.flood_edges(sources)

    results, paths = {}, {}
    for mode in ("fastest", "safe"):
        try:
            path = routing.find_path(rg.G, flood, o_node, d_node, body.vehicle, mode)
            res = routing.describe_route(rg.G, flood, path, body.vehicle, mode)
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
