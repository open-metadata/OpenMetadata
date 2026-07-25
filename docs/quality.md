# Module Quality Grades

One grade per module, **each citing the specific `08a`/`08b` findings behind it**. No grade without
evidence — where the audits didn't measure a module, it is marked **Not assessed** rather than guessed.

Scale: **A** exemplary · **B** solid with bounded debt · **C** works but carries structural debt ·
**Not assessed** = insufficient audit evidence.

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
**For:** the ServiceSpec plugin contract holds at **100% (96/96 registered, 19/19 sampled full-contract)**
(08a Pass 4 / 08b P6); generated-import discipline is **99.9% type-only** (1,736/1,738; single ANTLR
runtime exception in `spline`) (08a Pass 4); ruff formatting **100%** (08b P1); bare-except **99.95%**
(08b P3). It is the module that best keeps the repo's golden principles.
**Against:** the broad-`except Exception` idiom is **75.5%** of handlers with **~86 silent swallows**
(08b P4/P5 — sanctioned, but the silent subset is real debt); a **11,927-finding** basedpyright baseline
(08b P2); one circular sibling import `mssql↔azuresql` (08a Pass 4).
**Net:** the cleanest architecture in the repo; debts are idiom-scoped and incremental, not structural.

## openmetadata-spec — B (evidence-limited)
**For:** it is the schema-first source of truth that drives all codegen, so Golden Principle #3 ("generated
is a pure sink") *depends on it* and holds at 100% (08a Pass 3+4). Clean position in the Maven DAG.
**Against:** POM hygiene — declares its `common` dependency **twice**, and the reactor `<modules>` list
puts `spec` (#1) *before* its own dependency `common` (#3) (08a Pass 1).
**Evidence limit:** 08b measured **no** convention-adherence for spec (it is JSON Schemas + generated
POJOs, not hand-written linted source), so this grade rests on 08a's structural findings only — stated
so it isn't mistaken for a lint-backed grade.

## openmetadata-service — C+
**For:** surface hygiene is excellent — spotless **100%** (08b J2), parameterized logging **100%**
(08b J3), no-wildcard **98.8%** (08b J1), and boundary validation is systematic via `EntityResource`
inheritance (08b J4).
**Against (the reason it's not a B):** it is the **most internally tangled module in the repo**.
`resources ↔ jdbi3` is a mutual cycle (**130/99**) and **18 of 21** package pairs are cyclic — only
`security/` is even a partial sink (08a Pass 2). This directly violates the repo's own #1 golden
principle *inside* the core backend. `resources/ai/` additionally grew a service/seed-loader tier fused
into the REST layer (08a Pass 2).
**Surfaced conflict:** lint-clean ≠ well-layered. By 08b metrics this module looks pristine; by 08a Pass 2
it is the least-layered. The grade weights the architecture (harder to fix, higher blast radius) over the
formatting.

## openmetadata-ui — C
**For:** the component model is disciplined — **100%** functional components, 0 class components
(08b F4); lint hygiene is high — no-console **99.96%** (08b F3), license header **99.75%** (08b F7).
**Against:** heavy architectural debt — a **130-module `components↔utils` SCC** (28 cyclic SCCs, 50 direct
2-cycles) with no import-boundary tooling (08a Pass 3); **generated-type leakage** of 1,292 direct
component/page importers vs 93 in `rest/` (13.9:1) (08a Pass 3); the **antd migration is stalled** at 864
files, 68.5% edited in the last 90 days (08b F1); and **~250–396 untranslated English strings per
non-en locale** (08b F8). `any` at 90.2% is mid (08b F2).
**Surfaced conflict:** clean on the component axis (F4) but only 36.4% on the file-naming axis (F5) — "UI
is disciplined" is true for the model, not the file conventions.

## openmetadata-mcp — Not assessed
**Only evidence:** 08a Pass 1 places it correctly in the Maven DAG (`mcp → openmetadata-service`, compile;
no back-edge, part of the acyclic graph). **08a Pass 2/3/4 and all of 08b did not sample mcp** — no
package-layering, convention-adherence, or internal-cycle measurement exists for it. Per "no grade
without evidence," it is **not graded**; the single known fact is a clean DAG position.

## openmetadata-sdk — Not assessed
**Only evidence:** 08a Pass 1 — `sdk → openmetadata-spec` (compile); consumed by
`openmetadata-integration-tests`, **not** by `openmetadata-service` (a clean client/leaf position); no
cycle. **No 08b adherence data and no deep 08a analysis.** Not graded, for the same reason as mcp.

---

### Note on the two "Not assessed" modules
This is a **coverage gap in the audits**, not a statement that mcp/sdk are low quality. 08a Pass 2/3/4
and 08b deliberately focused on the three largest surfaces (service, ui, ingestion). Grading mcp/sdk
would require a comparable pass (package layering + a convention-adherence sample). Until then, any
grade would be invention — which the "no grade without evidence" rule forbids.
