# Forking Apache Jena and owning the Fuseki image pipeline

**Status:** proposal — decisions open
**Date:** 2026-09-22

## Goal

1. Clone `github.com/apache/jena` into the OpenMetadata org and keep it continuously synced.
2. Cut our own release whenever Jena releases.
3. Publish a Fuseki image to Docker Hub.
4. Let OpenMetadata and Collate each pass their own config so Fuseki serves the dataset they name.

## Recommendation: split this into two tracks

Goals 2–4 do not require goal 1. They are satisfied today by `docker/rdf-store/`, which downloads
the released Fuseki tarball, compiles our `FusekiAutoModule` against it, and ships an image; a build
of it on 2026-09-22 met every guarantee OpenMetadata probes for. Only **goal 1 needs the source
fork**, and the fork is the expensive part.

| | Track A — image pipeline | Track B — source fork |
|---|---|---|
| Unblocks | goals 2, 3, 4 | carrying patches to Jena internals |
| Work | days | ongoing, indefinitely |
| Prerequisite | none | Track A |

Track A should proceed now regardless. Track B is a separate decision that turns on one question,
below. This document specifies both; they can be executed independently.

## Track B decision input

### What the fork buys

1. **Carrying patches to Jena internals.** There is already one candidate: with `arq:updateTimeout`
   set, Jena 6.2.0 mishandles the second WHERE-bearing operation in a single update request. We work
   around it today by constraining OpenMetadata's generated SPARQL to one such operation and
   rejecting anything else at the admin API. A patched Jena would remove that constraint.
2. **CVE turnaround.** 6.2.0 is pinned for CVE-2026-61372; we waited for the ASF release. A fork can
   ship a backport the same day.
3. **Release independence** from the ASF cadence.

### What the fork costs

Measured 2026-09-22:

- **479 MB repo, 28 top-level Maven modules**, full build including `jena-integration-tests`.
- **~70 commits/month on `main`** upstream to keep merging.
- **~4 releases/year** — Jena ships roughly quarterly: 5.0.0 (2024-03), 5.1.0 (2024-07),
  5.2.0 (2024-10), 5.3.0 (2025-01), 5.4.0 (2025-04), 5.5.0 (2025-07), 5.6.0 (2025-10),
  6.0.0 (2026-01), 6.1.0 (2026-05), 6.2.0 (2026-07). Every carried patch is re-merged at least that
  often, forever.

### The question that decides it

**Do we intend to modify Jena source?** If yes, fork — the `updateTimeout` bug alone may justify it.
If the goal is only "our own image, our own schedule, our own config", Track A delivers that and the
fork is 479 MB of permanent merge liability for no gain.

## Trademark and licensing constraints (apply to both tracks)

Jena is Apache-2.0, so forking and redistributing is permitted. Naming is the constrained part:

- **"Apache Jena" is an ASF trademark and only the ASF makes Apache Jena releases.** Our artifacts
  must not be named or described in a way that implies they are official. Call the image
  `openmetadata/fuseki`, not `openmetadata/apache-jena-fuseki`, and describe it as "Apache Jena
  Fuseki packaged for OpenMetadata" rather than as a Jena release.
- **Version numbers must not masquerade as Jena's.** Tag `2.0.3` or `2.0.3-fuseki6.2.0`, never a bare
  `6.2.0` that reads as an ASF artifact.
- **`LICENSE` and `NOTICE` must propagate** into the image and any redistributed jar, with our
  modifications stated. The upstream tarball carries both.
- The fork's `README` should state plainly that it is a downstream fork, not an ASF distribution, and
  point at `apache/jena` for upstream issues.

Worth a short review with whoever handles licensing before the first publish. This is a naming and
attribution exercise, not a blocker.

## Track A — the image pipeline

### A1. Inject the dataset config at container start

This is goal 4, and it stays **one image**. Today `config.ttl` and `shiro.ini.template` both hardcode
the `openmetadata` family. Templating both on a single variable lets OpenMetadata and Collate each
name their own dataset without a second image or a forked config file.

They must be templated **together**: `shiro.ini`'s `[urls]` block lists
`/openmetadata`, `/openmetadata_a`, `/openmetadata_b` explicitly, so changing the dataset name in
`config.ttl` alone drops every request through to the `roles[admin]` catch-all and the writer account
starts getting 403s. One variable driving both files removes that failure mode by construction.

Rename `config.ttl` → `config.ttl.template` and substitute the family:

```turtle
<#${RDF_DATASET_FAMILY}> rdf:type fuseki:Service ;
    fuseki:name "${RDF_DATASET_FAMILY}" ;
    fuseki:serviceReadWriteGraphStore "data" ;
    fuseki:dataset <#dataset> .

<#tdb_dataset> rdf:type tdb2:DatasetTDB2 ;
    tdb2:location "/fuseki-data/${RDF_DATASET_FAMILY}" ;
    tdb2:unionDefaultGraph true ;
    ja:context <#queryDeadline>, <#updateDeadline> .
```

and the same for `_a` / `_b`. In `shiro.ini.template`:

```ini
/${RDF_DATASET_FAMILY}/data   = authcBasic, roles[writer]
/${RDF_DATASET_FAMILY}_a/data = authcBasic, roles[writer]
/${RDF_DATASET_FAMILY}_b/data = authcBasic, roles[writer]
```

`entrypoint.sh` already runs `envsubst` for the passwords; extend it to render `config.ttl` too, and
parameterize the legacy-layout guard, which currently hardcodes
`DATASET_TDB2_DIR="${LEGACY_TDB2_DIR}/openmetadata"`. Default `RDF_DATASET_FAMILY=openmetadata` in the
Dockerfile so existing deployments are unaffected.

**Validated 2026-09-22.** Both families were rendered from these templates. The `openmetadata`
render is byte-identical to today's shipped `config.ttl` (`diff` clean), so the default path cannot
regress; the `collate` render produces `collate`, `collate_a`, `collate_b` with 15 matching shiro
rules. Booting Fuseki 6.0.0 against the rendered `collate` config created all six directories
unprompted, answered `Allow: GET,HEAD,OPTIONS,PUT,POST`, and confirmed union by writing to a named
graph and counting 1 from the default graph.

Deployments then set one variable — `RDF_DATASET_FAMILY=openmetadata` or `=collate` — matching
`RDF_ENDPOINT`. `RdfDatasetNames` derives the blue/green alternates as `<base>_a` / `<base>_b`, so the
family name is the only input.

For operators who need more than a rename (custom Lucene fields, extra services), mounting a full
assembler over `/fuseki/config.ttl` must keep working as the escape hatch.

### A2. Publish to Docker Hub

There is **no official ASF Fuseki image** — `apache/jena-fuseki` does not exist on Docker Hub, and the
`apache` org has no Jena repository at all. The community options are `stain/jena-fuseki` (last
pushed 2024-07-31) and `secoresearch/fuseki`. Publishing ours is filling a real gap, not duplicating
an upstream artifact.

Decisions needed:

- **Repository name.** `docker/rdf-store/kubernetes/fuseki-deployment.yaml:59` already references
  `openmetadata/fuseki-rdf:latest`, which does not exist. Either create that repo or rename the
  manifest — they must agree. Subject to the trademark note above.
- **Tags.** `<om-release>` and `<om-release>-fuseki<jena-version>`; move `latest` only on GA. The
  extension changes independently of Jena, so a bare Fuseki version is not a sufficient tag.
- **Triggers.** Release tags, plus a `paths:` filter on `docker/rdf-store/**` — the extension is
  compiled against the pinned `fuseki-server.jar` and must be rebuilt when either moves.
- **Platforms.** `linux/amd64,linux/arm64`. Image is ~393 MB per platform.

The workflow is a `docker/build-push-action` step with `context: docker/rdf-store`. It does not
exist yet: `.github/workflows/**` is a supply-chain surface in this repo, and adding it needs
explicit maintainer sign-off.

## Track B — the source fork

### B1. Repository

Fork `apache/jena` to `open-metadata/jena` (GitHub's fork relationship gives cheap upstream syncing
and keeps provenance visible). Protect `main`.

### B2. Branch model

| Branch | Contents |
|---|---|
| `upstream-main` | pure mirror of `apache/jena@main`, never committed to directly |
| `main` | `upstream-main` + our carried patches |
| `release/<jena-version>` | cut from the matching upstream release tag + our patches |

Keeping a pristine mirror branch is what makes conflicts legible: a sync that fails on
`upstream-main` is a fetch problem, a conflict on `main` is genuinely ours.

### B3. Continuous sync

A scheduled workflow (daily is ample at ~2.3 commits/day upstream):

1. Fetch `apache/jena@main` into `upstream-main` and fast-forward.
2. Rebase or merge `main` onto `upstream-main`.
3. On conflict, open a PR and stop — never auto-resolve.
4. Build `jena-fuseki2` and run its tests; a green build is the sync's acceptance test.

Prefer **merge over rebase** for `main` so carried patches keep a stable history and reviewers can
see what we changed. Rebase only `release/*` branches, which are short-lived.

Each carried patch should be a single commit with an `UPSTREAM:` trailer recording whether it has
been submitted to Jena. Every patch's goal is to be upstreamed and dropped; a patch with no upstream
ticket is a patch we will be re-merging four times a year indefinitely.

### B4. Release process

On a Jena release tag:

1. Cut `release/<version>` from the upstream tag.
2. Cherry-pick carried patches; drop any that landed upstream.
3. Build and run `jena-integration-tests`.
4. Publish our artifacts under our own name and version (see trademark constraints).
5. Repoint `docker/rdf-store/Dockerfile` — this is where the tracks meet.

### B5. Where the fork changes the image build

`docker/rdf-store/Dockerfile` currently downloads the ASF tarball and verifies a pinned SHA-512:

```dockerfile
ENV FUSEKI_VERSION=6.2.0
ENV FUSEKI_SHA512=ba65f586...
RUN wget -q https://archive.apache.org/dist/jena/binaries/apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
    && echo "${FUSEKI_SHA512}  apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz" | sha512sum -c -
```

With a fork it consumes our build instead. **Keep the checksum discipline** — pin and verify whatever
artifact replaces the tarball. That check is the reason a tampered or truncated mirror can never
become the production triple store, and it should not be lost in the switch to an internal source.

## Open decisions

1. Do we intend to patch Jena source? (Decides Track B entirely.)
2. Docker Hub repository name, reconciled with `fuseki-deployment.yaml:59`.
3. Tag scheme.
4. Authorization to add the publish workflow under `.github/workflows/`.
5. Licensing review of the image name, `NOTICE` propagation, and release naming.

## Related

- [rdf-fuseki-image-release.md](../rdf-fuseki-image-release.md) — building, publishing and deploying
  the image as it exists today; the readiness probe and cutover runbook.
- [rdf-production-setup.md](../rdf-production-setup.md) — sizing, tuning, `--loc` → `--config` migration.
