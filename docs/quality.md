# Module Quality Grades

One grade per module, **each citing the specific measurement behind it**. No grade without evidence —
where the audit didn't measure a module, it is marked **Not assessed** rather than guessed. The
measurements come from a one-time repository audit: the Maven module graph, per-language package/import
censuses, and convention-adherence counts (each reproducible by the commands in `golden-principles.md`).

Scale: **A** exemplary · **B** solid with bounded debt · **C** works but carries structural debt ·
**Not assessed** = insufficient evidence.

| Module | Grade | Evidence |
|---|---|---|
| ingestion | **B+** | strongest architectural discipline measured |
| openmetadata-spec | **B** (evidence-limited) | clean codegen foundation; minor POM hygiene |
| openmetadata-service | **C+** | pristine surface hygiene, badly tangled internals |
| openmetadata-ui | **C** | disciplined component model, heavy architectural + i18n debt |
| openmetadata-mcp | **Not assessed** | only its DAG position is known |
| openmetadata-sdk | **Not assessed** | only its DAG position is known |

---

## ingestion — B+
**For:** the ServiceSpec plugin contract holds at ~100% (**~97 connectors all registered**; **94/95
`metadata.py` carry `create()`+`InvalidSourceException` = 98.9%**); generated-import discipline is
**99.9% type-only** (1,736/1,738; single ANTLR runtime exception in `spline`); ruff formatting **100%**;
bare-except **99.95%**. It is the module that best keeps the repo's golden principles.
**Against:** the broad-`except Exception` idiom is **75.5%** of handlers with **~86 silent swallows**
(sanctioned, but the silent subset is real debt); a **11,927-finding** basedpyright baseline; one
circular sibling import `mssql↔azuresql`.
**Net:** the cleanest architecture in the repo; debts are idiom-scoped and incremental, not structural.

## openmetadata-spec — B (evidence-limited)
**For:** it is the schema-first source of truth that drives all codegen, so Golden Principle #3
("generated is a pure sink") *depends on it* and holds at 100%. Clean position in the Maven graph.
**Against:** POM hygiene — declares its `common` dependency **twice**, and the reactor `<modules>` list
puts `spec` (#1) *before* its own dependency `common` (#3).
**Evidence limit:** the convention-adherence pass measured **no** lint metrics for spec (it is JSON
Schemas + generated POJOs, not hand-written linted source), so this grade rests on the structural
(module-graph + POM) findings only — stated so it isn't mistaken for a lint-backed grade.

## openmetadata-service — C+
**For:** surface hygiene is excellent — spotless **100%**, parameterized logging **100%**, no-wildcard
**98.8%**, and boundary validation is systematic via `EntityResource` inheritance.
**Against (the reason it's not a B):** it is the **most internally tangled module in the repo**. The
package-import census found `resources ↔ jdbi3` is a mutual cycle (**130/99**) and **18 of 21** package
pairs are cyclic — only `security/` is even a partial sink. This directly violates the repo's own #1
golden principle *inside* the core backend. `resources/ai/` additionally grew a service/seed-loader tier
fused into the REST layer.
**Surfaced conflict:** lint-clean ≠ well-layered. By the lint metrics this module looks pristine; by the
package-import census it is the least-layered. The grade weights the architecture (harder to fix, higher
blast radius) over the formatting.

## openmetadata-ui — C
**For:** the component model is disciplined — **100%** functional components, 0 class components; lint
hygiene is high — no-console **99.96%**, license header **99.75%**.
**Against:** heavy architectural debt — a **130-module `components↔utils` SCC** (28 cyclic SCCs, 50 direct
2-cycles) with no import-boundary tooling; **generated-type leakage** of 1,292 direct component/page
importers vs 93 in `rest/` (13.9:1); the **antd migration is stalled** at 864 files, 68.5% edited in the
last 90 days; and **~250–396 untranslated English strings per non-en locale**. `any` at 90.2% is mid.
**Surfaced conflict:** clean on the component axis (functional-only) but only 36.4% on the file-naming
axis — "UI is disciplined" is true for the model, not the file conventions.

## openmetadata-mcp — Not assessed
**Only evidence:** the Maven module graph places it correctly (`mcp → openmetadata-service`, compile; no
back-edge, part of the acyclic graph). **The package-layering, cycle, and convention-adherence passes did
not sample mcp** — no such measurement exists for it. Per "no grade without evidence," it is **not
graded**; the single known fact is a clean DAG position.

## openmetadata-sdk — Not assessed
**Only evidence:** the Maven graph — `sdk → openmetadata-spec` (compile); consumed by
`openmetadata-integration-tests`, **not** by `openmetadata-service` (a clean client/leaf position); no
cycle. **No adherence data and no deep internal analysis.** Not graded, for the same reason as mcp.

---

### Note on the two "Not assessed" modules
This is a **coverage gap in the audit**, not a statement that mcp/sdk are low quality. The deep passes
deliberately focused on the three largest surfaces (service, ui, ingestion). Grading mcp/sdk would
require a comparable pass (package layering + a convention-adherence sample). Until then, any grade would
be invention — which the "no grade without evidence" rule forbids.
