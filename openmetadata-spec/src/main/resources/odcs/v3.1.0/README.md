# ODCS v3.1.0 source schema

`schema.json` is the unmodified upstream schema:
https://github.com/bitol-io/open-data-contract-standard/blob/v3.1.0/schema/odcs-json-schema-v3.1.0.json

SHA-256: `2cb7dd6fe43344d2233e0406438622681dc3ebadcf8f0d606a15b40c8f6752c0`.
The Apache-2.0 license is included in `LICENSE.txt`.

Runtime export validation uses this document. Generate the separate model input with
the normal `make generate`, Maven lifecycle, and `json2ts-generate-all.sh` entry points.
`python3 scripts/generate_odcs_export_models.py --check` checks freshness without writing.
The generated input materializes composed fields for the repository generators and removes
annotation defaults. It is not the conformance schema; conditional constraints are checked
against this unmodified source after preserved metadata is merged.
