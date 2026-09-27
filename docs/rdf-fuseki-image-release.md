# Building and publishing the OpenMetadata Fuseki image

`docker/rdf-store/` builds the recommended triple store for OpenMetadata. This document covers
building it, publishing it, and cutting an existing deployment over to it.

**One image serves every distribution.** OpenMetadata and Collate both use it unchanged — the
dataset family is fixed at `openmetadata` / `openmetadata_a` / `openmetadata_b`, and the deployment
selects it with `RDF_ENDPOINT`. Do not fork the image to rename datasets: `shiro.ini.template`
hardcodes those three paths in its `[urls]` section, so a rename silently drops every request to the
`roles[admin]` catch-all and the `openmetadata` writer account starts getting 403s.

For sizing, tuning and the `--loc` → `--config` data migration, see
[rdf-production-setup.md](rdf-production-setup.md).

## What the image adds over stock Fuseki

Before indexing, `JenaFusekiStorage.ensureStorageReady` checks the dataset in two steps.

**1. `OPTIONS <server>/<dataset>/data`**, read by `FusekiWriteCapabilities.negotiate`. The
OpenMetadata Graph Store extension in this image adds five headers to the response:

| Header | Guarantee met when | Set by |
|---|---|---|
| `X-OpenMetadata-Query-Timeout-Ms` | `> 0` | assembler `arq:queryTimeout` |
| `X-OpenMetadata-Update-Timeout-Ms` | `> 0` | assembler `arq:updateTimeout` |
| `X-OpenMetadata-Write-Timeout-Ms` | `> 0` | `openmetadata.fuseki.writeTimeoutMs` (default 50000) |
| `X-OpenMetadata-Max-Upload-Bytes` | `> 0` | `openmetadata.fuseki.maxUploadBytes` (default 64 MiB) |
| `X-OpenMetadata-Union-Default-Graph` | not judged from the header; see step 2 | assembler `tdb2:unionDefaultGraph true` |

Only `BoundedGraphStore.doOptions` in the extension emits them, and the extension registers against
`Operation.GSP_RW` only. The extension is optional. Without it, or when one of the first four
guarantees is unmet, indexing continues with the client's own upload budget and deadline and logs
`RDF dataset <endpoint> lacks guarantees OpenMetadata relies on at scale; indexing continues: ...`,
naming each gap. What is lost is real: stock Fuseki holds TDB2's writer while a Graph Store upload
transfers, so a small update issued during a 4.4 MB upload at 200 KB/s waited 20 s, against 0.23 s
with the extension. `arq:updateTimeout` does not cover Graph Store uploads.

**2. A union probe** (`UnionDefaultGraphProbe`), run on every Fuseki. Readiness writes one triple
into a named graph with SPARQL Update, asks for it without a `GRAPH` clause, and deletes it
whatever the answer. OpenMetadata writes every entity into a named graph, while the SPARQL
playground, the MCP tools, SHACL validation and inference read without `GRAPH`, so they see indexed
data only when `tdb2:unionDefaultGraph` is on. The write also proves the dataset accepts SPARQL
updates. Each probe uses its own subject, so servers probing at the same time never see or delete
each other's triple.

Readiness fails the run, before any data is cleared, only when the dataset cannot be used:

| Check | Response | Failure |
|---|---|---|
| `OPTIONS` | `401` | `Fuseki rejected the RDF credentials for <endpoint> (HTTP 401) ...` |
| `OPTIONS` | `403` | `The RDF user is not authorized for <endpoint> (HTTP 403) ...` |
| `OPTIONS` | `404`, or `2xx` with neither extension headers nor `Fuseki-Request-Id` | `Fuseki dataset '<name>' does not exist at <server> (...)` |
| `OPTIONS` | `2xx` with an `Allow` that omits `POST` | `Fuseki dataset '<name>' at <server> is read-only (its Graph Store allows GET,HEAD,OPTIONS) ...` |
| `OPTIONS` | any other error status | `Fuseki dataset endpoint <endpoint> is not usable (HTTP <status>)` |
| probe | the update is refused, e.g. `400 No operation for request` from a dataset without an update service | `Fuseki dataset '<name>' at <server> did not accept a SPARQL update (HTTP <status>) ...` |
| probe | the triple is not visible without `GRAPH` | `Fuseki dataset '<name>' at <server> does not enable tdb2:unionDefaultGraph ...` |

The `2xx` rows exist because Jetty answers `OPTIONS` with 200 on any path; only a Fuseki service
handling the request adds `Fuseki-Request-Id`, and Fuseki's read-only Graph Store (`GSP_R`) answers
`Allow: GET,HEAD,OPTIONS`.

2.0.2 treated all five guarantees as mandatory. Every stock Fuseki failed with
`RDF storage is not ready: Fuseki dataset requires the OpenMetadata Graph Store extension and
unionDefaultGraph=true` in under a second, with an empty `failedEntities` and
`projectionState: DEGRADED`, and the same message stood in for a missing dataset.

Fuseki logs nothing about loaded modules — a boot log is byte-identical with and without the
extension. The `OPTIONS` response is the only way to tell.

## What the image contains

- **Fuseki 6.2.0** on `eclipse-temurin:21-jre-jammy`, downloaded from `archive.apache.org` and
  verified against a pinned SHA-512 so a tampered mirror fails the build. 6.2.0 is pinned for
  CVE-2026-61372 (SPARQL Update `LOAD` accepting local file URLs).
- **The OpenMetadata Graph Store extension**, compiled in a second build stage against that exact
  `fuseki-server.jar` and refreshed into `$FUSEKI_BASE/extra/` by the entrypoint on every start.
- **`config.ttl`**, the server assembler. `CMD` is already `./fuseki-server --config=/fuseki/config.ttl`.
- **`shiro.ini.template`**, rendered at start with the admin and `openmetadata` passwords.
- **Non-root user `fuseki` (uid/gid 1000)** and `VOLUME /fuseki-data`.

Datasets are never created by hand or through the admin API. The assembler declares three
`tdb2:location`s and TDB2 creates each directory at startup.

## Build

```bash
cd docker/rdf-store
docker build -t openmetadata-fuseki:6.2.0 .
```

Three guards fail the build rather than shipping a broken image: the SHA-512 mismatch check, a
`java -cp fuseki-server.jar $MAIN --version` probe that catches a renamed launcher class, and
`javac` against the real jar so an extension that no longer compiles cannot be packaged.

Expect roughly **393 MB**. Build for the architecture you deploy on — an arm64 laptop build will not
run on an amd64 node:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t <registry>/openmetadata-fuseki:6.2.0 \
  -t <registry>/openmetadata-fuseki:latest \
  --push docker/rdf-store
```

## Publish

**No image is published today.** `docker/rdf-store/kubernetes/fuseki-deployment.yaml` references
`openmetadata/fuseki-rdf:latest`, which does not exist on Docker Hub — the `openmetadata` org has no
Fuseki repository, and no workflow in this repo builds or pushes one. Every RDF deployment currently
has to build from source, which is how sites end up on an upstream Fuseki without the extension's
protections.

Closing this needs three decisions and one workflow:

1. **Repository name.** Either create `openmetadata/fuseki-rdf` to match the manifest, or rename the
   manifest to whatever is created. They must agree.
2. **Tagging.** Tag with the release (`2.0.3`) and not just the Fuseki version — the extension
   changes independently of Fuseki. Suggested: `<release>` plus `<release>-fuseki6.2.0`, and move
   `latest` only on GA.
3. **Release coupling.** The extension is compiled against the pinned `fuseki-server.jar`, so the
   image must be rebuilt whenever `docker/rdf-store/src/**` or `FUSEKI_VERSION` changes — not only
   on release.

The workflow itself is a `docker/build-push-action` step with `context: docker/rdf-store`,
`platforms: linux/amd64,linux/arm64`, gated on a release tag plus a `paths:` filter for
`docker/rdf-store/**`. It does not exist yet: `.github/workflows/**` is treated as a supply-chain
surface in this repo, and adding it needs explicit maintainer sign-off.

## Deploy

```yaml
spec:
  template:
    spec:
      securityContext:
        fsGroup: 1000                      # PVC writable by the non-root user
      containers:
        - name: fuseki
          image: <registry>/openmetadata-fuseki:6.2.0
          # no command/args — the image CMD already passes --config
          ports:
            - containerPort: 3030
          env:
            - name: FUSEKI_ADMIN_PASSWORD
              valueFrom: { secretKeyRef: { name: fuseki-secrets, key: admin-password } }
            - name: FUSEKI_OPENMETADATA_PASSWORD
              valueFrom: { secretKeyRef: { name: fuseki-secrets, key: openmetadata-password } }
            - name: JVM_ARGS
              value: "-Xms4g -Xmx4g"
          volumeMounts:
            - name: fuseki-data
              mountPath: /fuseki-data      # NOT /fuseki — that is the upstream image's layout
          readinessProbe:
            httpGet: { path: /$/ping, port: 3030 }
```

Memory limit must exceed `-Xmx` by the page-cache headroom: TDB2 memory-maps its indexes outside the
JVM heap. See [rdf-production-setup.md](rdf-production-setup.md).

On the OpenMetadata side:

```
RDF_ENABLED=true
RDF_STORAGE_TYPE=FUSEKI
RDF_ENDPOINT=http://fuseki:3030/openmetadata
RDF_REMOTE_USERNAME=admin
RDF_REMOTE_PASSWORD=<FUSEKI_ADMIN_PASSWORD>
```

Use the admin account, not the `openmetadata` writer. OpenMetadata's SPARQL connection queries the
dataset URL itself (`/openmetadata?query=...`), and the shipped `shiro.ini` grants that path only to
`roles[admin]`, so the writer passes the capability probe but fails the connection check with
`RDF dataset is not accessible` (HTTP 403 underneath).

`RDF_DATASET` is inert — `getDataset()` has no callers; the dataset name is parsed out of
`RDF_ENDPOINT`, and `RdfDatasetNames` derives the blue/green alternates as `<base>_a` / `<base>_b`
from it.

Credentials are not optional: anonymous `OPTIONS /openmetadata/data` returns **401**, which surfaces
as `Fuseki rejected the RDF credentials for ... (HTTP 401)`.

## Verify

```bash
kubectl exec <fuseki-pod> -- ls /fuseki-data
kubectl exec <om-pod> -- curl -is -X OPTIONS \
  -u "$RDF_REMOTE_USERNAME:$RDF_REMOTE_PASSWORD" "$RDF_ENDPOINT/data"
```

A correct deployment produces exactly this:

```
fuseki-base  lucene  lucene_a  lucene_b  openmetadata  openmetadata_a  openmetadata_b

HTTP/1.1 200 OK
Fuseki-Request-Id: 3
X-OpenMetadata-Write-Timeout-Ms: 50000
X-OpenMetadata-Max-Upload-Bytes: 67108864
X-OpenMetadata-Union-Default-Graph: true
X-OpenMetadata-Query-Timeout-Ms: 50000
X-OpenMetadata-Update-Timeout-Ms: 50000
Allow: GET,HEAD,OPTIONS,PUT,POST
```

`Allow` without `PUT`/`POST` means the endpoint is bound read-only (`GSP_R` answers
`GET,HEAD,OPTIONS`) and the extension will never see the request. A response without
`Fuseki-Request-Id` came from no Fuseki dataset: the dataset does not exist (Jetty answers `OPTIONS`
with 200 and `Allow: GET, HEAD, OPTIONS` on any path) or something other than Fuseki is in front.

Readiness repeats the union probe on every run. To check a dataset by hand, write a probe triple to
a named graph, ask for it without a `GRAPH` clause, and drop the probe graph:

```bash
curl -s -u "$U:$P" -X POST -H 'Content-Type: application/sparql-update' \
  --data 'INSERT DATA { GRAPH <urn:openmetadata:union-probe> { <urn:probe> <urn:p> "v" } }' \
  http://fuseki:3030/openmetadata/update
curl -s -G --data-urlencode 'query=ASK { <urn:probe> <urn:p> "v" }' \
  http://fuseki:3030/openmetadata/sparql
curl -s -u "$U:$P" -X POST -H 'Content-Type: application/sparql-update' \
  --data 'DROP GRAPH <urn:openmetadata:union-probe>' http://fuseki:3030/openmetadata/update
```

`true` means union is on. A plain row count is not a reliable check: triples written straight to the
default graph (#33474) make it non-zero even with union off.

Then re-trigger `RdfIndexApp`. **No OpenMetadata restart is required** — `ensureStorageReady`
re-probes on every run.

## Cutting over an existing deployment

**From an upstream Apache Jena Fuseki.** Volume path changes (`/fuseki` → `/fuseki-data`) and the
dataset family changes, so you start from an empty graph and the reindex repopulates
(`recreateIndex: true`). Confirm nothing outside OpenMetadata queries the old dataset by name before
decommissioning it.

**From the 2.0.1 OpenMetadata image.** That image launched `--loc=/fuseki-data --update /openmetadata`
and wrote TDB2 files directly into `/fuseki-data`; the 2.0.2 assembler opens `/fuseki-data/openmetadata`.
The entrypoint refuses to start against the old layout rather than silently opening an empty store
that looks healthy. With the container stopped:

```bash
mkdir -p /fuseki-data/openmetadata
mv /fuseki-data/Data-* /fuseki-data/*.lock /fuseki-data/openmetadata/
```

Count triples before and after; the two must match. `FUSEKI_ALLOW_LEGACY_LAYOUT=true` bypasses the
guard and starts empty — only use it when you intend to rebuild.

**From a volume written by a root-running image.** `chown -R 1000:1000` it, or set `fsGroup: 1000`.
The container fails at startup with an explicit message rather than running unwritable.

## Constraints worth knowing

- **`java -jar fuseki-server.jar` ignores `-cp`.** An extension jar present on disk does nothing
  unless the launcher puts it on the classpath. The image handles this; a hand-rolled deployment
  must not use `-jar`.
- **Upstream's `config-tdb2` template has `##tdb2:unionDefaultGraph true` commented out**, so every
  dataset created through `POST /$/datasets` has union off, and readiness rejects it. That is why
  OpenMetadata ships an assembler instead of creating datasets through the admin API. To fix such a
  dataset in place, add `tdb2:unionDefaultGraph true ;` to the `tdb2:DatasetTDB2` node in
  `$FUSEKI_BASE/configuration/<name>.ttl` and restart Fuseki. Fuseki 6.2 writes that file without the
  template's comments, so there is no line to uncomment. The extension is not needed for this.
- **Jena 6.2.0 mishandles a second WHERE-bearing operation in one timed update** when
  `arq:updateTimeout` is set. OpenMetadata's generated mutations use `VALUES`/`UNION` to stay at one,
  and the admin SPARQL API rejects anything else. Direct Fuseki clients must follow the same rule.
- **`/api/v1/system/status` has no RDF check** — database, search, pipeline client, JWKS and
  migrations are covered, RDF is not. A broken triple store shows up only as a failed `RdfIndexApp`
  run.
