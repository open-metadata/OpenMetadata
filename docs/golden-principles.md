# Golden Principles (DRAFT — for human ratification)

Candidates drawn from a one-time repository audit's strongest signals: the three most-consistent
inter-module/import dependency rules, and the conventions measured at high adherence with a clean
number. Nothing here without a **measured number** (the reproducing command is in each row).

**Selection rule.** The candidate pool was cut to the intersection of **high adherence AND high
cost-of-violation**, capped at ten ("more than ten means preferences"). That drops four low-cost,
auto-fixed formatting/hygiene lints — **spotless (100%)**, **ruff format (100%)**, **no-wildcard
imports (98.8%)**, **no-console (99.96%)** — which are lints to gate, not principles (see the promotion
list). **8 remain.** Ordered by cost-of-violation (highest first).

| # | Principle | Failure mode it prevents | Detection command | Adherence (measured) |
|---|---|---|---|---|
| 1 | **Modules form an acyclic, downward-only dependency graph** | Circular build/reasoning; a change in a "leaf" forcing a rebuild of the "root"; loss of module boundaries | parse each module POM's `org.open-metadata` deps for a back-edge; or `maven-enforcer` `banCircularDependencies` | **0 cycles / 12 modules = 100%** |
| 2 | **Every connector satisfies the ServiceSpec plugin contract** (`{__init__,service_spec,metadata,connection}.py` + a `Source` subclass of a `Common*`/`DatabaseServiceSource` base + `create()` raising `InvalidSourceException` + a top-level `ServiceSpec`) | A connector that silently fails to load/register at runtime | per connector dir: `find … -name service_spec.py`; assert `ServiceSpec` importable + the four files present | **~97 connectors, all registered = 100%**; **94/95 `metadata.py` carry `create()`+`InvalidSourceException` = 98.9%** |
| 3 | **Generated code is a pure sink; source imports it only as types** (no generated file imports app/domain code; no runtime `import metadata.generated…`) | Hand-edits / runtime coupling that the next `make generate` overwrites → drift, CI reverts, broken builds | `grep -rlE "from '(\.\./)+(components\|pages\|rest\|utils\|hooks\|context)/" openmetadata-ui/.../src/generated` → **0**; `grep -rn "^import metadata.generated" ingestion/src` → **0** | **0 app-imports (100% sink)**; source→generated **1,736/1,738 = 99.9%** type-only · *now hook-enforced (edit-block)* |
| 4 | **No new type errors** (basedpyright ratchet — the baseline only shrinks) | Type regressions shipping as runtime bugs | `make static-checks` (nox → basedpyright `--baselinemode=discard`) | ratchet over **11,927 baselined findings**; **0 new** required; CI-gated |
| 5 | **No bare `except:`** (catch a specific type, or at minimum name the exception) | Swallowing `KeyboardInterrupt`/`SystemExit`; hiding every error | `grep -rnE 'except\s*:' ingestion/src/metadata`; or ruff `E722` | **2,074/2,075 = 99.95%** (1 file) |
| 6 | **Functional React components only** (no class components) | Hooks-incompatible components; two divergent component models | `grep -rlE 'extends (React\.)?(Component\|PureComponent)\b' openmetadata-ui/.../src` | **0 violations = 100%** |
| 7 | **Apache-2.0 license header on every new source file** | OSS licensing / compliance gaps | `license-check-and-add check` (UI); header grep on newly-added files | **99.75%** (12/4,751 miss; 9 are generated `.js`) · *now hook-enforced for new UI files* |
| 8 | **Parameterized logging, never string concatenation** (`LOG.x("… {}", var)`) | Log-injection; needless string building; unstructured logs | `grep -rnE '(log\|LOG\|logger)\.(info\|warn\|error\|debug\|trace)\([^;]*"\s*\+' …/src/main/java` | **0/5,989 = 100%** — the lowest-cost of the eight; flagged for the ratifier |

## Conflicts to resolve before ratifying (surfaced, not decided)
- **#3 is both a strength and the biggest debt.** The `generated/` tree obeys the sink rule (imports
  nothing from the app), yet the app violates the *inbound* side massively — 1,292 components/pages
  import generated types directly vs 93 in `rest/`. The principle as stated ("generated imports
  nothing") holds at 100%; a stricter version ("app imports generated only through an API layer") is at
  ~7%. **Decide which one you're ratifying.**
- **Principles 5 and 8 are Python/Java-local.** The sibling rule "avoid broad `except Exception`" is a
  non-principle — 75.5% of Python handlers are broad, by design. Do not generalize #5 into "no broad
  catch" across languages; Python sanctions it.
- **#4 is a ratchet, not an invariant.** It reads as a principle but the code has 11,927 baselined
  findings. Ratifying "type-clean" would misrepresent the tree; ratify "no *new* type errors."

## Explicitly NOT principles (measured, but disqualified)
None had both high adherence and a clean measurement:
- **Nobody follows it:** avoid broad `except Exception` (24.5% — the deliberate ingestion idiom).
- **Low adherence / not cleanly measurable:** avoid Ant Design (81.7% antd-free, migration stalled),
  no `any` (90.2%), `.component.tsx` naming (36.4% proxy), wrap JSX strings in `t()` (unmeasurable),
  non-en locale translation (~90–94%), comments explain-why (unmeasurable), 90% coverage (ungated).
