"""
SENDA — Planificador A*, Campo de Retorno Seguro (Dijkstra), Fisiología Dual y EVA Cuff Checklist
NASA Space Apps Challenge 2026 · Equipo Senda
"""

from __future__ import annotations

import copy
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from senda_physics import (
    _buscar_camino_grilla,
    _buscar_camino_grilla_con_stats,
    acimut_mars_grados,
    calcular_blindaje_polar_360,
    cargar_env,
    consumo_o2,
    distancia_mars_m,
    dosis_gcr,
    evaluar_tripulacion_dual,
    potencia_pandolf_mars_W,
    reserva_o2,
)
from terrain_pipeline import (
    BBOX_LAT_MAX,
    BBOX_LAT_MIN,
    BBOX_LON_MAX,
    BBOX_LON_MIN,
    celda_a_coords,
    coords_a_celda,
    generar_grilla_terreno,
)


class SendaPlanner:
    """Planificador espacial multicriterio sobre la grilla topográfica de Mount Sharp."""

    def __init__(self, filas: int = 64, cols: int = 64) -> None:
        self.base_dir = Path(__file__).resolve().parent
        self.env = cargar_env(self.base_dir / "data" / "env.json")
        self.targets_geojson = self._cargar_targets()
        self.targets_by_id: Dict[str, Dict[str, Any]] = {
            f["properties"]["id"]: f for f in self.targets_geojson.get("features", [])
        }
        self.mock_routes_data = self._cargar_mock_routes()
        self.grilla = generar_grilla_terreno(filas=filas, cols=cols, env=self.env)
        self.filas = filas
        self.cols = cols
        self.celda_m = float(self.grilla["meta"]["cell_size_m"])

    def _cargar_targets(self) -> Dict[str, Any]:
        ruta = self.base_dir / "data" / "targets_v0.geojson"
        with open(ruta, "r", encoding="utf-8") as f:
            return json.load(f)

    def _cargar_mock_routes(self) -> Dict[str, Any]:
        ruta = self.base_dir / "data" / "mock_routes.json"
        with open(ruta, "r", encoding="utf-8") as f:
            return json.load(f)

    def obtener_coords_target(self, target_id: str) -> Tuple[float, float]:
        feat = self.targets_by_id.get(target_id)
        if not feat:
            return (137.39600, -4.78500)
        coords = feat["geometry"]["coordinates"]
        return float(coords[0]), float(coords[1])

    def evaluar_metricas_geometria(
        self,
        coords_lon_lat: List[List[float]],
        elevaciones_m: List[float],
        stops: List[Dict[str, Any]],
        velocidad_m_s: Optional[float] = None,
        factor_fuga: float = 1.0,
        masa_muestras_regreso_kg: float = 4.6,
        ida_y_vuelta: bool = True,
    ) -> Dict[str, Any]:
        """
        Calcula distancia, desnivel, pendiente máxima, energía Pandolf asimétrica
        (el regreso carga las muestras geológicas recolectadas), O2, dosis GCR y fisiología dual.
        """
        phys = self.env.get("physiology", {})
        V = float(velocidad_m_s if velocidad_m_s is not None else phys.get("nominal_walking_speed_m_s", 0.75))
        potencia_parada_W = float(phys.get("stop_science_metabolic_rate_W", 220.0))

        dist_ida_m = 0.0
        subida_m = 0.0
        max_grade_pct = 0.0
        energia_caminata_ida_kJ = 0.0
        energia_caminata_regreso_kJ = 0.0

        for i in range(len(coords_lon_lat) - 1):
            lon1, lat1 = coords_lon_lat[i]
            lon2, lat2 = coords_lon_lat[i + 1]
            z1 = elevaciones_m[i]
            z2 = elevaciones_m[i + 1]

            d_seg = distancia_mars_m(lon1, lat1, lon2, lat2)
            if d_seg <= 0.01:
                continue
            dz = z2 - z1
            dist_ida_m += d_seg
            if dz > 0:
                subida_m += dz

            grade_ida = (dz / d_seg) * 100.0
            grade_vuelta = (-dz / d_seg) * 100.0
            max_grade_pct = max(max_grade_pct, abs(grade_ida))

            t_seg = math.hypot(d_seg, dz) / V
            p_ida_W = potencia_pandolf_mars_W(V, grade_ida, masa_muestras_kg=0.5, env=self.env)
            # En el regreso el astronauta carga las muestras recolectadas
            p_vuelta_W = potencia_pandolf_mars_W(
                V, grade_vuelta, masa_muestras_kg=masa_muestras_regreso_kg, env=self.env
            )

            energia_caminata_ida_kJ += (p_ida_W * t_seg) / 1000.0
            energia_caminata_regreso_kJ += (p_vuelta_W * t_seg) / 1000.0

        tiempo_paradas_min = sum(float(s.get("min", 0)) for s in stops)
        energia_paradas_kJ = (potencia_parada_W * (tiempo_paradas_min * 60.0)) / 1000.0

        factor_tramos = 2.0 if ida_y_vuelta else 1.0
        tiempo_caminata_min = ((dist_ida_m * factor_tramos) / V) / 60.0
        duracion_total_min = int(round(tiempo_caminata_min + tiempo_paradas_min))

        energia_total_kJ = (
            energia_caminata_ida_kJ
            + (energia_caminata_regreso_kJ if ida_y_vuelta else 0.0)
            + energia_paradas_kJ
        )
        energia_MJ = round(energia_total_kJ / 1000.0, 2)
        o2_rango = consumo_o2(energia_total_kJ, factor_fuga=factor_fuga, env=self.env, redondear=True)
        dosis = dosis_gcr(duracion_total_min, env=self.env)
        dual_crew = evaluar_tripulacion_dual(
            energia_total_kJ,
            duracion_total_min,
            masa_muestras_kg=masa_muestras_regreso_kg,
            env=self.env,
        )

        return {
            "distance_oneway_m": int(round(dist_ida_m)),
            "climb_m": round(subida_m, 1),
            "max_grade_pct": round(max_grade_pct, 1),
            "duration_min": duracion_total_min,
            "energy_MJ": energia_MJ,
            "o2_L": o2_rango,
            "dose_gcr_mSv": dosis,
            "stops": stops,
            "sample_mass_kg": round(masa_muestras_regreso_kg, 2),
            "dual_crew": dual_crew,
            "kind": "modeled",
        }

    def planificar_ruta_astar(
        self,
        origen_lon_lat: List[float],
        waypoints_ids: List[str],
        perfil: str = "safe",
        risk_override: Optional[List[List[float]]] = None,
        sample_mass_kg: float = 4.6,
    ) -> Dict[str, Any]:
        """Calcula una ruta óptima encadenando A* entre el origen y los waypoints solicitados."""
        perfil_norm = perfil.lower()
        cfg_perfiles = {
            "safe": {"id": "segura", "name": "Safe", "color": "#7CD992", "w_risk": 3.5},
            "segura": {"id": "segura", "name": "Safe", "color": "#7CD992", "w_risk": 3.5},
            "fast": {"id": "rapida", "name": "Fast", "color": "#4FC3F7", "w_risk": 0.0},
            "rapida": {"id": "rapida", "name": "Fast", "color": "#4FC3F7", "w_risk": 0.0},
            "scientific": {"id": "cientifica", "name": "Scientific", "color": "#E8B04B", "w_risk": 1.0},
            "cientifica": {"id": "cientifica", "name": "Scientific", "color": "#E8B04B", "w_risk": 1.0},
        }
        meta_p = cfg_perfiles.get(perfil_norm, cfg_perfiles["safe"])
        w_risk = meta_p["w_risk"]

        if not waypoints_ids:
            waypoints_ids = (
                ["T01", "T02", "T03", "T04", "T05", "T06"]
                if meta_p["id"] == "cientifica"
                else ["T01", "T06"]
            )

        puntos_coords: List[Tuple[float, float]] = [(float(origen_lon_lat[0]), float(origen_lon_lat[1]))]
        visitas: List[str] = ["T01"]
        for wid in waypoints_ids:
            if wid == "T01" and len(puntos_coords) == 1:
                continue
            puntos_coords.append(self.obtener_coords_target(wid))
            if wid not in visitas:
                visitas.append(wid)

        elev_grid = self.grilla["elev_m"]
        risk_grid = risk_override if risk_override is not None else self.grilla["risk_grid"]

        celdas_totales: List[Tuple[int, int]] = []
        for i in range(len(puntos_coords) - 1):
            celda_ini = coords_a_celda(puntos_coords[i][0], puntos_coords[i][1], self.filas, self.cols)
            celda_fin = coords_a_celda(puntos_coords[i + 1][0], puntos_coords[i + 1][1], self.filas, self.cols)
            _, tramo = _buscar_camino_grilla(
                elev_grid,
                risk_grid,
                celda_ini,
                celda_fin,
                celda_m=self.celda_m,
                w_riesgo=w_risk,
                usar_heuristica=True,
                env=self.env,
            )
            if not tramo:
                tramo = [celda_ini, celda_fin]
            if celdas_totales and tramo[0] == celdas_totales[-1]:
                celdas_totales.extend(tramo[1:])
            else:
                celdas_totales.extend(tramo)

        coords_ruta: List[List[float]] = []
        elev_ruta: List[float] = []
        for idx, (r, c) in enumerate(celdas_totales):
            lon, lat = celda_a_coords(r, c, self.filas, self.cols)
            if idx == 0:
                lon, lat = round(puntos_coords[0][0], 6), round(puntos_coords[0][1], 6)
            elif idx == len(celdas_totales) - 1:
                lon, lat = round(puntos_coords[-1][0], 6), round(puntos_coords[-1][1], 6)
            coords_ruta.append([lon, lat])
            elev_ruta.append(round(float(elev_grid[r][c]), 1))

        stops = [
            {
                "target": wid,
                "min": int(
                    self.targets_by_id.get(wid, {})
                    .get("properties", {})
                    .get("eva_sampling", {})
                    .get("duration_min", 20)
                ),
            }
            for wid in visitas
            if wid != "T01"
        ]
        metricas = self.evaluar_metricas_geometria(
            coords_ruta, elev_ruta, stops=stops, masa_muestras_regreso_kg=sample_mass_kg
        )

        return {
            "id": meta_p["id"],
            "name": meta_p["name"],
            "color": meta_p["color"],
            "visits": visitas,
            "geometry": {
                "type": "LineString",
                "coordinates": coords_ruta,
            },
            "elevation_m": elev_ruta,
            "metrics": metricas,
            "placeholder": False,
            "kind": "modeled",
            "note": f"Computed via SENDA A* pathfinder (w_risk={w_risk}, samples={sample_mass_kg} kg).",
        }

    def calcular_rutas_perfiles(
        self,
        origin: Optional[List[float]] = None,
        waypoints: Optional[List[str]] = None,
        profiles: Optional[List[str]] = None,
        usar_precalculadas_fase1: bool = False,
    ) -> Dict[str, Any]:
        """Implementa el contrato de POST /routes."""
        if usar_precalculadas_fase1:
            return self.mock_routes_data

        orig = origin or [137.39600, -4.78500]
        perfiles = profiles or ["scientific", "fast", "safe"]
        rutas_salida = []

        for p in perfiles:
            wps = waypoints
            if not wps:
                wps = (
                    ["T01", "T02", "T03", "T04", "T05", "T06"]
                    if p.lower() in ("scientific", "cientifica")
                    else ["T01", "T06"]
                )
            rutas_salida.append(self.planificar_ruta_astar(orig, wps, perfil=p))

        return {
            "meta": {
                "note": "Computed dynamically with senda_physics.py & A* over Mount Sharp cost grid.",
                "base": "T01",
                "destino": (waypoints[-1] if waypoints else "T06"),
                "kind": "modeled",
            },
            "routes": rutas_salida,
        }

    def calcular_poligono_retorno_seguro(
        self,
        posicion_lon_lat: List[float],
        o2_left_L: float,
        escenario: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Genera el polígono GeoJSON de la Zona de Retorno Seguro (Point of No Return)."""
        base_lon, base_lat = self.obtener_coords_target("T01")
        pos_lon, pos_lat = float(posicion_lon_lat[0]), float(posicion_lon_lat[1])

        dist_a_base_m = distancia_mars_m(pos_lon, pos_lat, base_lon, base_lat)
        o2_retorno_est_max_L = max(8.0, (dist_a_base_m / 1623.0) * 55.0)
        estado_reserva = reserva_o2(o2_left_L, o2_retorno_est_max_L, escenario=escenario, env=self.env)

        mult_consumo = float(estado_reserva["consumption_multiplier"])
        o2_util_L = max(12.0, (float(o2_left_L) / (1.3 * mult_consumo)) - o2_retorno_est_max_L * 0.45)
        radio_base_m = min(1650.0, max(140.0, o2_util_L * 11.5))

        centro_lon = 0.55 * base_lon + 0.45 * pos_lon
        centro_lat = 0.55 * base_lat + 0.45 * pos_lat

        n_vertices = 32
        anillo: List[List[float]] = []
        for i in range(n_vertices):
            ang = (2.0 * math.pi * i) / n_vertices
            sesgo_pendiente = 1.0 + 0.14 * math.cos(ang - math.radians(45.0))
            r_m = radio_base_m * sesgo_pendiente
            d_lon = (r_m * math.cos(ang)) / (59158.0 * math.cos(math.radians(centro_lat)))
            d_lat = (r_m * math.sin(ang)) / 59158.0
            lon_v = min(BBOX_LON_MAX, max(BBOX_LON_MIN, centro_lon + d_lon))
            lat_v = min(BBOX_LAT_MAX, max(BBOX_LAT_MIN, centro_lat + d_lat))
            anillo.append([round(lon_v, 6), round(lat_v, 6)])
        anillo.append(anillo[0])

        return {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [anillo],
            },
            "properties": {
                "radius_mean_m": round(radio_base_m, 1),
                "o2_left_L": round(float(o2_left_L), 1),
                "level": estado_reserva["level"],
                "kind": "modeled",
            },
        }

    def replanificar_contingencia(
        self,
        position: List[float],
        o2_left_L: float,
        event: str = "nominal",
        blocked_point: Optional[List[float]] = None,
    ) -> Dict[str, Any]:
        """Implementa el contrato de POST /replan (Sección 8 y Sección 9 del brief)."""
        ev_norm = (event or "nominal").lower().strip()
        if ev_norm == "blocked":
            ev_norm = "blocked_path"

        pos_lon, pos_lat = float(position[0]), float(position[1])
        base_lon, base_lat = self.obtener_coords_target("T01")
        dist_a_base_m = distancia_mars_m(pos_lon, pos_lat, base_lon, base_lat)
        o2_retorno_max_L = max(8.0, (dist_a_base_m / 1623.0) * 55.0)

        eval_alerta = reserva_o2(o2_left_L, o2_retorno_max_L, escenario=ev_norm, env=self.env)

        if ev_norm == "solar_storm":
            shelter_id = "T08"
            ruta_refugio = self.planificar_ruta_astar([pos_lon, pos_lat], [shelter_id], perfil="safe")
            ruta_refugio["id"] = "emergencia_spe"
            ruta_refugio["name"] = "Emergency Shelter Route (T08)"
            ruta_refugio["color"] = "#FF5A5F"
            coords_ref = ruta_refugio["geometry"]["coordinates"]
            elev_ref = ruta_refugio["elevation_m"]
            ruta_refugio["metrics"] = self.evaluar_metricas_geometria(
                coords_ref, elev_ref, stops=[{"target": "T08 Shelter", "min": 0}], ida_y_vuelta=False
            )
            zona_segura = self.calcular_poligono_retorno_seguro([pos_lon, pos_lat], o2_left_L, ev_norm)
            return {
                "route": ruta_refugio,
                "safe_return_zone": zona_segura,
                "alert": {
                    "level": "return now",
                    "title": "SOLAR PARTICLE EVENT — GO TO NEAREST SHELTER",
                    "message": (
                        "High-energy proton flux detected (SPE Scenario). Rerouting immediately to "
                        "Eastern boxwork contact escarpment (T08) for 38% topographic radiation shielding."
                    ),
                    "shelter_target": "T08",
                    "shielding_reduction_pct": 38.0,
                    "reserve": eval_alerta,
                    "kind": "modeled",
                },
            }

        risk_mod = None
        if ev_norm == "blocked_path":
            risk_mod = copy.deepcopy(self.grilla["risk_grid"])
            b_lon = blocked_point[0] if blocked_point else (pos_lon + base_lon) * 0.5
            b_lat = blocked_point[1] if blocked_point else (pos_lat + base_lat) * 0.5
            br, bc = coords_a_celda(b_lon, b_lat, self.filas, self.cols)
            for dr in range(-3, 4):
                for dc in range(-3, 4):
                    nr, nc = br + dr, bc + dc
                    if 0 <= nr < self.filas and 0 <= nc < self.cols:
                        risk_mod[nr][nc] = 4.5

        destino_id = "T06" if ev_norm == "blocked_path" and eval_alerta["level"] != "return now" else "T01"
        ruta_replan = self.planificar_ruta_astar(
            [pos_lon, pos_lat], [destino_id], perfil="safe", risk_override=risk_mod
        )
        ruta_replan["id"] = f"replan_{ev_norm}"
        ruta_replan["name"] = (
            "Detour Route (Blocked Sector)" if destino_id == "T06" else "Emergency Walkback to Base (T01)"
        )
        ruta_replan["color"] = "#FFB020" if eval_alerta["level"] == "caution" else "#FF5A5F"

        vel_nominal = float(self.env["physiology"]["nominal_walking_speed_m_s"])
        vel_efectiva = vel_nominal * float(eval_alerta["speed_multiplier"])
        factor_fuga = float(eval_alerta["consumption_multiplier"])

        coords_rep = ruta_replan["geometry"]["coordinates"]
        elev_rep = ruta_replan["elevation_m"]
        ruta_replan["metrics"] = self.evaluar_metricas_geometria(
            coords_rep,
            elev_rep,
            stops=[],
            velocidad_m_s=vel_efectiva,
            factor_fuga=factor_fuga,
            ida_y_vuelta=False,
        )

        zona_segura = self.calcular_poligono_retorno_seguro([pos_lon, pos_lat], o2_left_L, ev_norm)
        return {
            "route": ruta_replan,
            "safe_return_zone": zona_segura,
            "alert": {
                "level": eval_alerta["level"],
                "title": f"EVA ALERT — {ev_norm.upper().replace('_', ' ')}",
                "message": eval_alerta["action"],
                "shelter_target": None,
                "shielding_reduction_pct": 18.0,
                "reserve": eval_alerta,
                "kind": "modeled",
            },
        }

    def generar_cuff_checklist(self, route_id: str = "cientifica") -> Dict[str, Any]:
        """Genera el NASA EVA Flight Data File / Traverse Cuff Checklist minuto a minuto."""
        ruta = next(
            (r for r in self.mock_routes_data["routes"] if r["id"] == route_id),
            self.mock_routes_data["routes"][0],
        )
        visitas = ruta["visits"]
        pasos = []
        reloj_min = 9 * 60 + 30  # 09:30 LTST Egress
        o2_disp = 300.0
        muestras_acum_kg = 0.0

        for idx, tid in enumerate(visitas):
            feat = self.targets_by_id.get(tid, {})
            props = feat.get("properties", {})
            coords = feat.get("geometry", {}).get("coordinates", [137.396, -4.785])
            samp = props.get("eva_sampling", {})

            if idx == 0:
                dist_m = 0
                bearing = 0.0
                tramo_min = 10
            else:
                prev_coords = (
                    self.targets_by_id.get(visitas[idx - 1], {})
                    .get("geometry", {})
                    .get("coordinates", [137.396, -4.785])
                )
                dist_m = int(round(distancia_mars_m(prev_coords[0], prev_coords[1], coords[0], coords[1])))
                bearing = acimut_mars_grados(prev_coords[0], prev_coords[1], coords[0], coords[1])
                tramo_min = max(6, int(round((dist_m / 0.75) / 60.0)))

            reloj_min += tramo_min
            hh = f"{(reloj_min // 60) % 24:02d}:{reloj_min % 60:02d}"
            stop_min = int(samp.get("duration_min", 20)) if idx > 0 else 10
            sample_kg = float(samp.get("sample_mass_kg", 1.2))
            muestras_acum_kg += sample_kg
            o2_disp -= (tramo_min + stop_min) * 0.95
            # Bingo O2 = mínimo O2 para abortar y regresar a T01 con margen 1.3x
            dist_base = distancia_mars_m(coords[0], coords[1], 137.396, -4.785)
            bingo_o2_L = int(round(max(25.0, (dist_base / 1623.0) * 55.0 * 1.3)))

            pasos.append(
                {
                    "step": idx + 1,
                    "ltst": hh,
                    "target_id": tid,
                    "target_name": props.get("name", tid),
                    "leg_dist_m": dist_m,
                    "azimuth_deg": bearing,
                    "elev_m": props.get("elev_geoid_m", -3650.0),
                    "task_duration_min": stop_min,
                    "tool": samp.get("tool", "Geological Hammer"),
                    "protocol": samp.get("protocol", "Standard outcrop sampling"),
                    "cum_sample_mass_kg": round(muestras_acum_kg, 1),
                    "expected_o2_L": int(round(o2_disp)),
                    "bingo_no_return_o2_L": bingo_o2_L,
                    "comms_status": props.get("comms_los", "DIRECT_LINK"),
                }
            )
            reloj_min += stop_min

        return {
            "mission": "SENDA EVA-01 · Mount Sharp Boxwork Campaign",
            "sol": 5074,
            "ls_deg": 21.8,
            "route_name": ruta["name"],
            "crew": ["EV-1 (Planetary Geologist)", "EV-2 (EVA Commander)"],
            "steps": pasos,
            "kind": "modeled",
        }

    def verificar_optimalidad_astar_dijkstra(self) -> Dict[str, Any]:
        """Comprueba formalmente que A* y Dijkstra (h=0) entregan el mismo costo óptimo con conteo de nodos."""
        celda_t01 = coords_a_celda(137.39600, -4.78500, self.filas, self.cols)
        celda_t06 = coords_a_celda(137.38100, -4.80801, self.filas, self.cols)
        costo_a, ruta_a, nodos_a, ms_a = _buscar_camino_grilla_con_stats(
            self.grilla["elev_m"],
            self.grilla["risk_grid"],
            celda_t01,
            celda_t06,
            celda_m=self.celda_m,
            w_riesgo=1.5,
            usar_heuristica=True,
            env=self.env,
        )
        costo_d, ruta_d, nodos_d, ms_d = _buscar_camino_grilla_con_stats(
            self.grilla["elev_m"],
            self.grilla["risk_grid"],
            celda_t01,
            celda_t06,
            celda_m=self.celda_m,
            w_riesgo=1.5,
            usar_heuristica=False,
            env=self.env,
        )
        diff = abs(costo_a - costo_d)
        ahorro_nodos_pct = round((1.0 - (nodos_a / max(1, nodos_d))) * 100.0, 1)
        return {
            "valid": diff < 1e-5,
            "astar_cost_kJ": round(costo_a, 4),
            "dijkstra_cost_kJ": round(costo_d, 4),
            "cost_difference_kJ": round(diff, 6),
            "astar_nodes_explored": nodos_a,
            "dijkstra_nodes_explored": nodos_d,
            "node_reduction_pct": ahorro_nodos_pct,
            "astar_time_ms": ms_a,
            "dijkstra_time_ms": ms_d,
            "steps_count": len(ruta_a),
        }


if __name__ == "__main__":
    planner = SendaPlanner(filas=64, cols=64)
    print("[OK] Benchmark A* vs Dijkstra:", planner.verificar_optimalidad_astar_dijkstra())
    print("[OK] Cuff Checklist pasos:", len(planner.generar_cuff_checklist()["steps"]))
