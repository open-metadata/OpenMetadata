# Golden Principles (DRAFT — for human ratification)

Candidates drawn **only** from the two audits' strongest signals: `08a-topology.md`'s three
most-consistent dependency rules (its Synthesis) and `08b-adherence.md`'s **ENFORCE** verdicts.
Nothing here without a **measured number from 08b/08a**.

**Selection rule.** The pool was 12 (3 dependency rules + the ENFORCE verdicts J1, J2, J3, P1, P2,
P3, P6, F3, F4, F7 — with P6 and dependency-rule-2 being the same principle, merged). The cap is ten;
"more than ten means preferences." Cut to the intersection of **high adherence AND high cost-of-
violation**, which drops the four low-cost formatting/hygiene lints — **J2 spotless (100%)**,
**P1 ruff (100%)**, **J1 no-wildcard (98.8%)**, **F3 no-console (99.96%)** — they are auto-fixed,
low-blast-radius lints, not principles. They belong in `08e-promotion-list.md`, not here. **8 remain.**

Ordered by cost-of-violation (highest first).

| # | Principle | Failure mode it prevents | Detection command | Adherence (08b/08a) | Source |
|---|---|---|---|---|---|
| 1 | **Modules form an acyclic, downward-only dependency graph** | Circular build/reasoning; a change in a "leaf" forcing a rebuild of the "root"; loss of module boundaries | parse each module POM's `org.open-metadata` deps for a back-edge; or `maven-enforcer` `banCircularDependencies` | **0 cycles / 12 modules = 100%** | 08a Pass 1 + Synthesis rule 1 |
| 2 | **Every connector satisfies the ServiceSpec plugin contract** (`{__init__,service_spec,metadata,connection}.py` + a `Source` subclass of a `Common*`/`DatabaseServiceSource` base + `create()` raising `InvalidSourceException` + a top-level `ServiceSpec`) | A connector that silently fails to load/register at runtime | per connector dir: `find … -name service_spec.py`; assert `ServiceSpec` importable + the four files present | **96/96 registered = 100%** (19/19 sampled full-contract) | 08a Pass 4 + Synthesis rule 2 = 08b **P6** |
| 3 | **Generated code is a pure sink; source imports it only as types** (no generated file imports app/domain code; no runtime `import metadata.generated…`) | Hand-edits / runtime coupling that the next `make generate` overwrites → drift, CI reverts, broken builds | `grep -rlE "from '(\.\./)+(components\|pages\|rest\|utils\|hooks\|context)/" openmetadata-ui/.../src/generated` → **0**; `grep -rn "^import metadata.generated" ingestion/src` → **0** | **0 app-imports (100% sink)**; source→generated **1,736/1,738 = 99.9%** type-only | 08a Pass 3+4 + Synthesis rule 3 · *now hook-enforced (04 §generated)* |
| 4 | **No new type errors** (basedpyright ratchet — the baseline only shrinks) | Type regressions shipping as runtime bugs | `make static-checks` (nox → basedpyright `--baselinemode=discard`) | ratchet over **11,927 baselined findings**; **0 new** required; CI-gated | 08b **P2** (frame honestly as a ratchet, *not* "zero errors") |
| 5 | **No bare `except:`** (catch a specific type, or at minimum name the exception) | Swallowing `KeyboardInterrupt`/`SystemExit`; hiding every error | `grep -rnE 'except\s*:' ingestion/src/metadata`; or ruff `E722` | **2,074/2,075 = 99.95%** (1 file) | 08b **P3** |
| 6 | **Functional React components only** (no class components) | Hooks-incompatible components; two divergent component models | `grep -rlE 'extends (React\.)?(Component\|PureComponent)\b' openmetadata-ui/.../src` | **0 violations = 100%** | 08b **F4** |
| 7 | **Apache-2.0 license header on every new source file** | OSS licensing / compliance gaps | `license-check-and-add check` (UI); header grep on newly-added files | **99.75%** (12/4,751 miss; 9 are generated `.js`) | 08b **F7** · *now hook-enforced for new UI files (04 §pre-commit)* |
| 8 | **Parameterized logging, never string concatenation** (`LOG.x("… {}", var)`) | Log-injection; needless string building; unstructured logs | `grep -rnE '(log\|LOG\|logger)\.(info\|warn\|error\|debug\|trace)\([^;]*"\s*\+' …/src/main/java` | **0/5,989 = 100%** | 08b **J3** — *the lowest-cost of the eight; flagged for the ratifier* |

## Conflicts to resolve before ratifying (surfaced, not decided)
- **#3 is both a strength and the biggest debt.** The `generated/` tree obeys the sink rule (imports
  nothing from the app), yet the app violates the *inbound* side massively — 1,292 components/pages
  import generated types directly vs 93 in `rest/` (08a Pass 3). The principle as stated ("generated
  imports nothing") holds at 100%; a stricter version ("app imports generated only through an API
  layer") is at ~7%. **Decide which one you're ratifying.**
- **Principle 5/#8 are Python/Java-local.** The sibling rule "avoid broad `except Exception`" is a
  **DROP** (08b P4 — 75.5% of Python handlers are broad, by design). Do not generalize #5 into "no
  broad catch" across languages; Python sanctions it.
- **#4 is a ratchet, not an invariant.** It reads as a principle but the code has 11,927 baselined
  findings. Ratifying "type-clean" would misrepresent the tree; ratify "no *new* type errors."

## Explicitly NOT principles (measured, but disqualified)
- **DROP:** P4 avoid-broad-except (24.5%). **DOCUMENT (low/unmeasurable):** F1 antd (81.7%), F2 no-any
  (90.2%), F5 naming (36.4% proxy), F6 t() (unmeasurable), F8 locale-translation (~90–94%), X1
  comments, X2 coverage (ungated). None has both high adherence and a clean measurement — see 08b.
