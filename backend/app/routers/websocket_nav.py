"""
Kênh kết nối WebSocket phục vụ dẫn đường thời gian thực và tự động Re-Routing.
Phụ trách chính: Thành viên 2 (Senior Backend)
Giao thức: WebSocket (W3C Standard, Open Source, hai chiều độ trễ cực thấp)

Tính năng chính:
1. Lưu phiên điều hướng (NavSession) theo từng session_id: toạ độ GPS, điểm đến, phương tiện, lộ trình.
2. Theo dõi vị trí GPS của phương tiện theo thời gian thực (update_location).
3. Kiểm tra các đoạn đường phía trước trên tuyến đường thực tế (trigger_reroute_check).
4. Tự động kích hoạt thuật toán A* né ngập để tìm lộ trình an toàn mới khi phát hiện nguy hiểm.
"""
import json
import logging
from typing import Dict, List, Optional
import networkx as nx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import config, routing
from ..graph import get_graph, fetch_flood_sources, GraphNotReady

router = APIRouter(tags=["WebSocket Dẫn Đường"])
log = logging.getLogger("floodnav.websocket")


def normalize_vehicle(v: Optional[str]) -> str:
    """Chuẩn hóa tên phương tiện về dạng mà module routing hỗ trợ ('motorbike' hoặc 'car')."""
    if not v:
        return "motorbike"
    v = str(v).lower().strip()
    if v in ("car", "oto", "ô tô", "oto con"):
        return "car"
    return "motorbike"


class NavSession:
    """Lưu trữ trạng thái và lộ trình dẫn đường cho một phiên kết nối."""
    def __init__(self, session_id: str):
        self.session_id: str = session_id
        self.current_lat: Optional[float] = None
        self.current_lng: Optional[float] = None
        self.dest_lat: Optional[float] = None
        self.dest_lng: Optional[float] = None
        self.origin_lat: Optional[float] = None
        self.origin_lng: Optional[float] = None
        self.vehicle: str = "motorbike"
        self.use_ai_prediction: bool = True
        self.current_path: List[int] = []  # Danh sách node ID trên đồ thị giao thông
        self.current_route_data: Optional[dict] = None
        self.last_hazard: Optional[dict] = None

    def update_location(self, lat: float, lng: float):
        self.current_lat = lat
        self.current_lng = lng

    def set_route(
        self,
        origin_lat: Optional[float],
        origin_lng: Optional[float],
        dest_lat: Optional[float],
        dest_lng: Optional[float],
        vehicle: str = "motorbike",
        use_ai_prediction: bool = True,
        path_nodes: Optional[List[int]] = None,
        route_data: Optional[dict] = None,
    ):
        self.origin_lat = origin_lat
        self.origin_lng = origin_lng
        self.dest_lat = dest_lat
        self.dest_lng = dest_lng
        self.vehicle = normalize_vehicle(vehicle)
        self.use_ai_prediction = use_ai_prediction
        if path_nodes:
            self.current_path = path_nodes
        if route_data:
            self.current_route_data = route_data


class ConnectionManager:
    """Quản lý các kết nối WebSocket và phiên dẫn đường tương ứng."""
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.sessions: Dict[str, NavSession] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> NavSession:
        await websocket.accept()
        self.active_connections[session_id] = websocket
        if session_id not in self.sessions:
            self.sessions[session_id] = NavSession(session_id)
        log.info(f"Client đã kết nối WebSocket: session={session_id}")
        return self.sessions[session_id]

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            log.info(f"Client đã ngắt kết nối WebSocket: session={session_id}")

    def get_session(self, session_id: str) -> NavSession:
        if session_id not in self.sessions:
            self.sessions[session_id] = NavSession(session_id)
        return self.sessions[session_id]

    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)

    async def broadcast(self, message: dict):
        """Phát thông báo tới toàn bộ các xe đang lưu thông trên hệ thống."""
        for session_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_json(message)
            except Exception as e:
                log.warning(f"Lỗi gửi broadcast tới {session_id}: {e}")


manager = ConnectionManager()


def check_route_and_reroute(session: NavSession) -> dict:
    """
    Kiểm tra tình trạng ngập trên các đoạn đường phía trước của xe.
    Nếu phát hiện đoạn ngập vượt ngưỡng an toàn của phương tiện:
    -> Tự động gọi lại giải thuật A* (routing.find_path với mode="safe") để tìm lộ trình né ngập.
    """
    # Nếu chưa có thông tin điểm đến, giữ tương thích với phản hồi mặc định
    if session.dest_lat is None or session.dest_lng is None:
        return {
            "type": "route_status",
            "status": "clear",
            "message": "Lộ trình phía trước vẫn an toàn."
        }

    try:
        rg = get_graph()
    except GraphNotReady as e:
        return {
            "type": "route_status",
            "status": "error",
            "message": f"Dữ liệu đồ thị bản đồ chưa sẵn sàng: {e}"
        }

    curr_lat = session.current_lat if session.current_lat is not None else session.origin_lat
    curr_lng = session.current_lng if session.current_lng is not None else session.origin_lng

    if curr_lat is None or curr_lng is None:
        return {
            "type": "route_status",
            "status": "clear",
            "message": "Lộ trình phía trước vẫn an toàn."
        }

    # 1. Định vị các nút giao gần nhất trên đồ thị
    o_node, o_dist = rg.nearest_node(curr_lng, curr_lat)
    d_node, d_dist = rg.nearest_node(session.dest_lng, session.dest_lat)

    if max(o_dist, d_dist) > config.MAX_SNAP_M:
        return {
            "type": "route_status",
            "status": "error",
            "message": f"Vị trí xe hoặc điểm đến nằm ngoài phạm vi mạng lưới đường bộ (> {config.MAX_SNAP_M}m)."
        }

    if o_node == d_node:
        return {
            "type": "route_status",
            "status": "arrived",
            "message": "Phương tiện đã đến gần điểm đến."
        }

    # 2. Lấy dữ liệu nguồn ngập mới nhất từ DB & AI dự báo
    sources = fetch_flood_sources(use_ai_prediction=session.use_ai_prediction)
    flood_map = rg.flood_edges(sources)

    # 3. Xác định các đoạn đường phía trước cần kiểm tra
    path_to_check: List[int] = []
    if session.current_path and len(session.current_path) >= 2:
        try:
            if o_node in session.current_path:
                idx = session.current_path.index(o_node)
                path_to_check = session.current_path[idx:]
            else:
                # Tìm node trong current_path gần vị trí xe nhất
                best_idx = 0
                min_d = float("inf")
                for i, node_id in enumerate(session.current_path):
                    if node_id in rg.G:
                        node_data = rg.G.nodes[node_id]
                        d = (node_data["x"] - curr_lng) ** 2 + (node_data["y"] - curr_lat) ** 2
                        if d < min_d:
                            min_d = d
                            best_idx = i
                path_to_check = session.current_path[best_idx:]
        except Exception:
            path_to_check = []

    # Nếu chưa có lộ trình được lưu, tìm lộ trình nhanh nhất từ hiện tại đến đích để kiểm tra nguy cơ ngập
    if len(path_to_check) < 2:
        try:
            path_to_check = routing.find_path(rg.G, flood_map, o_node, d_node, session.vehicle, "fastest")
            session.current_path = path_to_check
        except Exception:
            path_to_check = []

    # 4. Quét từng đoạn đường phía trước để phát hiện điểm ngập vượt ngưỡng
    hazard = None
    if len(path_to_check) >= 2:
        for u, v in zip(path_to_check[:-1], path_to_check[1:]):
            if not rg.G.has_edge(u, v):
                continue
            for k, data in rg.G[u][v].items():
                fl = flood_map.get((u, v, k))
                if fl:
                    limit = routing.vehicle_limit(session.vehicle, fl["threshold_cm"])
                    if fl["depth_cm"] >= limit:
                        hazard = {
                            "name": fl["name"],
                            "depth_cm": fl["depth_cm"],
                            "limit_cm": round(limit, 1),
                            "threshold_cm": fl["threshold_cm"],
                            "kind": fl.get("kind", "sensor"),
                            "street": routing._street_name(data) or fl["name"],
                            "edge": [u, v]
                        }
                        break
            if hazard:
                break

    # 5. Nếu không có đoạn đường nào bị ngập nguy hiểm
    if not hazard:
        return {
            "type": "route_status",
            "status": "clear",
            "message": "Lộ trình phía trước vẫn an toàn.",
            "remaining_nodes": len(path_to_check),
            "current_location": {"lat": curr_lat, "lng": curr_lng}
        }

    # 6. PHÁT HIỆN NGUY HIỂM: Tự động kích hoạt thuật toán A* tìm lộ trình né ngập
    log.warning(
        f"[Re-Route WebSocket] Session {session.session_id}: Phát hiện ngập tại {hazard['name']} "
        f"({hazard['depth_cm']}cm >= ngưỡng {hazard['limit_cm']}cm). Kích hoạt A* né ngập..."
    )

    try:
        new_path = routing.find_path(rg.G, flood_map, o_node, d_node, session.vehicle, "safe")
        new_route_desc = routing.describe_route(rg.G, flood_map, new_path, session.vehicle, "safe")

        # Cập nhật lộ trình an toàn mới vào session
        session.current_path = new_path
        session.current_route_data = new_route_desc
        session.last_hazard = hazard

        return {
            "type": "reroute_required",
            "status": "rerouted",
            "hazard": hazard,
            "message": (
                f"Cảnh báo: Tuyến đường phía trước tại {hazard['street']} ({hazard['name']}) "
                f"đang ngập sâu {hazard['depth_cm']} cm (vượt ngưỡng an toàn {hazard['limit_cm']} cm). "
                f"Hệ thống đã tự động kích hoạt thuật toán A* tìm lộ trình né ngập mới!"
            ),
            "new_route": new_route_desc
        }
    except nx.NetworkXNoPath:
        return {
            "type": "route_status",
            "status": "blocked",
            "hazard": hazard,
            "message": (
                f"Cảnh báo nguy hiểm: Tuyến đường phía trước tại {hazard['name']} "
                f"ngập sâu {hazard['depth_cm']} cm và mọi hướng đi vòng đều bị ngập chặn đối với loại xe này."
            )
        }


@router.websocket("/ws/navigation/{session_id}")
async def navigation_websocket(websocket: WebSocket, session_id: str):
    """
    Endpoint WebSocket dành cho phiên dẫn đường của tài xế.
    Nhận:
      - init_route: Khởi tạo thông tin lộ trình và điểm đến của phiên.
      - update_location: Toạ độ GPS vị trí xe đang chạy.
      - trigger_reroute_check: Yêu cầu kiểm tra các đoạn đường phía trước và tự động kích hoạt A* né ngập.
    Đẩy:
      - reroute_required: Lộ trình cập nhật ngay khi phía trước phát sinh điểm ngập nguy hiểm.
      - route_status: Trạng thái lộ trình hiện tại (an toàn / bị chặn).
    """
    session = await manager.connect(session_id, websocket)
    try:
        # Gửi thông điệp chào mừng và xác nhận kết nối
        await websocket.send_json({
            "type": "connection_established",
            "session_id": session_id,
            "message": "Đã kết nối luồng dữ liệu giao thông thời gian thực FloodNav."
        })

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                msg_type = msg.get("type")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type in ("init_route", "start_navigation", "set_route"):
                    # Khởi tạo lộ trình cho phiên dẫn đường
                    dest = msg.get("destination", {})
                    orig = msg.get("origin", {})
                    dest_lat = msg.get("dest_lat") or dest.get("lat")
                    dest_lng = msg.get("dest_lng") or dest.get("lng")
                    orig_lat = msg.get("orig_lat") or orig.get("lat") or msg.get("lat")
                    orig_lng = msg.get("orig_lng") or orig.get("lng") or msg.get("lng")
                    vehicle = normalize_vehicle(msg.get("vehicle", session.vehicle))
                    use_ai = bool(msg.get("use_ai_prediction", True))
                    path_nodes = msg.get("path_nodes") or msg.get("path")
                    route_data = msg.get("route_data") or msg.get("route")

                    session.set_route(
                        origin_lat=float(orig_lat) if orig_lat is not None else None,
                        origin_lng=float(orig_lng) if orig_lng is not None else None,
                        dest_lat=float(dest_lat) if dest_lat is not None else None,
                        dest_lng=float(dest_lng) if dest_lng is not None else None,
                        vehicle=vehicle,
                        use_ai_prediction=use_ai,
                        path_nodes=path_nodes,
                        route_data=route_data,
                    )
                    if orig_lat is not None and orig_lng is not None:
                        session.update_location(float(orig_lat), float(orig_lng))

                    await websocket.send_json({
                        "type": "navigation_initialized",
                        "session_id": session_id,
                        "status": "active",
                        "vehicle": session.vehicle,
                        "origin": {"lat": session.origin_lat, "lng": session.origin_lng},
                        "destination": {"lat": session.dest_lat, "lng": session.dest_lng}
                    })

                elif msg_type == "update_location":
                    # Nhận vị trí GPS xe gửi lên và cập nhật vào phiên
                    lat = msg.get("lat")
                    lng = msg.get("lng")
                    if lat is not None and lng is not None:
                        session.update_location(float(lat), float(lng))

                    if "destination" in msg or "dest_lat" in msg:
                        dest = msg.get("destination", {})
                        session.dest_lat = float(msg.get("dest_lat") or dest.get("lat"))
                        session.dest_lng = float(msg.get("dest_lng") or dest.get("lng"))
                    if "vehicle" in msg:
                        session.vehicle = normalize_vehicle(msg["vehicle"])
                    if "path_nodes" in msg:
                        session.current_path = msg["path_nodes"]

                    await websocket.send_json({
                        "type": "location_ack",
                        "lat": lat,
                        "lng": lng,
                        "status": "tracking",
                        "has_destination": session.dest_lat is not None
                    })

                elif msg_type == "trigger_reroute_check":
                    # Yêu cầu kiểm tra tái định tuyến
                    # Cập nhật GPS hoặc điểm đến nếu client truyền trực tiếp trong payload
                    if "lat" in msg and "lng" in msg and msg["lat"] is not None and msg["lng"] is not None:
                        session.update_location(float(msg["lat"]), float(msg["lng"]))
                    if "destination" in msg or "dest_lat" in msg:
                        dest = msg.get("destination", {})
                        session.dest_lat = float(msg.get("dest_lat") or dest.get("lat"))
                        session.dest_lng = float(msg.get("dest_lng") or dest.get("lng"))
                    if "origin" in msg or "orig_lat" in msg:
                        orig = msg.get("origin", {})
                        session.origin_lat = float(msg.get("orig_lat") or orig.get("lat"))
                        session.origin_lng = float(msg.get("orig_lng") or orig.get("lng"))
                    if "vehicle" in msg:
                        session.vehicle = normalize_vehicle(msg["vehicle"])
                    if "path_nodes" in msg:
                        session.current_path = msg["path_nodes"]
                    if "use_ai_prediction" in msg:
                        session.use_ai_prediction = bool(msg["use_ai_prediction"])

                    # Kiểm tra tình trạng ngập trên tuyến đường thực tế và tự động gọi A* nếu phát hiện nguy hiểm
                    result = check_route_and_reroute(session)
                    await websocket.send_json(result)

                elif msg_type in ("get_status", "get_session"):
                    await websocket.send_json({
                        "type": "session_status",
                        "session_id": session_id,
                        "current_location": {"lat": session.current_lat, "lng": session.current_lng},
                        "destination": {"lat": session.dest_lat, "lng": session.dest_lng},
                        "vehicle": session.vehicle,
                        "has_route": bool(session.current_path)
                    })

            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(session_id)
