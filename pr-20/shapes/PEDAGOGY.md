# Shape pedagogy index

A teaching-order map from elementary shapes to the load-bearing
derivations on [`harmonics`](https://github.com/nickjoven/harmonics).
Companion to the visual catalog at [`docs/shapes/`](./).

**This is pedagogy, not derivation.** Nothing here is new mathematics;
every claim is a re-presentation of work already in
`harmonics/sync_cost/derivations/`. The novelty (such as it is) is the
ordering: a beginner can be walked from a high-school parabola to the
Standard Model on this list without skipping a step.

If anything in this index looks like a new derivation, that is a bug
in the writing — file an issue.

## Reading order

| # | Shape | Identity | Load-bearing role | Derivation |
|---|---|---|---|---|
| 1 | **parabola** | y = x² + μ; roots at ±√(−μ) | saddle-node normal form ⇒ exponent 2 in \|ψ\|² | [`born_rule.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/born_rule.md) |
| 2 | **sine** | y = sin 2πθ; antisymmetric about θ = ½ | Kuramoto/circle-map coupling; half-period symmetry ↔ Möbius BC | [`circle_map.py`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/circle_map.py) |
| 3 | **half-twist** | ψ(x+L) = −ψ(x); det M = −1 | Möbius BC; recursion det = −1 forces φ² self-similarity | [`half_twist_dynamics.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/half_twist_dynamics.md), [`one_half_twist.py`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/one_half_twist.py) |
| 4 | **circle map · Arnold tongues** | θ' = θ + Ω − (K/2π)sin 2πθ | every tongue edge = parabola (#1); width ∝ K^q/q² | [`born_rule_tongues.py`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/born_rule_tongues.py), [`continuum_limits.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/continuum_limits.md) |
| 5 | **devil's staircase** | ρ(Ω) at K = 1; flat on every p/q | self-similar at φ² ⇒ spectral tilt n_s − 1 ≈ −0.035 | [`spectral_tilt.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/spectral_tilt.md) |
| 6 | **Farey · Stern-Brocot** | mediant (a+c)/(b+d); bc − ad = 1 | population law N(p/q); Ω_Λ = 13/19; SL(2,ℤ) → SL(2,ℝ) → d = 3 | [`farey_partition.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/farey_partition.md), [`mediant_derivation.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/mediant_derivation.md), [`three_dimensions.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/three_dimensions.md) |
| 7 | **Klein bottle** | two half-twists; (q₂, q₃) = (2, 3) from q₂²−1 = q₃ and q₃²−1 = q₂³ | gauge group SU(3) × SU(2) × U(1); three generations | [`klein_bottle.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/klein_bottle.md), [`farey_partition.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/farey_partition.md) |
| 8 | **golden gap** | bracket [F_n/F_{n+1}, F_{n+1}/F_{n+2}] around 1/φ | where the half-twist costs zero; φ⁴ frequency / φ⁻⁴ width uncertainty | [`half_twist_dynamics.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/half_twist_dynamics.md), [`phi_squared_zoom.py`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/phi_squared_zoom.py) |

## Through-line in one paragraph

A rational p/q on a circle is an Arnold tongue. Every tongue boundary
is a saddle-node bifurcation — the parabola y = x² + μ collapsing two
fixed points. Basin separation is Δθ ∝ √ε, so tongue width — equivalently
basin measure — is ∝ Δθ² = |ψ|². That is the Born rule. The mediant
builds the rationals; the Farey partition orders them; their widths
sum to 1 at K = 1. A half-twist at the widest gap (1/φ, between q=2
and q=3) is the Möbius boundary condition; two half-twists are the
Klein bottle. Everything else — spectral tilt at φ², Standard Model
group structure at (2,3), Einstein at K = 1, Schrödinger at K < 1 —
is bookkeeping on these shapes.

## What this catalog deliberately omits

Three things that belong to the framework but are not "elementary
shapes" in the visual sense:

- **SL(2, ℝ) characterization.** The Lie-group uniqueness is structural,
  not pictorial. See [`lie_group_characterization.md`](https://github.com/nickjoven/harmonics/blob/main/sync_cost/derivations/lie_group_characterization.md).
- **Stribeck friction curve.** Not elementary; not on the geometric
  through-line. See [`driven_stribeck.py`](https://github.com/nickjoven/harmonics/blob/main/driven_stribeck.py).
- **Higgs and mass running.** Downstream of the Klein-bottle mode
  selection; treated separately.

## How to extend the catalog

The catalog can grow when a single shape is doing load-bearing work
in **at least one** derivation on `harmonics`. Threshold for adding
a new page:

1. The shape is a one-line picture a student can draw.
2. The shape's defining equation is at most two lines.
3. There is a derivation where this shape is the structural reason
   the result holds — not just a coincidental visualization.

Candidates that meet the bar but are not yet drawn: the lemniscate
(figure-8 cross-section of the Klein immersion), the SL(2, ℤ)
fundamental domain, the φ-spiral packing.

## License

Same as the harmonics repo: CC0 1.0 Universal.
