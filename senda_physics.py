"""
SENDA — Motor Físico, Fisiológico Dual, Radiación 360° y Comunicaciones RF para Caminatas Marcianas (EVA)
NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map

Implementa:
1. Ecuación metabólica de Pandolf (1977) adaptada a Marte (0.38 g, traje x1.25) con soporte para
   masa variable de muestras recolectadas (`masa_muestras_kg`) en el tramo de regreso.
2. Fisiología Dual de Tripulación (`evaluar_tripulacion_dual`): EV-1 (Geologist, 78 kg) y EV-2
   (Commander, 72 kg), saturación de canister LiOH de CO2 (RQ = 0.88), agua de sublimación térmica
   (LCVG) acoplada a la temperatura REMS, y protocolo Buddy Walkback en caso de lesión.
3. Clasificación de pendiente (<10° passable, 10°–20° caution, >20° impassable), costo de arista y
   heurística admisible para búsqueda A*.
4. Modelo direccional de blindaje topográfico 360° (`calcular_blindaje_polar_360`) basado en
   Khaksarighiri et al. (2023) y Guo et al. (2026).
5. Evaluación de Línea de Vista RF (S-Band / UHF Relay) y generador de EVA Cuff Checklist.
6. Benchmark formal A* vs. Dijkstra con conteo de nodos explorados.
"""

from __future__ import annotations

import heapq
import json
import math
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

MARS_RADIUS_M = 3_389_500.0
DEG_TO_M_LAT = (math.pi / 180.0) * MARS_RADIUS_M  # ~59,158 m por grado de latitud


def cargar_env(ruta_env: Optional[str | Path] = None) -> Dict[str, Any]:
    """Carga el archivo env.json desde /data o devuelve los valores por defecto."""
    if ruta_env is None:
        base_dir = Path(__file__).resolve().parent
        candidatos = [
            base_dir / "data" / "env.json",
            base_dir / "env.json",
            base_dir.parent / "data" / "env.json",
        ]
        for c in candidatos:
            if c.exists():
                ruta_env = c
                break

    if ruta_env is not None and Path(ruta_env).exists():
        with open(ruta_env, "r", encoding="utf-8") as f:
            return json.load(f)

    return {
        "time": {"sol_duration_min": 1479.6},
        "radiation": {
            "gcr_dose_mSv_per_sol": 0.64,
            "solar_storm": {"unshielded_dose_rate_mSv_per_hr": 15.0},
            "shielding": {"ridge_escarpment_shelter_reduction_pct": 38.0},
        },
        "terrain_classes": {
            "passable": {"max_deg": 10.0, "risk_score": 0.1},
            "caution": {"min_deg": 10.0, "max_deg": 20.0, "risk_score": 0.5},
            "impassable": {"min_deg": 20.0, "risk_score": 1.0},
        },
        "physiology": {
            "astronaut_mass_kg": 75.0,
            "suit_and_plss_mass_kg": 45.0,
            "gravity_ratio": 0.38,
            "suit_metabolic_multiplier": 1.25,
            "terrain_factor_eta": 1.2,
            "nominal_walking_speed_m_s": 0.75,
            "stop_science_metabolic_rate_W": 220.0,
            "energy_to_o2_kJ_per_L": 20.1,
            "respiratory_quotient_rq": 0.88,
            "co2_scrubber_capacity_g": 850.0,
            "cooling_water_capacity_L": 4.2,
            "o2_uncertainty_fraction": 0.20,
            "plss_o2_capacity_L": 300.0,
            "return_safety_factor": 1.3,
            "caution_margin_threshold": 0.20,
            "suit_leak_multiplier": 1.5,
            "injury_speed_multiplier": 0.5,
            "buddy_assist_load_multiplier": 1.38,
        },
    }


ENV_DEFAULT = cargar_env()


def distancia_mars_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Distancia superficial en metros entre dos coordenadas (lon, lat en grados) en Marte."""
    lat_media_rad = math.radians((lat1 + lat2) * 0.5)
    dx = (lon2 - lon1) * DEG_TO_M_LAT * math.cos(lat_media_rad)
    dy = (lat2 - lat1) * DEG_TO_M_LAT
    return math.hypot(dx, dy)


def acimut_mars_grados(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Calcula el rumbo (bearing/azimuth en grados 0°–360°, 0°=Norte, 90°=Este)."""
    lat_media_rad = math.radians((lat1 + lat2) * 0.5)
    dx = (lon2 - lon1) * math.cos(lat_media_rad)
    dy = lat2 - lat1
    ang = math.degrees(math.atan2(dx, dy))
    return round((ang + 360.0) % 360.0, 1)


def pendiente_grados(dz_m: float, dist_horiz_m: float) -> float:
    """Calcula la magnitud de la pendiente en grados: theta = arctan(|dz| / d)."""
    if dz_m is None or dist_horiz_m is None or math.isnan(dz_m) or math.isnan(dist_horiz_m):
        return float("nan")
    if dist_horiz_m <= 0.0:
        return 90.0 if abs(dz_m) > 0.0 else 0.0
    return math.degrees(math.atan(abs(dz_m) / dist_horiz_m))


def clase_pendiente(theta_deg: Optional[float], env: Optional[Dict[str, Any]] = None) -> str:
    """
    Clasifica la pendiente según los umbrales de SENDA:
    - < 10°          -> 'passable'
    - 10° a 20°      -> 'caution'
    - > 20° o NaN    -> 'impassable'
    """
    if theta_deg is None or math.isnan(theta_deg) or theta_deg < 0.0:
        return "impassable"
    cfg = (env or ENV_DEFAULT).get("terrain_classes", {})
    umbral_passable = cfg.get("passable", {}).get("max_deg", 10.0)
    umbral_caution = cfg.get("caution", {}).get("max_deg", 20.0)

    if theta_deg < umbral_passable:
        return "passable"
    if theta_deg <= umbral_caution:
        return "caution"
    return "impassable"


def potencia_pandolf_mars_W(
    velocidad_m_s: float,
    grade_pct: float,
    masa_muestras_kg: float = 0.0,
    masa_cuerpo_kg: Optional[float] = None,
    env: Optional[Dict[str, Any]] = None,
) -> float:
    """
    Calcula la tasa metabólica M (Watts = J/s) con la ecuación de Pandolf et al. (1977)
    adaptada a gravedad marciana (0.38 g), traje presurizado (x1.25) y masa adicional
    de muestras geológicas recolectadas (`masa_muestras_kg`).
    """
    phys = (env or ENV_DEFAULT).get("physiology", {})
    W = float(masa_cuerpo_kg if masa_cuerpo_kg is not None else phys.get("astronaut_mass_kg", 75.0))
    L_base = float(phys.get("suit_and_plss_mass_kg", 45.0))
    L = L_base + max(0.0, float(masa_muestras_kg))
    g_ratio = float(phys.get("gravity_ratio", 0.38))
    suit_mult = float(phys.get("suit_metabolic_multiplier", 1.25))
    eta = float(phys.get("terrain_factor_eta", 1.2))

    V = max(0.05, float(velocidad_m_s))
    L_eff = L * g_ratio
    M_eff = (W + L) * g_ratio

    if grade_pct >= 0.0:
        G_eff = grade_pct
    else:
        G_eff = max(-5.0, grade_pct * 0.30) if grade_pct >= -12.0 else abs(grade_pct) * 0.45

    termino_postural = 1.5 * W * (0.5 + 0.5 * g_ratio)
    termino_carga = 2.0 * (W + L_eff) * ((L_eff / W) ** 2)
    termino_locomocion = eta * M_eff * (1.5 * (V ** 2) + 0.35 * V * G_eff)

    potencia_W = (termino_postural + termino_carga + max(20.0, termino_locomocion)) * suit_mult
    return max(120.0, potencia_W)


def costo_arista(
    dist_m: float,
    dz_m: float,
    riesgo: Optional[float] = None,
    w_riesgo: float = 1.0,
    velocidad_m_s: Optional[float] = None,
    masa_muestras_kg: float = 0.0,
    env: Optional[Dict[str, Any]] = None,
) -> float:
    """
    Costo de arista según Sección 8:
        costo = E_Pandolf (kJ) * (1 + w_riesgo * riesgo)
    """
    if dist_m is None or dz_m is None or math.isnan(dist_m) or math.isnan(dz_m) or dist_m <= 0.0:
        return float("inf")

    theta = pendiente_grados(dz_m, dist_m)
    clase = clase_pendiente(theta, env=env)
    if clase == "impassable":
        return float("inf")

    phys = (env or ENV_DEFAULT).get("physiology", {})
    V = float(velocidad_m_s if velocidad_m_s is not None else phys.get("nominal_walking_speed_m_s", 0.75))
    V = max(0.05, V)

    if riesgo is None:
        riesgo_base = 0.1 if clase == "passable" else 0.5
        riesgo = riesgo_base + 0.4 * (theta / 20.0)

    riesgo = max(0.0, float(riesgo))
    w_riesgo = max(0.0, float(w_riesgo))

    grade_pct = (dz_m / dist_m) * 100.0
    dist_3d = math.hypot(dist_m, dz_m)
    tiempo_s = dist_3d / V
    potencia_W = potencia_pandolf_mars_W(V, grade_pct, masa_muestras_kg=masa_muestras_kg, env=env)
    energia_kJ = (potencia_W * tiempo_s) / 1000.0

    costo = energia_kJ * (1.0 + w_riesgo * riesgo)
    return max(1e-6, costo)


def heuristica(
    pos_a: Tuple[float, float],
    pos_b: Tuple[float, float],
    en_grados: bool = False,
    celda_m: float = 1.0,
    env: Optional[Dict[str, Any]] = None,
) -> float:
    """Heurística admisible h(n) para A* (cota inferior estricta de energía Pandolf)."""
    if en_grados:
        dist_m = distancia_mars_m(pos_a[0], pos_a[1], pos_b[0], pos_b[1])
    else:
        dist_m = math.hypot(pos_b[0] - pos_a[0], pos_b[1] - pos_a[1]) * celda_m

    if dist_m <= 0.0:
        return 0.0

    phys = (env or ENV_DEFAULT).get("physiology", {})
    V = float(phys.get("nominal_walking_speed_m_s", 0.75))
    potencia_min_W = potencia_pandolf_mars_W(V, -5.0, masa_muestras_kg=0.0, env=env)
    tiempo_min_s = dist_m / V
    return (potencia_min_W * tiempo_min_s) / 1000.0


def consumo_o2(
    energia_kJ: float,
    factor_fuga: float = 1.0,
    env: Optional[Dict[str, Any]] = None,
    redondear: bool = True,
) -> List[float]:
    """Convierte energía metabólica (kJ) en consumo de O2 [central_L, min_L, max_L]."""
    phys = (env or ENV_DEFAULT).get("physiology", {})
    kJ_por_L = float(phys.get("energy_to_o2_kJ_per_L", 20.1))
    incertidumbre = float(phys.get("o2_uncertainty_fraction", 0.20))

    central = max(0.0, (float(energia_kJ) / kJ_por_L) * float(factor_fuga))
    minimo = central * (1.0 - incertidumbre)
    maximo = central * (1.0 + incertidumbre)

    if redondear:
        return [int(round(central)), int(round(minimo)), int(round(maximo))]
    return [round(central, 2), round(minimo, 2), round(maximo, 2)]


def evaluar_tripulacion_dual(
    energia_base_kJ: float,
    duracion_min: float,
    temp_ambiente_C: float = -23.4,
    escenario: Optional[str] = None,
    masa_muestras_kg: float = 4.6,
    env: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Modela la fisiología dual de los 2 astronautas (EV-1 Geologist 78 kg y EV-2 Commander 72 kg)
    bajo el estándar NASA-STD-3001:
    - EV-1 transporta el 65% de las muestras geológicas y opera el taladro.
    - En caso de lesión ('injury'), EV-2 aplica el protocolo Buddy Walkback (+38% carga metabólica).
    - Calcula O2 consumido por miembro, producción de CO2 y saturación del canister LiOH (%),
      y agua de sublimación térmica del PLSS (L) según la temperatura REMS.
    """
    phys = (env or ENV_DEFAULT).get("physiology", {})
    rq = float(phys.get("respiratory_quotient_rq", 0.88))
    cap_co2_g = float(phys.get("co2_scrubber_capacity_g", 850.0))
    cap_water_L = float(phys.get("cooling_water_capacity_L", 4.2))
    factor_fuga = float(phys.get("suit_leak_multiplier", 1.5)) if escenario == "suit_leak" else 1.0

    # Ajuste por masa de muestras y rol
    penalizacion_muestras = 1.0 + 0.014 * max(0.0, float(masa_muestras_kg))
    ev1_energia_kJ = float(energia_base_kJ) * 1.04 * penalizacion_muestras
    ev2_energia_kJ = float(energia_base_kJ) * 0.96 * (1.0 + 0.006 * max(0.0, float(masa_muestras_kg)))

    if escenario == "injury":
        # EV-1 lesionado, EV-2 lo asiste físicamente (Buddy Walkback Protocol)
        ev2_energia_kJ *= float(phys.get("buddy_assist_load_multiplier", 1.38))

    ev1_o2 = consumo_o2(ev1_energia_kJ, factor_fuga=factor_fuga, env=env, redondear=False)
    ev2_o2 = consumo_o2(ev2_energia_kJ, factor_fuga=factor_fuga, env=env, redondear=False)

    # 1 L O2 STPD -> RQ L CO2 -> ~1.964 g/L CO2
    ev1_co2_g = round((ev1_energia_kJ / 20.1) * rq * 1.964, 1)
    ev2_co2_g = round((ev2_energia_kJ / 20.1) * rq * 1.964, 1)

    # Agua de sublimación térmica (calor metabólico residual ~78% de E_total; calor latente ~2430 kJ/L)
    # En temperaturas más cálidas (-12 °C a mediodía) el traje irradia menos calor al ambiente y gasta más agua
    factor_termico = max(0.45, min(1.15, 0.82 + (float(temp_ambiente_C) - (-25.0)) * 0.012))
    ev1_water_L = round(((ev1_energia_kJ * 0.78 * factor_termico) / 2430.0), 2)
    ev2_water_L = round(((ev2_energia_kJ * 0.78 * factor_termico) / 2430.0), 2)

    limiting_member = "EV-2 (Commander - Buddy Assist)" if ev2_o2[0] > ev1_o2[0] else "EV-1 (Geologist - Sample Carrier)"

    return {
        "limiting_crew_member": limiting_member,
        "sample_mass_carried_kg": round(float(masa_muestras_kg), 2),
        "ev1_geologist": {
            "id": "EV-1",
            "role": "Planetary Geologist (78 kg)",
            "energy_MJ": round(ev1_energia_kJ / 1000.0, 2),
            "o2_L": [round(x) for x in ev1_o2],
            "co2_produced_g": ev1_co2_g,
            "co2_scrubber_pct": round(min(100.0, (ev1_co2_g / cap_co2_g) * 100.0), 1),
            "cooling_water_L": ev1_water_L,
            "cooling_water_pct": round(min(100.0, (ev1_water_L / cap_water_L) * 100.0), 1),
        },
        "ev2_commander": {
            "id": "EV-2",
            "role": "EVA Commander (72 kg)",
            "energy_MJ": round(ev2_energia_kJ / 1000.0, 2),
            "o2_L": [round(x) for x in ev2_o2],
            "co2_produced_g": ev2_co2_g,
            "co2_scrubber_pct": round(min(100.0, (ev2_co2_g / cap_co2_g) * 100.0), 1),
            "cooling_water_L": ev2_water_L,
            "cooling_water_pct": round(min(100.0, (ev2_water_L / cap_water_L) * 100.0), 1),
        },
        "kind": "modeled",
    }


def calcular_blindaje_polar_360(
    horizon_mask_deg: List[float],
    env: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Calcula el Factor de Vista del Cielo (SVF) y el porcentaje de reducción de dosis
    integrando los 12 sectores acimutales de 30° del horizonte topográfico
    (Khaksarighiri et al. 2023; Guo et al. 2026).
    """
    if not horizon_mask_deg:
        horizon_mask_deg = [10.0] * 12

    # Fracción de hemisferio bloqueado por sector: sin^2(alpha_horizonte) o (1 - cos(alpha))
    bloqueo_sectores = [1.0 - math.cos(math.radians(max(0.0, min(89.0, a)))) for a in horizon_mask_deg]
    svf = 1.0 - (sum(bloqueo_sectores) / len(bloqueo_sectores))
    # Peso mayor para ángulos cenitales bajos/medios debido a la cascada secundaria atmosférica marciana
    elev_media = sum(horizon_mask_deg) / len(horizon_mask_deg)
    reduccion_pct = min(55.0, max(5.0, (1.0 - svf) * 85.0 + elev_media * 0.48))

    return {
        "azimuth_sectors_deg": [i * 30 for i in range(len(horizon_mask_deg))],
        "horizon_elev_deg": horizon_mask_deg,
        "sky_view_factor": round(svf, 3),
        "mean_horizon_elev_deg": round(elev_media, 1),
        "dose_reduction_pct": round(reduccion_pct, 1),
        "kind": "modeled",
    }


def reduccion_blindaje(
    sky_view_factor: float = 1.0,
    tipo_terreno: str = "open",
    env: Optional[Dict[str, Any]] = None,
) -> float:
    """Calcula el porcentaje de reducción de dosis de radiación por blindaje topográfico."""
    rad_cfg = (env or ENV_DEFAULT).get("radiation", {}).get("shielding", {})
    if tipo_terreno in ("shelter", "escarpment"):
        base_pct = float(rad_cfg.get("ridge_escarpment_shelter_reduction_pct", 38.0))
    elif tipo_terreno == "hollow":
        base_pct = float(rad_cfg.get("boxwork_hollow_reduction_pct", 18.0))
    else:
        base_pct = 0.0

    svf_clamped = min(1.0, max(0.0, float(sky_view_factor)))
    reduccion_por_svf = (1.0 - svf_clamped) * 65.0
    return round(min(60.0, max(base_pct, reduccion_por_svf)), 1)


def dosis_gcr(
    duracion_min: float,
    blindaje_pct: float = 0.0,
    tormenta_solar: bool = False,
    env: Optional[Dict[str, Any]] = None,
) -> float:
    """Calcula la dosis equivalente acumulada (mSv) durante duracion_min minutos."""
    cfg = env or ENV_DEFAULT
    sol_min = float(cfg.get("time", {}).get("sol_duration_min", 1479.6))
    rad = cfg.get("radiation", {})
    dosis_sol_mSv = float(rad.get("gcr_dose_mSv_per_sol", 0.64))

    dur_min = max(0.0, float(duracion_min))
    dosis_base = (dur_min / sol_min) * dosis_sol_mSv

    if tormenta_solar:
        tasa_spe_hr = float(rad.get("solar_storm", {}).get("unshielded_dose_rate_mSv_per_hr", 15.0))
        dosis_spe = (dur_min / 60.0) * tasa_spe_hr
        dosis_total = dosis_base + dosis_spe
    else:
        dosis_total = dosis_base

    factor_blindaje = 1.0 - min(0.90, max(0.0, float(blindaje_pct) / 100.0))
    return round(dosis_total * factor_blindaje, 3)


def reserva_o2(
    o2_restante_L: float,
    o2_retorno_max_L: float,
    escenario: Optional[str] = None,
    factor_seguridad: Optional[float] = None,
    env: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Evalúa las reglas de alerta de retorno seguro (Sección 9 del brief)."""
    phys = (env or ENV_DEFAULT).get("physiology", {})
    fs = float(factor_seguridad if factor_seguridad is not None else phys.get("return_safety_factor", 1.3))
    umbral_caution = float(phys.get("caution_margin_threshold", 0.20))

    mult_consumo = 1.0
    mult_velocidad = 1.0
    if escenario == "suit_leak":
        mult_consumo = float(phys.get("suit_leak_multiplier", 1.5))
    elif escenario == "injury":
        mult_velocidad = float(phys.get("injury_speed_multiplier", 0.5))
        mult_consumo = float(phys.get("buddy_assist_load_multiplier", 1.38))
    elif escenario == "dust_storm":
        mult_velocidad = 0.70
        mult_consumo = 1.20

    o2_req_conservador = float(o2_retorno_max_L) * fs * mult_consumo
    margen_L = float(o2_restante_L) - o2_req_conservador
    ratio_margen = (margen_L / float(o2_restante_L)) if o2_restante_L > 0 else -1.0

    if margen_L <= 0.0:
        nivel = "return now"
        accion = "Replan immediate return route to staging base T01."
    elif ratio_margen <= umbral_caution:
        nivel = "caution"
        accion = "Positive margin < 20%: complete current stop and initiate return."
    else:
        nivel = "info"
        accion = "Safe O2 margin (> 20%). Continue nominal EVA plan."

    if escenario == "solar_storm":
        nivel = "return now"
        accion = "SOLAR PARTICLE EVENT — Reroute immediately to nearest high-shielding shelter (T08)."
    elif escenario == "suit_leak":
        nivel = "return now"
        accion = "SUIT LEAK DETECTED (O2 consumption x1.5) — Immediate abort and return to base T01."
    elif escenario == "dust_storm" and nivel == "info":
        nivel = "caution"
        accion = "DUST STORM (tau > 3.0) — Reduce walking speed and recalculate return window."
    elif escenario == "injury" and nivel == "info":
        nivel = "caution"
        accion = "CREW INJURY (speed x0.5, Buddy Walkback x1.38) — Recalculating return consumables."
    elif escenario == "blocked_path" and nivel == "info":
        nivel = "caution"
        accion = "BLOCKED PATH AHEAD — Replanning detour around impassable sector."

    return {
        "o2_left_L": round(float(o2_restante_L), 1),
        "o2_return_required_L": round(o2_req_conservador, 1),
        "margin_L": round(margen_L, 1),
        "margin_ratio": round(ratio_margen, 3),
        "level": nivel,
        "action": accion,
        "scenario": escenario or "nominal",
        "speed_multiplier": mult_velocidad,
        "consumption_multiplier": mult_consumo,
        "kind": "modeled",
    }


def _buscar_camino_grilla_con_stats(
    elev_grid: List[List[float]],
    risk_grid: List[List[float]],
    origen: Tuple[int, int],
    destino: Tuple[int, int],
    celda_m: float = 2.0,
    w_riesgo: float = 1.0,
    usar_heuristica: bool = True,
    env: Optional[Dict[str, Any]] = None,
) -> Tuple[float, List[Tuple[int, int]], int, float]:
    """
    Ejecuta A* (usar_heuristica=True) o Dijkstra (usar_heuristica=False) y devuelve:
    (costo_optimo_kJ, camino_celdas, nodos_explorados, tiempo_ms).
    """
    t0 = time.perf_counter()
    filas = len(elev_grid)
    cols = len(elev_grid[0]) if filas > 0 else 0
    vecinos_8 = [
        (-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
        (-1, -1, math.sqrt(2.0)), (-1, 1, math.sqrt(2.0)),
        (1, -1, math.sqrt(2.0)), (1, 1, math.sqrt(2.0)),
    ]

    g_cost: Dict[Tuple[int, int], float] = {origen: 0.0}
    padres: Dict[Tuple[int, int], Tuple[int, int]] = {}
    h0 = heuristica(origen, destino, en_grados=False, celda_m=celda_m, env=env) if usar_heuristica else 0.0
    cola: List[Tuple[float, float, Tuple[int, int]]] = [(h0, 0.0, origen)]
    visitados = set()

    while cola:
        _, g_actual, actual = heapq.heappop(cola)
        if actual in visitados:
            continue
        visitados.add(actual)

        if actual == destino:
            camino = [actual]
            while actual in padres:
                actual = padres[actual]
                camino.append(actual)
            camino.reverse()
            dt_ms = (time.perf_counter() - t0) * 1000.0
            return g_actual, camino, len(visitados), round(dt_ms, 3)

        r, c = actual
        z_actual = elev_grid[r][c]
        for dr, dc, factor_dist in vecinos_8:
            nr, nc = r + dr, c + dc
            if not (0 <= nr < filas and 0 <= nc < cols):
                continue
            vecino = (nr, nc)
            if vecino in visitados:
                continue

            z_vecino = elev_grid[nr][nc]
            dz = z_vecino - z_actual
            dist_arista = celda_m * factor_dist
            riesgo_celda = risk_grid[nr][nc]

            c_arista = costo_arista(dist_arista, dz, riesgo=riesgo_celda, w_riesgo=w_riesgo, env=env)
            if math.isinf(c_arista):
                continue

            nuevo_g = g_actual + c_arista
            if nuevo_g < g_cost.get(vecino, float("inf")):
                g_cost[vecino] = nuevo_g
                padres[vecino] = actual
                h_val = (
                    heuristica(vecino, destino, en_grados=False, celda_m=celda_m, env=env)
                    if usar_heuristica
                    else 0.0
                )
                heapq.heappush(cola, (nuevo_g + h_val, nuevo_g, vecino))

    dt_ms = (time.perf_counter() - t0) * 1000.0
    return float("inf"), [], len(visitados), round(dt_ms, 3)


def _buscar_camino_grilla(
    elev_grid: List[List[float]],
    risk_grid: List[List[float]],
    origen: Tuple[int, int],
    destino: Tuple[int, int],
    celda_m: float = 2.0,
    w_riesgo: float = 1.0,
    usar_heuristica: bool = True,
    env: Optional[Dict[str, Any]] = None,
) -> Tuple[float, List[Tuple[int, int]]]:
    costo, camino, _, _ = _buscar_camino_grilla_con_stats(
        elev_grid, risk_grid, origen, destino, celda_m, w_riesgo, usar_heuristica, env
    )
    return costo, camino


def ejecutar_pruebas() -> bool:
    """Ejecuta la batería de pruebas unitarias de física, fisiología dual, blindaje 360° y A* == Dijkstra."""
    env = cargar_env()

    # 1. Pendientes y clases
    assert clase_pendiente(pendiente_grados(0.0, 10.0), env) == "passable"
    assert clase_pendiente(pendiente_grados(2.5, 10.0), env) == "caution"
    assert clase_pendiente(pendiente_grados(5.0, 10.0), env) == "impassable"

    # 2. Costo de arista y efecto del peso de muestras recolectadas
    c_sin_muestras = costo_arista(10.0, 1.0, riesgo=0.1, w_riesgo=1.0, masa_muestras_kg=0.0, env=env)
    c_con_muestras = costo_arista(10.0, 1.0, riesgo=0.1, w_riesgo=1.0, masa_muestras_kg=8.0, env=env)
    assert c_con_muestras > c_sin_muestras > 0.0

    # 3. Conversión de O2 y dosis contra mock_routes.json
    assert consumo_o2(3670.0, env=env) == [183, 146, 219]
    assert abs(dosis_gcr(189.0, env=env) - 0.082) <= 0.001

    # 4. Fisiología dual (EV-1 y EV-2) + CO2 + Agua de enfriamiento
    dual = evaluar_tripulacion_dual(3670.0, 189.0, temp_ambiente_C=-18.0, masa_muestras_kg=6.2, env=env)
    assert dual["ev1_geologist"]["co2_scrubber_pct"] > 0.0
    assert dual["ev1_geologist"]["cooling_water_L"] > 0.0

    # 5. Blindaje polar 360° (T08 Shelter vs T01 Base)
    polar_t08 = calcular_blindaje_polar_360([28, 35, 48, 62, 68, 64, 52, 38, 29, 25, 24, 26], env=env)
    polar_t01 = calcular_blindaje_polar_360([6, 8, 12, 18, 24, 28, 25, 19, 14, 10, 7, 6], env=env)
    assert polar_t08["dose_reduction_pct"] > polar_t01["dose_reduction_pct"]

    # 6. Benchmark A* vs Dijkstra
    n = 18
    elev_grid = [[-3730.0 + 0.25 * r + 0.15 * c for c in range(n)] for r in range(n)]
    risk_grid = [[0.1 + 0.02 * ((r + c) % 5) for c in range(n)] for r in range(n)]
    for r in range(3, 14):
        elev_grid[r][8] = -3690.0

    c_a, r_a, nodos_a, t_a = _buscar_camino_grilla_con_stats(
        elev_grid, risk_grid, (0, 0), (17, 17), celda_m=2.0, w_riesgo=1.5, usar_heuristica=True, env=env
    )
    c_d, r_d, nodos_d, t_d = _buscar_camino_grilla_con_stats(
        elev_grid, risk_grid, (0, 0), (17, 17), celda_m=2.0, w_riesgo=1.5, usar_heuristica=False, env=env
    )
    assert abs(c_a - c_d) < 1e-6
    assert nodos_a <= nodos_d

    print("[OK] Todas las pruebas avanzadas de senda_physics.py pasaron:")
    print(f"     - Dual Crew EV-1 O2: {dual['ev1_geologist']['o2_L']} L | CO2: {dual['ev1_geologist']['co2_scrubber_pct']}% | Water: {dual['ev1_geologist']['cooling_water_L']} L")
    print(f"     - Blindaje Polar 360° T08 Shelter: -{polar_t08['dose_reduction_pct']}% (SVF={polar_t08['sky_view_factor']})")
    print(f"     - Benchmark A* ({nodos_a} nodos, {t_a} ms) == Dijkstra ({nodos_d} nodos, {t_d} ms) | Costo = {c_a:.4f} kJ")
    return True


if __name__ == "__main__":
    ejecutar_pruebas()
