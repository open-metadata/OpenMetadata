# The OpenMetadata Fuseki image

OpenMetadata's triple store is the published **`openmetadata/fuseki`** image: the released Apache
Jena Fuseki distribution plus an optional OpenMetadata Graph Store extension and an optional
reasoner worker. It is the image of record for tests, Compose files, Kubernetes manifests and
deployments ([decision record](decisions/2026-10-14-fuseki-image-of-record.md)). This repository no
longer builds a Fuseki image; the former `docker/rdf-store/` build is retired.

For sizing and tuning, see [rdf-production-setup.md](rdf-production-setup.md).

## Where it is built and how it is tagged

The image is built in the [open-metadata/jena](https://github.com/open-metadata/jena) fork, from
the self-contained `openmetadata/fuseki/` directory on each `release/<fuseki-version>` branch. Its
README documents every environment variable, the layout and the reasoner. The Dockerfile downloads
the released Fuseki distribution, checks its SHA-512, and compiles the extension against that exact
`fuseki-server.jar`; Jena itself is not rebuilt or patched.

The fork's workflow tests the extension and the reasoner, smoke-tests the image, and publishes
`linux/amd64` and `linux/arm64` under two tags:

| Tag | Moves | Use |
|---|---|---|
| `<version>-<commit>`, e.g. `6.2.0-600514c` | Never | Everything OpenMetadata ships or tests |
| `<version>`, e.g. `6.2.0` | On every publish from the release branch | Trying the image by hand only |

OpenMetadata pins **`openmetadata/fuseki:6.2.0-600514c`** (index digest
`sha256:5db427d91c1fcd4482b0d10d372699aeeda45cf019867791a31a81d968ceab7e`, built from
`release/6.2.0` at `600514c9`). The pin lives in
[FusekiTestImage](../openmetadata-integration-tests/src/test/java/org/openmetadata/it/bootstrap/FusekiTestImage.java),
the Compose files under `docker/`, and
[fuseki-deployment.yaml](../docker/rdf-store/kubernetes/fuseki-deployment.yaml). Moving it is a
change to all of them in one pull request, after the RDF lane passes against the new tag.

## Settings OpenMetadata needs

With only `ADMIN_PASSWORD` set, the image behaves like stock Fuseki. OpenMetadata needs:

```bash
ADMIN_PASSWORD=<secret>                                # the admin account OpenMetadata connects as
FUSEKI_DATASETS=openmetadata,openmetadata_a,openmetadata_b
FUSEKI_UNION_DEFAULT_GRAPH=true
FUSEKI_QUERY_TIMEOUT_MS=50000
FUSEKI_UPDATE_TIMEOUT_MS=50000
OPENMETADATA_EXTENSION_ENABLED=true
FUSEKI_HEAP=4g                                         # or JVM_ARGS, which then replaces it
```

- **Datasets.** `openmetadata` serves; `openmetadata_a` and `openmetadata_b` are the blue/green
  rebuild targets `RdfDatasetNames` derives from the serving name. The entrypoint seeds a TDB2
  configuration for each name that has none and never edits an existing one.
- **Union default graph.** OpenMetadata writes every entity into a named graph, while the SPARQL
  playground, the MCP tools, SHACL validation and inference read without `GRAPH`. The setting is
  server-wide (`-Dtdb2:unionDefaultGraph=true`), so it also covers datasets created later through
  `POST /$/datasets`.
- **Deadlines.** Server-wide `arq:queryTimeout` and `arq:updateTimeout`, below OpenMetadata's 60 s
  client deadline: releasing an OpenMetadata thread does not cancel server work holding TDB2's
  writer.
- **Extension.** Bounds Graph Store uploads (`OPENMETADATA_MAX_UPLOAD_BYTES`, default 64 MiB) and
  their writer hold time (`OPENMETADATA_WRITE_TIMEOUT_MS`, default 50000), and advertises the
  settings to readiness. Reasoning, when it is enabled later, requires it too.
- **Access.** The rendered `shiro.ini` has one account, `admin`; only `/$/ping` is anonymous. To
  add scoped accounts, set `FUSEKI_MANAGE_SHIRO=false` and provide `/fuseki/shiro.ini`.

On the OpenMetadata side:

```bash
RDF_ENABLED=true
RDF_STORAGE_TYPE=FUSEKI
RDF_ENDPOINT=http://fuseki:3030/openmetadata
RDF_REMOTE_USERNAME=admin
RDF_REMOTE_PASSWORD=<ADMIN_PASSWORD>
```

`RDF_DATASET` is inert: the dataset name is parsed out of `RDF_ENDPOINT`.

The image has no Lucene text index (`text:query`). No OpenMetadata server or MCP code uses it; a
hand-written `text:query` matches nothing.

## What readiness checks

Before indexing, `JenaFusekiStorage.ensureStorageReady` checks the dataset in two steps.

**1. `OPTIONS <server>/<dataset>/data`**, read by `FusekiWriteCapabilities.negotiate`. The
extension adds five headers to the response:

| Header | Guarantee met when | Set by |
|---|---|---|
| `X-OpenMetadata-Query-Timeout-Ms` | `> 0` | `FUSEKI_QUERY_TIMEOUT_MS` |
| `X-OpenMetadata-Update-Timeout-Ms` | `> 0` | `FUSEKI_UPDATE_TIMEOUT_MS` |
| `X-OpenMetadata-Write-Timeout-Ms` | `> 0` | `OPENMETADATA_WRITE_TIMEOUT_MS` (default 50000) |
| `X-OpenMetadata-Max-Upload-Bytes` | `> 0` | `OPENMETADATA_MAX_UPLOAD_BYTES` (default 64 MiB) |
| `X-OpenMetadata-Union-Default-Graph` | not judged from the header; see step 2 | `FUSEKI_UNION_DEFAULT_GRAPH` |

The extension is optional. Without it, or when one of the first four guarantees is unmet, indexing
continues with the client's own upload budget and deadline and logs
`RDF dataset <endpoint> lacks guarantees OpenMetadata relies on at scale; indexing continues: ...`,
naming each gap. What is lost is real: stock Fuseki holds TDB2's writer while a Graph Store upload
transfers, so a small update issued during a 4.4 MB upload at 200 KB/s waited 20 s, against 0.23 s
with the extension. `arq:updateTimeout` does not cover Graph Store uploads.

**2. A union probe** (`UnionDefaultGraphProbe`), run on every Fuseki. Readiness writes one triple
into a named graph with SPARQL Update, asks for it without a `GRAPH` clause, and deletes it
whatever the answer. The write also proves the dataset accepts SPARQL updates. Each probe uses its
own subject, so servers probing at the same time never see or delete each other's triple.

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

[RdfStorageReadinessIT](../openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/RdfStorageReadinessIT.java)
runs these cases against the pinned image and against the same image's Fuseki launched without the
extension.

## Deploy

[fuseki-deployment.yaml](../docker/rdf-store/kubernetes/fuseki-deployment.yaml) is a complete
Kubernetes example. The essentials:

```yaml
spec:
  template:
    spec:
      securityContext:
        fsGroup: 1000                      # PVC writable by the image's uid
        fsGroupChangePolicy: OnRootMismatch
      containers:
        - name: fuseki
          image: openmetadata/fuseki:6.2.0-600514c
          ports:
            - containerPort: 3030
          env:
            - name: ADMIN_PASSWORD
              valueFrom: { secretKeyRef: { name: fuseki-secrets, key: admin-password } }
            - { name: FUSEKI_DATASETS, value: "openmetadata,openmetadata_a,openmetadata_b" }
            - { name: FUSEKI_UNION_DEFAULT_GRAPH, value: "true" }
            - { name: FUSEKI_QUERY_TIMEOUT_MS, value: "50000" }
            - { name: FUSEKI_UPDATE_TIMEOUT_MS, value: "50000" }
            - { name: OPENMETADATA_EXTENSION_ENABLED, value: "true" }
            - { name: JVM_ARGS, value: "-Xms4g -Xmx4g -XX:MaxDirectMemorySize=256m" }
          volumeMounts:
            - name: fuseki-data
              mountPath: /fuseki
          readinessProbe:
            httpGet: { path: /$/ping, port: 3030 }
```

Memory limit must exceed the heap by the off-heap and page-cache headroom: TDB2 memory-maps its
indexes outside the JVM heap. See [rdf-production-setup.md](rdf-production-setup.md).

## Verify

```bash
kubectl exec <fuseki-pod> -- ls /fuseki/databases
kubectl exec <om-pod> -- curl -is -X OPTIONS \
  -u "$RDF_REMOTE_USERNAME:$RDF_REMOTE_PASSWORD" "$RDF_ENDPOINT/data"
```

A correct deployment produces exactly this:

```
openmetadata  openmetadata_a  openmetadata_b

HTTP/1.1 200 OK
Fuseki-Request-Id: 1
X-OpenMetadata-Write-Timeout-Ms: 50000
X-OpenMetadata-Max-Upload-Bytes: 67108864
X-OpenMetadata-Union-Default-Graph: true
X-OpenMetadata-Query-Timeout-Ms: 50000
X-OpenMetadata-Update-Timeout-Ms: 50000
Allow: GET,HEAD,OPTIONS,PUT,POST
```

`Allow` without `PUT`/`POST` means the endpoint is bound read-only and the extension will never see
the request. A response without `Fuseki-Request-Id` came from no Fuseki dataset: the dataset does not
exist or something other than Fuseki is in front.

To check the union default graph by hand, write a probe triple to a named graph, ask for it without
a `GRAPH` clause, and drop the probe graph:

```bash
curl -s -u "$U:$P" -X POST -H 'Content-Type: application/sparql-update' \
  --data 'INSERT DATA { GRAPH <urn:openmetadata:union-probe> { <urn:probe> <urn:p> "v" } }' \
  http://fuseki:3030/openmetadata/update
curl -s -u "$U:$P" -G --data-urlencode 'query=ASK { <urn:probe> <urn:p> "v" }' \
  http://fuseki:3030/openmetadata/sparql
curl -s -u "$U:$P" -X POST -H 'Content-Type: application/sparql-update' \
  --data 'DROP GRAPH <urn:openmetadata:union-probe>' http://fuseki:3030/openmetadata/update
```

`true` means union is on. A plain row count is not a reliable check: triples written straight to the
default graph (#33474) make it non-zero even with union off.

Then re-trigger `RdfIndexApp`. **No OpenMetadata restart is required**: `ensureStorageReady`
re-probes on every run.

## Cutting over an existing deployment

**From the retired in-repo image (`openmetadata-fuseki:6.2.0` built from `docker/rdf-store/`).** That
image kept TDB2 at `/fuseki-data/<dataset>` and Lucene indexes at `/fuseki-data/lucene*`; the
published image keeps TDB2 at `/fuseki/databases/<dataset>`. Both run Fuseki 6.2.0, so the TDB2
directories move as they are; the Lucene directories are not used. Mounting the old volume at
`/fuseki` instead starts three empty datasets that look healthy. Either rebuild (start on an empty
volume and run `RdfIndexApp` with `recreateIndex: true`) or, with Fuseki stopped, copy the datasets:

```bash
docker run --rm --user 0 --entrypoint sh \
  -v <old-volume>:/old:ro -v <new-volume>:/fuseki openmetadata/fuseki:6.2.0-600514c \
  -c 'mkdir -p /fuseki/databases \
      && cp -a /old/openmetadata /old/openmetadata_a /old/openmetadata_b /fuseki/databases/ \
      && chown -R 1000:0 /fuseki'
```

Count triples before and after; the two must match. The `openmetadata` writer account of the old
`shiro.ini` does not exist in the published image: OpenMetadata already connects as `admin`, and any
other client needs `FUSEKI_MANAGE_SHIRO=false` with its own `shiro.ini`. Anonymous `/sparql` and
`/query` reads, which the old image allowed, now get 401.

**From an upstream Apache Jena Fuseki.** Start from an empty volume and reindex
(`recreateIndex: true`). Confirm nothing outside OpenMetadata queries the old dataset by name before
decommissioning it.

**From a volume written by a root-running image.** The entrypoint stops with the exact `chown`
command, or set `fsGroup: 1000` with `fsGroupChangePolicy: OnRootMismatch` on Kubernetes.

## Constraints worth knowing

- **`java -jar fuseki-server.jar` ignores `-cp`.** An extension jar present on disk does nothing
  unless the launcher puts it on the classpath. The image's launcher handles this; a hand-rolled
  deployment must not use `-jar`.
- **Jena 6.2.0 mishandles a second WHERE-bearing operation in one timed update** when
  `arq:updateTimeout` is set. OpenMetadata's generated mutations use `VALUES`/`UNION` to stay at one,
  and the admin SPARQL API rejects anything else. Direct Fuseki clients must follow the same rule.
- **`/api/v1/system/status` has no RDF check**: database, search, pipeline client, JWKS and
  migrations are covered, RDF is not. A broken triple store shows up only as a failed `RdfIndexApp`
  run.
