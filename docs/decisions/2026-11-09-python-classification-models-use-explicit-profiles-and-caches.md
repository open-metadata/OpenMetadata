# Python classification models use explicit profiles and isolated caches

- **Status:** Superseded by ADR:2026-11-11-python-ci-selects-workloads-by-event
- **Revisions:** v1 2026-11-09 (initial); v2 2026-11-10 (direct warming and shared preparation action); v3 2026-11-10 (independent test setup and native cache adapter); v4 2026-11-10 (standard cache actions and main-only warming); v5 2026-11-10 (disable general uv cache persistence)
- **Deciders:** Pablo Takara
- **Guard:** `ingestion/tests/unit/test_python_tooling.py`; DB2 connection tests; reviewer for workflow ordering and cache ownership
- **Related:** ADR:2026-10-27-local-python-environments-use-locked-profiles; https://github.com/open-metadata/OpenMetadata/pull/37424

## Context

Unselected direct-URL dependencies can require remote wheel metadata during locked resolution.
Keeping classification weights in the general test group therefore couples tooling bootstrap to
the model host. Exact application synchronization also removes models when a later setup step
selects a profile that excludes them. Model preparation, profile selection and cache ownership
must agree across Nox, shared setup and Actions workflows.

## Decision

### Locked environments and generation

- Retain setuptools and shared dependency composition in `ingestion/setup.py`. Nox selects groups
  and extras from `ingestion/pyproject.toml` and synchronizes `uv.lock` with `--locked`, using the
  exact `tool.uv.required-version` pin (currently 0.13.4).
- Application profiles synchronize exactly into `env/` or an explicitly selected environment.
  Tool profiles synchronize additively into separate `ingestion/.nox/` environments.
- Public Nox generation and application setup retain the checkout-local lock spanning freshness
  checks, generation and application installation. Make/Nox invokes the generator under that lock.
- Validate ANTLR against the Makefile pin before deleting outputs. Manifest version 2 binds
  generated outputs to schema, grammar, lock, Make, Nox and generator-script hashes.
- Retain the exact `sqlalchemy-ibmi==0.9.3` metadata correction required by the SQLAlchemy 2 shim,
  preserving its other driver requirements and validating dialect compatibility.

### Explicit model selection

- The `classification-models` dependency group owns all four exact URL and SHA256 requirements.
  Matching `tool.uv.dependency-metadata` entries come from hash-verified wheel METADATA; model
  updates must update that metadata and the lock together. There is no separate model manifest.
- The general `test` profile excludes weights. The `test-classification` profile selects both
  `test` and `classification-models`, with the same application extras. Every ingestion unit and
  integration Nox entrypoint selects `test-classification`; `make install_test` defaults to it.
  Suite paths and pytest filters do not determine model selection.
- Static checks use `test`; style, generation, publishing and other tooling prepare no weights.
  Installation-only tooling callers can explicitly set `PYTHON_TEST_PROFILE=test`.
- Generic synchronization does not invoke `metadata install-classification-models`. That public
  provisioning CLI remains available explicitly, and its live download test requires opt-in.
  `scripts/prepare_classification_models.py verify` checks installed versions and loads every
  declared model without a provisioning fallback.
- Complete generic/server setup before the final classification sync and verification. Any later
  application sync for unit or integration tests must reselect `test-classification`; retain exact
  synchronization rather than using additive application installs to preserve weights.

### Shared Python matrix

- `tool.openmetadata.python-environments.supported-python` in `ingestion/pyproject.toml` is the
  shared Nox and Python CI matrix, currently 3.10, 3.11 and 3.12. There is no JSON matrix file.
- Matrix discovery reads project data without importing ingestion or Nox. Model discovery uses
  the numeric maximum of that list, currently 3.12. The warmer selects its interpreter from the
  default-branch matrix and reads requested model metadata separately as data.

### Model archives and cache ownership

- Cache identity is `classification-model-v1-<uv-version>-<model-name>-<wheel-sha256>-<url-sha256>`.
  Hash the exact fragment-free lookup URL, preserving its path and query identity. Branch,
  revision and Python version do not participate; compatible interpreters share model archives.
- The helper prepares one isolated uv cache per model using pinned uv, `--no-deps` and required
  hashes. Seed the fragment-free URL with a separate hash requirement so its uv cache identity
  matches locked synchronization. Use two HTTP retries, a 60-second HTTP timeout and a 600-second
  install timeout to bound miss recovery; publish the uncompressed archive atomically.
- Consumer preparation is restore-only with exact keys and bounded preparation on misses.
  Each run uploads its own artifacts named by those keys, containing `model.tar`, with compression
  level zero and one-day retention. Consumers import all archives into the general uv cache before
  classification sync. Repeated imports and independently prepared archives must merge safely.
  Consumer preparation has no cross-run concurrency group.
- Only the default-branch `Warm classification models` workflow writes persistent model caches.
  Its separate writer workflow executes the default-branch helper and reads requested project
  metadata as data. Writers serialize by immutable model key with `queue: max` and
  `cancel-in-progress: false`, then recheck the cache after acquiring the slot. Different model
  versions have independent slots; queue overflow remains a visible cancellation.
- A successful `Classification models changed` notification warms its exact `head_sha` through
  `workflow_run`. Manual requests select an exact revision; the daily sweep deduplicates explicit
  supported branch heads and retained revision SHAs. Those lists are operational policy, not a
  model manifest. Initially only `main` is supported, with no retained revisions.
- Deploy the default-branch warmer before branch notifications. Requested revisions without the
  classification group, exact metadata and shared matrix layout are unsupported; release heads
  must adopt that layout before joining the operational list.
- Remove venv caching and its dedicated warmer. Retain general uv caching, but model jobs run
  supported `uv cache clean` for every declared model before setup-uv's post-job
  `uv cache prune --ci --force` and save. Non-model jobs need no model artifacts or cleanup.

## Consequences

Tooling can validate the universal lock without contacting the model host. Full unit and
integration suites still install and exercise all four models; their jobs pay the archive transfer
and model-loading cost. Model-free application syncs remove weights, so ordering and explicit
reselection remain necessary. Stale locks, missing metadata and incompatible requested layouts fail.

Caches are immutable, evictable acceleration rather than durable storage. Until the warmer has
saved a key, consumer runs may independently download the same model on misses. Exact URL,
wheel hash or uv-version changes create new keys without replacing older model versions.
Persistent saves, default-branch visibility and writer concurrency require hosted acceptance;
successful consumer tests alone do not establish those properties. No Collate behavior changes.

## Amendment — 2026-11-10: Direct warming and shared preparation

Relevant pushes to `main` trigger the warmer directly with `github.sha`. This replaces the
notification workflow and its `workflow_run` handoff. Manual exact revisions and the daily
supported-head/retained-revision sweep remain available. Supporting release-branch notifications
would require a separate decision; the initial operational scope remains `main`.

The `prepare-classification-models` composite action processes models sequentially in one job,
using GitHub's official cache toolkit with pinned npm dependencies. Consumer preparation and the
warmer share this action. The consumer preparation and writer reusable workflows are removed;
only the warmer remains as an added workflow. The Python test matrices remain unchanged.

Consumer jobs retain `cache-mode: read`. They upload one uncompressed, one-day `classification-models`
artifact containing `<model-cache-key>/model.tar` for each model. The existing cache identities and
the cache transport path `model-cache/model.tar` remain unchanged. Only the default-branch warmer
sets `save-cache: true` and `cache-mode: write`; failed saves fail the warmer.

The warmer resolves exact revisions, reads their project metadata with its default-branch helper,
and deduplicates model keys before sequential preparation. It uses workflow concurrency group
`classification-model-warmer`, `queue: single` and `cancel-in-progress: false`: one run executes and
one may wait. A newer request replaces the pending request, including a pending manual revision.
Different model versions remain distinct cache entries, but their warming is serialized. Both
consumer preparation and warming retain a 15-minute whole-job timeout; individual downloads
remain bounded by the helper. Requested uv pins differing from the current pin are selected with
`uv run --no-project --with uv==<pin>` on cache misses.

## Amendment — 2026-11-10: Independent test setup and native cache adapter

`install-test-dependencies` controls both test dependency synchronizations in shared setup,
independently of `classification-models`. The initial model-free `test` profile retains the existing
all/Airflow/great-expectations extras and dialect compatibility dependencies. After server setup,
the same test flag triggers synchronization, selecting `test-classification` when models are
requested and `test` otherwise. Archive import and model verification remain model-specific.

Python owns sequential preparation, uv selection, archive handling and save-result validation.
A native JavaScript action provides only the official Actions cache calls and launches Python.
The runner supplies the cache runtime environment to that native action; an ordinary shell
invocation does not receive it. The adapter fails before preparation if that runtime is absent.

## Amendment — 2026-11-10: Standard cache actions and main-only warming

Automatic warming targets only main. Manual dispatch may select one exact commit SHA; the
trusted default-branch checkout reads that revision's project metadata as data. Supported-head
and retained-revision lists, multi-revision discovery and the custom cache adapter are removed.

Preparation uses four sequential calls to a single-model composite action, with no matrix.
Discovery must return exactly four models; their requirements, uv pin and immutable keys remain
in project metadata. Python/uv setup happens once for the selected project. Simple shell steps
invoke the existing Python archive helper, stage consumer artifacts and remove staging files.
There are no custom JavaScript files, npm dependencies or Node setup steps for model preparation.

Pinned standard `actions/cache/restore` and `actions/cache/save` provide transport. Only the
warmer saves. A lookup with `fail-on-cache-miss: true` after saving makes an unavailable persistent
entry fail the warmer instead of accepting a save warning. Consumers remain restore-only and
prepare misses independently. Other branches reuse matching default-branch entries; their unique
model sets can be warmed manually. Different version keys continue to coexist.

## Amendment — 2026-11-10: Disable general uv cache persistence

Shared test setup disables setup-uv cache restore and save. The observed general-cache miss runs
spent approximately 18–20 seconds installing development and test dependencies, while one general
cache prune/save took 7.4 seconds. A controlled warm-versus-cold comparison was not available;
these measurements did not justify retaining the general cache persistence and cleanup machinery.

uv still caches packages within each job. Dedicated immutable model caches, consumer artifacts
and model cache imports remain enabled. The six consumer cleanup steps before general cache save
are removed because there is no general save. Existing remote caches are left to expire normally.
