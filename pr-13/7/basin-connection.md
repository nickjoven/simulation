# Basin 1/1 connection exploration

## Status

**Proposed.** Simulation specification, not a result. Motivated by
a session observation that the structures around the dominant 1/1
Farey peak were mis-identified as "cantori" / "island chains" when
the actual mechanism is gradient descent on ψ_F. The observation
still points at something real — the connection topology between
the 1/1 basin and its neighbors — but in different language. This
file specifies the correctly-framed local study.

## Simulation dynamics (mechanism note)

The Farey-trap visualizer (`github.com/nickjoven/simulation`, `docs/7`)
runs gradient descent on the static potential
ψ_F = Σ K·G(p/q)/q², a sum of Gaussian bumps at Farey rationals.
Update rule: `tmpP.addScaledVector(∇ψ_F, -σ · γ · dt)`. K is peak
amplitude, γ is step size, σ is descent-direction sign. gain, STEPS,
τ_max, bake N are visualization-only. See `klein_nodal_parity.md`
for the full parameter-semantics table; the two studies share it.

## Motivation

The 1/1 Farey peak (equivalently the 0/1 peak, modular wrap) is the
highest-weight attractor in ψ_F: weight K/q² = K at q = 1, larger
than any other peak. Most sessions have biased ω_rot toward this
peak, so the 1/1 basin dominated the visible structure. Everything
else — stable-manifold filaments, adjacent small basins, saddle
ridges between 1/1 and its neighbors — was classified under twist-
map language (cantorus, island chain) that does not apply.

The correct object of study is:

- The **basin of attraction of 1/1** under gradient descent on ψ_F
- Its **topology** (connected, simply connected, or with holes)
- Its **boundary** (ridges / separatrices connecting to neighboring
  peaks 1/2, 1/3, 2/3 at Q = 3; and the Farey neighbors of 1/1 at
  higher Q)
- **Saddle points** on the basin boundary and their stable manifolds
- How these change as K, Q, ω_rot vary

## Specification

### Baseline configuration

| Parameter | Value | Purpose |
|---|---|---|
| Q | 19 | Farey sequence depth with enough neighbors to map structure |
| K | 0.67 | Sub-critical regime where basin boundaries are visible |
| σ | −Farey peaks (σ = −1, climb to maxima) | Seeds land at peak centers |
| ω_rot | 0 | Static potential; no time rotation |
| σ_θ, σ_r | 0.22, 0.05 | Narrow enough to resolve basin interior structure |
| r_eq | 0.5 | Mid-radius, avoiding pole/equator projection artefacts |
| γ | sweep: 1, 3, 10, 20 | Intra-basin vs inter-basin resolution |
| gain, STEPS, τ_max | cosmetic; match previous runs | Visualization only |

### Primary observables

1. **Basin coverage**: at equilibrium, what fraction of the sphere
   drains into the 1/1 peak vs each neighbor. A coarse grid of
   ICs sampled uniformly over (θ, φ), each traced to its eventual
   attractor. Produces a **basin map**: a coloring of IC space by
   which peak it ends in.

2. **Boundary curves**: loci of ICs that don't commit — they lie on
   the stable manifolds of saddle points between basins. These are
   measure-zero in IC space, but visible as narrow strips or fractal
   structure in the basin map.

3. **Saddle-point locations**: ridges of ψ_F at the mediants between
   neighboring Farey peaks. The first-level saddles are at Farey
   mediants (1/2 between 0/1 and 1/1; 2/3 between 1/2 and 1/1; etc.).
   Verify by locating ∇ψ_F = 0 with Hessian signature (1, 1, 0)
   numerically.

4. **Connection topology**: which peaks share basin boundaries with
   1/1 directly? Farey-tree theory predicts 1/1 shares boundaries
   only with its Farey neighbors in F_Q; non-neighbors should be
   separated by at least one intermediate basin.

### Secondary observables

1. **Ridge length and depth**: the saddle-to-saddle arc between 1/1
   and each neighbor. Length and ψ_F value along the ridge. Under
   the Farey-tree structure, ridges between close-denominator
   neighbors should be shorter / shallower than between distant
   ones.

2. **γ-dependence of the boundary**: at small γ, seeds near a ridge
   descend slowly and may be visible along it. At large γ, seeds jump
   across the ridge to whichever basin is nearer in step-space. The
   effective boundary shifts with γ. Mapping this shift as a function
   of γ / ridge-height ratio tests whether γ is a clean scale knob.

3. **ω_rot-dependence (optional extension)**: if ω_rot is turned on,
   the 1/1 basin rotates around the chosen axis, and saddles connect
   different peak-pairs at different times. The time-averaged basin
   map is a different object from the static one.

## Predicted structure

Under pure gradient descent on ψ_F with K/q² peak weights:

1. **1/1 basin is the largest.** Its coverage fraction at Q = 19
   should dominate, proportional to the neighborhood where K/1² is
   the nearest dominant attractor. Expected: ~50%+ of IC space.

2. **Direct Farey neighbors of 1/1 share ridges.** In F_19, the
   immediate Farey neighbors of 1/1 (= 0/1 under modular wrap) are
   1/19 and 18/19. These should have direct basin boundaries with
   1/1.

3. **Mediant-generated sub-neighbors** are the next layer. Between
   0/1 and 1/19, the mediant is 1/20 (outside F_19); between 0/1
   and 1/18, the mediant is 1/19 (inside). Basin topology follows
   the Stern-Brocot tree locally.

4. **Saddle heights are predictable.** A saddle between peaks of
   weight K/q₁² and K/q₂² has ψ_F value approximately
   (K/q₁² + K/q₂²)/2 at symmetric location if the Gaussian widths
   are equal. Measurable directly; if matches prediction,
   establishes that the landscape is additive-Gaussian and the
   session's peak-weight derivation is consistent.

## Upgrade criterion

The framework doesn't currently have a derivation tying basin-boundary
topology to its primary integers. If the basin map at Q = 19 shows:

- The Ω partition (1:5:13/19) as a tiered basin-size distribution
- Fibonacci neighbors of 1/1 as preferred boundary partners
- Saddle heights matching (K/q₁² + K/q₂²)/2

…then this file upgrades to a derivation with content. Until then
it's a proposed study only.

## What NOT to claim

Same discipline as `klein_nodal_parity.md`:

1. Basin boundaries are **not cantori**. They are gradient-flow
   separatrices. Reflecting the language choice.

2. The study is **not a KAM / twist-map measurement**. Anything
   phrased as "K_c" or "Lyapunov" in the results is a category
   error.

3. Connection topology to the 1/1 basin is an **observation about
   the landscape ψ_F**, not about an underlying Arnold-tongue
   diagram. These produce similar shapes but are different objects.

## Cross-references

| File | Role |
|---|---|
| `klein_nodal_parity.md` | Full parameter-semantics table; topology-of-nodal-set sibling test |
| `baryon_fraction.md` | Ω partition derivation; basin-map should see 1:5:13 |
| `framework_status.md` | Logged under Proposed; retracted twist-map framings under Eliminated |
