"""Generate a short animation of lift force building with airspeed.

Run from the repo root:
    python lectures/01-introduction/code/generate_lift_animation.py

Writes lectures/01-introduction/media/lift_buildup.gif, which is embedded
directly in lectures/01-introduction/index.qmd.
"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.animation import FuncAnimation, PillowWriter

OUT_DIR = Path(__file__).resolve().parent.parent / "media"
OUT_DIR.mkdir(parents=True, exist_ok=True)

RHO = 1.225  # air density, kg/m^3
S = 0.35  # wing area, m^2
CL = 0.9  # lift coefficient, cruise AoA

velocity = np.linspace(0, 25, 120)  # m/s
lift = 0.5 * RHO * velocity**2 * S * CL

fig, ax = plt.subplots(figsize=(6, 4))
ax.set_xlim(0, velocity.max())
ax.set_ylim(0, lift.max() * 1.1)
ax.set_xlabel("Airspeed (m/s)")
ax.set_ylabel("Lift (N)")
ax.set_title("Lift buildup during takeoff roll")
(line,) = ax.plot([], [], lw=3, color="#2a7de1")
point = ax.scatter([], [], color="#1b3a5c", zorder=3)


def init():
    line.set_data([], [])
    point.set_offsets(np.empty((0, 2)))
    return line, point


def update(frame):
    line.set_data(velocity[: frame + 1], lift[: frame + 1])
    point.set_offsets([[velocity[frame], lift[frame]]])
    return line, point


anim = FuncAnimation(
    fig, update, frames=len(velocity), init_func=init, interval=30, blit=True
)
anim.save(OUT_DIR / "lift_buildup.gif", writer=PillowWriter(fps=30))
print(f"Wrote {OUT_DIR / 'lift_buildup.gif'}")
