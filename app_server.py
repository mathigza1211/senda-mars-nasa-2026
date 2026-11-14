"""
SENDA — Backend API Server (FastAPI · Fase 2)
NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map

Implementa exactamente los contratos de la Sección 8 del brief:
- GET  /targets        -> GeoJSON FeatureCollection (= targets_v0.geojson)
- GET  /env            -> env.json
- POST /routes         -> { origin:[lon,lat], waypoints:[id...], profiles:["safe","fast","scientific"] }
- POST /replan         -> { position:[lon,lat], o2_left_L, event:"solar_storm"|"blocked"|... }
- GET  /layers/{name}  -> Datos de capa ráster (slope, risk, shielding, crism, elev, all)
- GET  /validate-astar -> Comprobación formal A* == Dijkstra
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from senda_planner import SendaPlanner

app = FastAPI(
    title="SENDA Martian EVA Mission Control API",
    description="Safe paths to Martian science — Mount Sharp Boxwork Unit, Gale Crater",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

planner = SendaPlanner(filas=64, cols=64)


class RoutesRequest(BaseModel):
    origin: List[float] = Field(default_factory=lambda: [137.39600, -4.78500])
    waypoints: List[str] = Field(default_factory=list)
    profiles: List[str] = Field(default_factory=lambda: ["scientific", "fast", "safe"])
    use_mock: bool = False


class ReplanRequest(BaseModel):
    position: List[float] = Field(..., description="[lon, lat] actual del astronauta")
    o2_left_L: float = Field(..., description="Litros de O2 restantes en el PLSS")
    event: str = Field(default="nominal", description="solar_storm | dust_storm | suit_leak | injury | blocked_path")
    blocked_point: Optional[List[float]] = None


@app.get("/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "online",
        "project": "SENDA",
        "site": "Mount Sharp Boxwork Unit, Gale Crater",
        "sol": planner.env.get("time", {}).get("sol", 5074),
    }


@app.get("/targets")
def get_targets() -> Dict[str, Any]:
    """Devuelve el GeoJSON FeatureCollection de los 8 objetivos científicos."""
    return planner.targets_geojson


@app.get("/env")
def get_env() -> Dict[str, Any]:
    """Devuelve env.json con ambiente, radiación, fisiología y clases de terreno."""
    return planner.env


@app.post("/routes")
def post_routes(req: RoutesRequest) -> Dict[str, Any]:
    """Calcula las rutas óptimas con A* para los perfiles solicitados."""
    return planner.calcular_rutas_perfiles(
        origin=req.origin,
        waypoints=req.waypoints,
        profiles=req.profiles,
        usar_precalculadas_fase1=req.use_mock,
    )


@app.post("/replan")
def post_replan(req: ReplanRequest) -> Dict[str, Any]:
    """Evalúa reglas de seguridad en modo FIELD, replanifica ruta y devuelve zona de retorno seguro."""
    return planner.replanificar_contingencia(
        position=req.position,
        o2_left_L=req.o2_left_L,
        event=req.event,
        blocked_point=req.blocked_point,
    )


@app.get("/layers/{name}")
def get_layer(name: str) -> Dict[str, Any]:
    """Devuelve las matrices georreferenciadas de pendiente, riesgo, blindaje, CRISM o elevación."""
    key_map = {
        "slope": "slope_deg",
        "risk": "risk_grid",
        "shielding": "shielding_pct",
        "crism": "crism_index",
        "elev": "elev_m",
        "tri": "tri_m",
        "class": "terrain_class",
    }
    if name == "all":
        return planner.grilla
    if name not in key_map:
        raise HTTPException(
            status_code=404,
            detail=f"Layer '{name}' not found. Available: {list(key_map.keys()) + ['all']}",
        )
    grid_key = key_map[name]
    return {
        "name": name,
        "meta": planner.grilla["meta"],
        "lons": planner.grilla["lons"],
        "lats": planner.grilla["lats"],
        "values": planner.grilla[grid_key],
    }


@app.get("/validate-astar")
def validate_astar() -> Dict[str, Any]:
    """Verifica que el costo óptimo de A* coincida exactamente con Dijkstra (h=0) con conteo de nodos."""
    return planner.verificar_optimalidad_astar_dijkstra()


@app.get("/cuff-checklist/{route_id}")
def get_cuff_checklist(route_id: str = "cientifica") -> Dict[str, Any]:
    """Devuelve la tarjeta oficial NASA EVA Traverse Cuff Checklist minuto a minuto."""
    return planner.generar_cuff_checklist(route_id=route_id)



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app_server:app", host="0.0.0.0", port=8000, reload=True)
