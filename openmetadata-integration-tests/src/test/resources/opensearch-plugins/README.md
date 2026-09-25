# Vendored OpenSearch analysis plugins

`SearchTestImages` bakes these archives into the OpenSearch test image via the Docker build context.
They are committed rather than downloaded at test time because `release.infinilabs.com` intermittently
accepts the connection, returns HTTP 200, and then stalls mid-body — which failed the `parallel`
integration-test lane and `search-it-nightly` for a week and blocked the merge queue
(see [#33822](https://github.com/open-metadata/OpenMetadata/issues/33822), and
[#33422](https://github.com/open-metadata/OpenMetadata/pull/33422) for the bounded-download attempt
that preceded it).

## Contents

| File | Source | License | SHA-256 |
|---|---|---|---|
| `opensearch-analysis-ik-3.4.0.zip` | `https://release.infinilabs.com/analysis-ik/stable/opensearch-analysis-ik-3.4.0.zip` | Apache-2.0 ([infinilabs/analysis-ik](https://github.com/infinilabs/analysis-ik)) | `5f1d7dbb66f1a0c88f81d21621e0711505ce1ea0b153f28a34e30fe9b1c483a2` |

`analysis-kuromoji` is deliberately **not** vendored: it is an official OpenSearch plugin resolved by
name from `artifacts.opensearch.org`, the same host the base image comes from, and it has never been
the flaky one.

## Version coupling

The archive version must equal the OpenSearch version in `SearchTestImages.OPENSEARCH_IMAGE`.
`opensearch-plugin install` refuses an archive whose `plugin-descriptor.properties` declares a
different `opensearch.version`, so a mismatch fails loudly at container build.

`SearchTestImagesTest` asserts the archive for the current image tag is present, so bumping the tag
without re-vendoring fails in `mvn test` rather than 30 minutes into an IT lane.

## Re-vendoring after an OpenSearch version bump

```bash
VERSION=<new-opensearch-version>
curl --fail --location --retry 5 --retry-all-errors \
  -o openmetadata-integration-tests/src/test/resources/opensearch-plugins/opensearch-analysis-ik-"$VERSION".zip \
  "https://release.infinilabs.com/analysis-ik/stable/opensearch-analysis-ik-$VERSION.zip"

# Verify it is the right plugin for the right engine version, then update the table above.
unzip -p .../opensearch-analysis-ik-"$VERSION".zip plugin-descriptor.properties | grep -E '^(name|version|opensearch.version)='
shasum -a 256 .../opensearch-analysis-ik-"$VERSION".zip
```

Delete the superseded archive in the same commit — only the version in use should be committed.
The CDN stalls intermittently; retry if `curl` exits 28.
