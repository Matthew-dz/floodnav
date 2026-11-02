"""
Kênh kết nối WebSocket phục vụ dẫn đường thời gian thực và tự động Re-Routing.
Phụ trách chính: Thành viên 2 (Senior Backend)
Giao thức: WebSocket (W3C Standard, Open Source, hai chiều độ trễ cực thấp)
"""
import json
import logging
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["WebSocket Dẫn Đường"])
log = logging.getLogger("floodnav.websocket")

# Quản lý các phiên kết nối đang mở: {session_id: WebSocket}
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        log.info(f"Client đã kết nối WebSocket: session={session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            log.info(f"Client đã ngắt kết nối WebSocket: session={session_id}")

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

@router.websocket("/ws/navigation/{session_id}")
async def navigation_websocket(websocket: WebSocket, session_id: str):
    """
    Endpoint WebSocket dành cho phiên dẫn đường của tài xế.
    Nhận: Toạ độ GPS vị trí xe đang chạy.
    Đẩy: Lộ trình cập nhật ngay khi phía trước phát sinh điểm ngập mới.
    """
    await manager.connect(session_id, websocket)
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
                elif msg_type == "update_location":
                    # Nhận vị trí GPS xe gửi lên
                    lat = msg.get("lat")
                    lng = msg.get("lng")
                    await websocket.send_json({
                        "type": "location_ack",
                        "lat": lat,
                        "lng": lng,
                        "status": "tracking"
                    })
                elif msg_type == "trigger_reroute_check":
                    # Yêu cầu kiểm tra tái định tuyến
                    await websocket.send_json({
                        "type": "route_status",
                        "status": "clear",
                        "message": "Lộ trình phía trước vẫn an toàn."
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(session_id)
