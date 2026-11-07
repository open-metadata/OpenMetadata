# GS1 Web Vocabulary 1.18 (test fixture)

`gs1Voc.ttl` is the upstream GS1 Web Vocabulary, copied unmodified.

- Source: https://ref.gs1.org/voc/data/gs1Voc.ttl
- Version: 1.18 (`owl:versionInfo`)
- License: Apache License 2.0, stated by GS1 in the file's own `schema:license`
  (copyright 2015-2019 GS1 AISBL); http://www.apache.org/licenses/LICENSE-2.0
- SHA-256: `b6039ed1b3229853a0aed1eb8568527f2d393925fd163d6fce5fddefe7ea1aa7`

It is a test-only pack. `NativeOntologyPackInstallJobIT` serves it from a catalogue built on the
test classpath (`manifest.json`), so nothing here ships in a production manifest. The manifest
borrows the id, version and module id of the bundled `gs1` pack because the server checks a
slice's pack identity against the bundled catalogue.
