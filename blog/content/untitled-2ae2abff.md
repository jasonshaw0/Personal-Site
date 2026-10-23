---
title: Stop Routing on Difficulty. Route on Uplift.
description: "Notes on routing between a cheap model and an expensive one: the
  signal you want isn't how hard a prompt is, it's how much the big model
  helps."
slug: untitled-2ae2abff
date: 2026-10-23
tags: []
featured: false
toc: true
status: published
---
# Stop Routing on Difficulty. Route on Uplift.
<br> 

Most LLM work doesn't need the most expensive model, so the obvious idea is to send everything to a small model and escalate the hard stuff. The standard way to automate that is a classifier that predicts "is this prompt hard?" I think that's subtly wrong, and here's how I'd set it up instead.

## The problem with "hard"

Let $q_s(x)$ and $q_l(x)$ be the quality of the small and large model's answers to prompt $x$, with costs $c_s, c_l$. Escalating is worth it when the expected gain beats the price:

$$
\underbrace{\mathbb{E}[q_l(x) - q_s(x) \mid x]}_{\Delta(x)} \;>\; \lambda\,(c_l - c_s)
$$

where $\lambda$ is how many dollars you're willing to pay per unit of quality.

The quantity that matters is the **uplift** $\Delta(x)$, not $q_s(x)$. A prompt that's too hard for both models has low $q_s$ but $\Delta \approx 0$. A difficulty classifier escalates it, and you pay large-model prices for the same bad answer. The reverse also happens: a prompt where the small model is mediocre but the large one is excellent has high uplift and should always escalate.

This changes the labels. Difficulty only needs the small model's outputs scored. Uplift needs both models' answers to the same prompts. That's more expensive up front, but it's the only label that matches the decision being made.

## Cascade, with the scorer seeing the answer

Run the small model first, score the pair $(x, y_s)$, and escalate if the score falls below $\tau$. Expected cost:

$$
C = c_s + p\,c_l, \qquad p = \Pr[s(x, y_s) < \tau]
$$

This beats always-large iff $p < 1 - c_s/c_l$. For tiers with a 10x or larger price gap, that leaves plenty of room. For a local model with near-zero marginal cost, it's almost any $p < 1$.

I prefer a cascade over deciding before generation because of information. A prompt is a weak signal about answer quality. The answer itself (logprobs where available, whether JSON parses, whether code compiles, whether repeated samples agree) is a much stronger one. The cost is latency: escalated requests pay for both calls. If tail latency matters more than money, pre-routing is the better design.

## Calibration matters more than accuracy

A threshold only means something if the score means something. Raw confidence signals tend to be overconfident, so recalibrate with isotonic regression on a held-out split. A scorer with good AUC but bad calibration gives you a $\tau$ that behaves differently from what you set.

## Picking $\tau$ without fooling yourself

The tempting move is to plot cost against quality and pick the knee, which overfits your eval set. Treat it as risk control instead. Define the per-example loss versus always-large:

$$
L_i(\tau) = \big(q_l(x_i) - q_s(x_i)\big)\,\mathbb{1}[s_i \ge \tau]
$$

This is bounded in $[-1, 1]$, so Hoeffding gives, with probability at least $1-\delta$,

$$
R(\tau) \;\le\; \frac{1}{n}\sum_{i=1}^{n} L_i(\tau) + 2\sqrt{\frac{\ln(1/\delta)}{2n}}
$$

Start at $\tau = 1$ (escalate everything, zero loss), lower it along a grid fixed in advance, and stop at the first value where the upper bound exceeds your tolerance $\varepsilon$. Because the order is fixed, there's no multiple-testing penalty. This is a simple instance of conformal risk control.

```python
import numpy as np

def pick_tau(s, q_small, q_large, eps=0.02, delta=0.05):
    n = len(s)
    slack = 2.0 * np.sqrt(np.log(1.0 / delta) / (2.0 * n))
    best = 1.0
    for tau in np.linspace(1.0, 0.0, 201):
        loss = ((q_large - q_small) * (s >= tau)).mean()
        if loss + slack > eps:
            break
        best = tau
    return best
```

## What I'd distrust

- **The guarantee assumes exchangeability.** If traffic shifts, the bound doesn't hold. It's only true for the traffic you calibrated on, so recalibrate periodically.
- **Quality is whatever your judge says it is.** If an LLM judge produces $q$, you're bounding judged quality, biases included.
- **Hard validators beat learned scores.** If the output must be valid JSON and isn't, escalate. No threshold needed.
- **Hoeffding is loose.** The bound is safe but conservative, so you'll escalate more than necessary. Tighter bounds are the obvious next step.

The takeaway: routing is a decision problem, not a classification problem. Once it's framed as "what does escalating buy me?", the labels, the cascade design, and the threshold selection all follow from that one inequality.