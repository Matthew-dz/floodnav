"""
Tìm đường thông minh: A* với trọng số an toàn ngập nước.

cost(đoạn) = chiều dài × (1 + α · penalty)
    penalty = 0                       nếu độ sâu < 5 cm
            = (d - 5) / (ngưỡng - 5)  nếu 5 cm ≤ d < ngưỡng của xe
            = chặn (None)             nếu d ≥ ngưỡng của xe
"""
import math
from typing import Optional

import networkx as nx

from . import config


# ---------------------------------------------------------------- trọng số
def vehicle_limit(vehicle: str, threshold_cm: float) -> float:
    return threshold_cm * (config.CAR_LIMIT_FACTOR if vehicle == "car" else 1.0)


def flood_penalty(depth_cm: float, limit_cm: float) -> Optional[float]:
    """None = đường bị chặn. Ngược lại trả về hệ số phạt từ 0 đến <1."""
    if depth_cm >= limit_cm:
        return None
    if depth_cm < config.PENALTY_START_CM:
        return 0.0
    return (depth_cm - config.PENALTY_START_CM) / (limit_cm - config.PENALTY_START_CM)


def edge_cost(length: float, flood: Optional[dict], vehicle: str, mode: str) -> Optional[float]:
    """Chi phí 1 đoạn đường. None nghĩa là không đi được."""
    if mode == "fastest" or flood is None:
        return length
    pen = flood_penalty(flood["depth_cm"], vehicle_limit(vehicle, flood["threshold_cm"]))
    if pen is None:
        return None
    return length * (1 + config.PENALTY_ALPHA * pen)


def best_edge(G, flood_map: dict, u, v, vehicle: str, mode: str):
    """Trong các đoạn song song u->v, chọn đoạn có chi phí phù hợp nhất với A*.
    Nếu có nhiều đoạn cùng chi phí nhỏ nhất, ưu tiên đoạn có thuộc tính hình học (geometry) chi tiết.
    Trả về (key, cost).
    """
    best_k, best_c = None, None
    best_has_geom = False
    for k, data in G[u][v].items():
        c = edge_cost(data.get("length", 0.0), flood_map.get((u, v, k)), vehicle, mode)
        if c is None:
            continue
        has_geom = ("geometry" in data and data["geometry"] is not None)
        if best_c is None or c < best_c:
            best_k, best_c, best_has_geom = k, c, has_geom
        elif math.isclose(c, best_c, rel_tol=1e-7, abs_tol=1e-7):
            if not best_has_geom and has_geom:
                best_k, best_c, best_has_geom = k, c, True

    if best_k is None and G[u][v]:
        best_k = min(G[u][v].keys(), key=lambda k: G[u][v][k].get("length", float("inf")))
        best_c = G[u][v][best_k].get("length", 0.0)

    return best_k, best_c


# ---------------------------------------------------------------- A*
def _heuristic(G):
    def h(a, b):
        ya, xa = G.nodes[a]["y"], G.nodes[a]["x"]
        yb, xb = G.nodes[b]["y"], G.nodes[b]["x"]
        k = math.cos(math.radians((ya + yb) / 2))
        return math.hypot((xa - xb) * k, ya - yb) * 111_320   # mét, luôn <= chi phí thật
    return h


def find_path(G, flood_map: dict, origin, dest, vehicle: str, mode: str) -> list:
    """A* giữa 2 nút. Raise nx.NetworkXNoPath nếu mọi đường đều bị chặn."""
    def weight(u, v, key_dict):
        best = None
        for k, data in key_dict.items():
            c = edge_cost(data.get("length", 0.0), flood_map.get((u, v, k)), vehicle, mode)
            if c is not None and (best is None or c < best):
                best = c
        return best          # None = ẩn đoạn đường này khỏi đồ thị

    return nx.astar_path(G, origin, dest, heuristic=_heuristic(G), weight=weight)


# ---------------------------------------------------------------- mô tả lộ trình
def edge_coords(G, u, v, data) -> list:
    """Danh sách toạ độ [lng, lat] của một đoạn đường, theo đúng chiều di chuyển u -> v.
    Bảo toàn toàn bộ các điểm uốn cong trung gian của LineString và chuẩn hóa điểm đầu/cuối
    trùng khớp hoàn toàn với hai nút giao u và v.
    """
    ux, uy = G.nodes[u]["x"], G.nodes[u]["y"]
    vx, vy = G.nodes[v]["x"], G.nodes[v]["y"]
    geom = data.get("geometry")
    if geom is None:
        return [[ux, uy], [vx, vy]]

    pts = [[float(x), float(y)] for x, y in geom.coords]
    if len(pts) < 2:
        return [[ux, uy], [vx, vy]]

    # Kiểm tra chiều lưu trữ của LineString so với hướng di chuyển u -> v
    d_first = (pts[0][0] - ux) ** 2 + (pts[0][1] - uy) ** 2
    d_last = (pts[-1][0] - ux) ** 2 + (pts[-1][1] - uy) ** 2
    if d_first > d_last:
        pts = pts[::-1]

    # Chuẩn hoá điểm đầu là node u và điểm cuối là node v để hai cạnh liên tiếp nối khít 100%
    pts[0] = [ux, uy]
    pts[-1] = [vx, vy]
    return pts


def _street_name(data) -> Optional[str]:
    name = data.get("name")
    if isinstance(name, list):
        name = name[0] if name else None
    return name


def describe_route(G, flood_map: dict, path: list, vehicle: str, mode: str) -> dict:
    speed_m_per_min = config.SPEED_KMH[vehicle] * 1000 / 60
    if not path:
        return {
            "found": False,
            "mode": mode,
            "reason": "Không tìm thấy đường đi.",
            "distance_m": 0,
            "duration_min": 0.0,
            "cost": 0,
            "passable": True,
            "flood_warnings": [],
            "geometry": {"type": "LineString", "coordinates": []},
        }

    if len(path) == 1:
        single_pt = [round(G.nodes[path[0]]["x"], 6), round(G.nodes[path[0]]["y"], 6)]
        return {
            "found": True,
            "mode": mode,
            "distance_m": 0,
            "duration_min": 0.0,
            "cost": 0,
            "passable": True,
            "flood_warnings": [],
            "geometry": {"type": "LineString", "coordinates": [single_pt]},
        }

    coords, length, cost = [], 0.0, 0.0
    warnings = {}
    passable = True

    for u, v in zip(path[:-1], path[1:]):
        k, c = best_edge(G, flood_map, u, v, vehicle, mode)
        data = G[u][v][k]
        length += data.get("length", 0.0)
        cost += c if c is not None else data.get("length", 0.0)
        seg = edge_coords(G, u, v, data)
        if not coords:
            coords.extend(seg)
        else:
            # Hai cạnh liên tiếp luôn tiếp giáp tại node u: coords[-1] == seg[0] == [ux, uy]
            # Nối tiếp seg[1:] để duy trì mảng toạ độ liên tục, không trùng lặp và không đứt đoạn
            coords.extend(seg[1:])

        fl = flood_map.get((u, v, k))
        if fl:
            limit = vehicle_limit(vehicle, fl["threshold_cm"])
            blocked = fl["depth_cm"] >= limit
            passable = passable and not blocked
            wid = (fl["kind"], fl["source_id"])
            w = warnings.setdefault(wid, {
                "source": fl["name"], "kind": fl["kind"], "depth_cm": fl["depth_cm"],
                "limit_cm": round(limit, 1), "blocked": blocked, "street": _street_name(data),
            })
            w["street"] = w["street"] or _street_name(data)

    return {
        "found": True,
        "mode": mode,
        "distance_m": round(length),
        "duration_min": round(length / speed_m_per_min, 1),
        "cost": round(cost),
        "passable": passable,       # false = lộ trình này vẫn đi xuyên đoạn bị chặn (chỉ xảy ra ở 'fastest')
        "flood_warnings": list(warnings.values()),
        "geometry": {"type": "LineString", "coordinates": [[round(x, 6), round(y, 6)] for x, y in coords]},
    }


def slice_coords_to_proj(coords_list: list, proj_coord: list, from_start: bool = True) -> list:
    """Cắt danh sách toạ độ cạnh từ đầu danh sách tới điểm chiếu proj_coord (hoặc ngược lại)."""
    if not coords_list:
        return [proj_coord]
    min_d, min_idx = float("inf"), 0
    px, py = proj_coord[0], proj_coord[1]
    for idx, c in enumerate(coords_list):
        d = (c[0] - px) ** 2 + (c[1] - py) ** 2
        if d < min_d:
            min_d, min_idx = d, idx
    if from_start:
        res = list(coords_list[:min_idx + 1])
        if not res or res[-1] != proj_coord:
            res.append(proj_coord)
        return res
    else:
        res = [proj_coord] + list(coords_list[min_idx:])
        return res
