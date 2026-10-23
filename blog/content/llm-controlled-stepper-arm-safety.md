---
title: "Letting an LLM Drive a Stepper Arm: An MCP Server with a Deterministic
  Safety Layer"
description: I exposed a 3-DOF stepper arm to an LLM agent over MCP. The model
  never emits step pulses or raw joint targets. It emits intents, and a
  deterministic layer enforces limits via constraint projection and jerk-bounded
  trajectory generation. Over TODO adversarial and fuzzed tool calls, TODO
  unsafe commands reached the moto
slug: llm-controlled-stepper-arm-safety
date: 2026-10-23
tags:
  - ML
  - Robotics
cover: /blog/images/0a55a301-6378-4082-8a2b-141f95ed1b84.png
coverAlt: Crude Diagram
featured: false
toc: true
status: published
---
## 1. Problem framing

An LLM tool call is a sample from a distribution, not a guarantee. Treat it like untrusted input:

- Arguments can be out of range, wrongly unit-scaled (deg vs rad), or semantically wrong (valid joint angles that drive the end effector into the table).
- Failures are correlated with context, so retries are not independent.
- The model can't observe missed steps unless you give it feedback.

**Design rule:** the safety property must hold for *every* possible model output, including garbage. So it can't live in the prompt. It has to live in code.

## 2. Architecture

```
LLM agent ──MCP (JSON-RPC)──► Tool layer (schema validation)
                                   │
                                   ▼
                          Safety layer (projection, limits)
                                   │
                                   ▼
                       Trajectory generator (S-curve)
                                   │ serial, framed packets
                                   ▼
                    ESP32: step generation (timer ISR), E-stop
                                   │
                                   ▼
                       A4988 ─► NEMA 17 ×3
```

| Layer | Responsibility | Trust assumption |
|---|---|---|
| Tool schema | Types, units, ranges | Rejects malformed input |
| Safety layer | Feasible-set enforcement | Assumes the model is adversarial |
| Trajectory gen | Time-optimal, jerk-limited motion | Pure function of $(q_0, q_f, \text{limits})$ |
| Firmware | Hard step-rate cap, watchdog, E-stop | Assumes the host is buggy |

Firmware limits are the last line of defense and are independent of host code.

## 3. Safety as constraint projection

Let $q \in \mathbb{R}^3$ be joint angles and $q_c$ the model's commanded target. Define the feasible set

$$
\mathcal{C} = \left\{ q \;\middle|\; q_{\min} \le q \le q_{\max},\;\; g_j(q) \ge 0 \;\; \forall j \right\}
$$

where $g_j$ are workspace constraints, such as a table plane or a keep-out sphere:

$$
g_{\text{table}}(q) = z_{\text{tip}}(q) - z_{\text{min}}, \qquad
g_{\text{sphere}}(q) = \|p(q) - c\|_2 - r
$$

Instead of rejecting infeasible commands outright, I project onto $\mathcal{C}$ under a weighted norm, then report the delta back to the model:

$$
q_{\text{safe}} = \arg\min_{q \in \mathcal{C}} \; \tfrac12 (q - q_c)^\top W (q - q_c)
$$

For box constraints alone this is just clipping. With nonlinear $g_j$ it's a small NLP, solved with a few SQP iterations (or linearized: $g_j(q_k) + \nabla g_j^\top (q - q_k) \ge 0$). **The tool result includes $\|q_{\text{safe}} - q_c\|$**, so the agent knows it was clamped. Silent clamping makes the model's world-state wrong.

Policy on the magnitude of correction $\delta = \|q_{\text{safe}} - q_c\|_W$:

$$
\text{action} =
\begin{cases}
\text{execute } q_{\text{safe}} & \delta \le \delta_{\text{soft}} \\
\text{reject, return error + feasible bounds} & \delta > \delta_{\text{soft}}
\end{cases}
$$

Large corrections signal a *misunderstanding*, not a rounding error. Executing a heavily altered command is worse than refusing.

## 4. Trajectory generation

The safe target must be reached under velocity, acceleration, and jerk bounds $(v_m, a_m, j_m)$, since stepper torque falls with speed and abrupt acceleration stalls the rotor.

**Trapezoidal profile**, for distance $d$:

$$
d_{\text{acc}} = \frac{v_m^2}{2 a_m}, \qquad
\text{profile} =
\begin{cases}
\text{trapezoid} & d \ge 2 d_{\text{acc}} \\
\text{triangle},\; v_{\text{peak}} = \sqrt{a_m d} & d < 2 d_{\text{acc}}
\end{cases}
$$

Total time in the trapezoidal case:

$$
T = \frac{d}{v_m} + \frac{v_m}{a_m}
$$

**Multi-joint synchronization:** compute each joint's minimum time $T_i$, then set $T = \max_i T_i$ and scale the others so all joints arrive together. This keeps the end-effector path near the straight line in joint space.

**Step-rate mapping.** With joint-space velocity $\dot q_i$, microstepping $m$, and reduction $N_i$:

$$
f_{\text{step},i} = \frac{\dot q_i}{\alpha}\, m\, N_i, \qquad \alpha = \frac{2\pi}{200}\ \text{rad/step}
$$

A4988 constraint: $f_{\text{step}} \le f_{\max}$, where $f_{\max}$ comes from the torque-speed curve at your supply voltage and current limit (**TODO: measured stall frequency**), not from the datasheet's timing limit, which is much higher than what the motor can follow.

## 5. Reliability model for the agent loop

Let $p_f$ be the per-call probability the model emits an invalid command, and $c$ the safety layer's detection coverage (fraction of invalid commands caught). The probability an unsafe command reaches the motors per call:

$$
P_{\text{unsafe}} = p_f (1 - c)
$$

Safety-layer work therefore reduces risk multiplicatively and doesn't depend on model improvements. With $k$ retries after rejection (feeding the error back into context), and assuming conditional independence (optimistic):

$$
P_{\text{task fail}} \approx p_{\text{rej}}^{\,k+1}
$$

In practice retries are correlated, so I measure the empirical pass@k rather than trusting the independence model. A useful diagnostic is the ratio

$$
\rho = \frac{P_{\text{fail}}^{\text{measured}}}{p_{\text{rej}}^{\,k+1}}
$$

$\rho \gg 1$ means the model repeats the same mistake and error messages need to be more informative, not just present.

## 6. Implementation

Tool design principle: **intent-level, unit-explicit, bounded.**

```python
# server.py
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field
import numpy as np

mcp = FastMCP("stepper-arm")

Q_MIN = np.deg2rad([-90, -10, -120])
Q_MAX = np.deg2rad([ 90, 100,  120])
V_M, A_M = 1.0, 3.0          # rad/s, rad/s^2  (TODO: from stall tests)
DELTA_SOFT = np.deg2rad(5.0)
W = np.diag([1.0, 1.0, 0.5])

class MoveResult(BaseModel):
    executed: bool
    q_safe_deg: list[float]
    clamped_deg: float = Field(description="||q_safe - q_cmd||_W in degrees")
    duration_s: float
    message: str

def project(q_cmd: np.ndarray) -> np.ndarray:
    q = np.clip(q_cmd, Q_MIN, Q_MAX)
    # TODO: add nonlinear workspace constraints (table, keep-out) via SQP
    return q

def sync_duration(dq: np.ndarray) -> float:
    d = np.abs(dq)
    d_acc = V_M**2 / (2 * A_M)
    t = np.where(d >= 2 * d_acc, d / V_M + V_M / A_M, 2 * np.sqrt(d / A_M))
    return float(t.max())

@mcp.tool()
def move_joints_deg(joints_deg: list[float]) -> MoveResult:
    """Move the 3 joints to absolute angles in DEGREES.
    Limits: j1 [-90,90], j2 [-10,100], j3 [-120,120].
    Commands are clamped to limits and rejected if the clamp is large."""
    if len(joints_deg) != 3 or not np.all(np.isfinite(joints_deg)):
        return MoveResult(executed=False, q_safe_deg=[], clamped_deg=0,
                          duration_s=0, message="Need 3 finite values (deg).")
    q_cmd = np.deg2rad(joints_deg)
    q_safe = project(q_cmd)
    e = q_safe - q_cmd
    delta = float(np.sqrt(e @ W @ e))
    if delta > DELTA_SOFT:
        return MoveResult(executed=False, q_safe_deg=np.rad2deg(q_safe).tolist(),
                          clamped_deg=float(np.rad2deg(delta)), duration_s=0,
                          message=f"Rejected: target outside limits by {np.rad2deg(delta):.1f} deg.")
    T = sync_duration(q_safe - current_q())     # current_q(): last confirmed pose
    send_trajectory(q_safe, T)                  # framed serial packet to ESP32
    return MoveResult(executed=True, q_safe_deg=np.rad2deg(q_safe).tolist(),
                      clamped_deg=float(np.rad2deg(delta)), duration_s=T,
                      message="OK")

if __name__ == "__main__":
    mcp.run()
```

Firmware-side invariants (ESP32), independent of the host:

- Hard cap on step rate per axis, enforced in the timer ISR.
- Host heartbeat watchdog: no packet for $\tau_w$ ms means decelerate and disable drivers.
- Software travel limits in step counts, plus a homing switch for absolute reference.

## 7. Feedback: closing the model's world-state loop

Open-loop steppers can lose steps silently, so the LLM's belief about arm pose can diverge from reality. Mitigations:

1. **Encoders** (AS5600 on each joint) with a reconciliation step: $\|q_{\text{enc}} - q_{\text{cmd}}\| > \epsilon$ triggers a fault flag in the tool response.
2. A `get_state` tool returning measured pose and fault flags, so the agent can verify instead of assuming.
3. Camera-based tip pose as an independent check (cross-references the encoder).

## 8. Evaluation

| Test | Method | Result |
|---|---|---|
| Fuzzed args (NaN, inf, wrong length, huge values) | Hypothesis property tests | **TODO** |
| Unit confusion (rad passed as deg) | Targeted prompts, 200 runs | **TODO** unsafe executed |
| Adversarial prompt injection via tool output text | Red-team prompts | **TODO** |
| Pick-and-place task success | 50 trials, natural language | **TODO** % |
| Mean tool calls per task / retry rate | Logged | **TODO** |
| Added latency from safety layer | Timed | **TODO** ms |

Property test worth having: for any input $q_c \in \mathbb{R}^3 \cup \{\text{NaN}, \pm\infty\}$, the emitted trajectory satisfies $q(t) \in \mathcal{C}$, $|\dot q| \le v_m$, $|\ddot q| \le a_m$ for all $t$.

## 9. Limitations

- **Projection is not planning.** Clipping each waypoint doesn't guarantee the *path* between waypoints is collision-free. Joint-space interpolation can still sweep through a keep-out region. Check swept volume or sample the trajectory.
- **Semantic errors pass validation.** The model can command a perfectly safe, perfectly wrong move. This layer protects hardware, not task correctness.
- **Tool-output injection.** Anything returned to the model (camera captions, file contents) is an injection vector. Keep tool outputs structured and free of free-form text from untrusted sources.
- **Single-process trust.** If the MCP server process is compromised, only the firmware invariants remain. That's why they exist.
