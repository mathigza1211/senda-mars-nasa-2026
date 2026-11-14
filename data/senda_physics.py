"""
Re-exporta todo el motor físico de SENDA desde el módulo raíz para mantener
compatibilidad tanto si se importa desde `data/senda_physics.py` como desde la raíz.
"""

from pathlib import Path
import sys

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from senda_physics import (  # noqa: E402,F401
    MARS_RADIUS_M,
    DEG_TO_M_LAT,
    ENV_DEFAULT,
    cargar_env,
    distancia_mars_m,
    pendiente_grados,
    clase_pendiente,
    potencia_pandolf_mars_W,
    costo_arista,
    heuristica,
    consumo_o2,
    reduccion_blindaje,
    dosis_gcr,
    reserva_o2,
    ejecutar_pruebas,
)

if __name__ == "__main__":
    ejecutar_pruebas()
