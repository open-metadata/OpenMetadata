# Every CSV the UI downloads starts with a UTF-8 BOM, written only through downloadCsv

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `downloadCsv` in `openmetadata-ui/src/main/resources/ui/src/utils/Export/ExportUtils.test.tsx`; the jobs-tray download in `playwright/e2e/Features/SearchExport.spec.ts` checks the first bytes are `EF BB BF`; new call sites: reviewer
- **Related:** #25764, #28134, #35735

## Context
Exported CSVs are valid UTF-8, but Excel on Windows decodes a CSV without a byte order mark in the
system code page (GBK, Big5, Shift-JIS, Windows-1251, …). Chinese, Cyrillic and other non-Latin
names and descriptions opened garbled, and a template filled in Excel was saved back in that code
page, so its non-Latin text was lost on re-import. #28134 asked for an opt-in setting.

## Decision
Every CSV file the UI writes for download goes through `downloadCsv` in
`src/utils/Export/ExportUtils.ts`, which prepends U+FEFF and sets `text/csv;charset=utf-8`. This
covers exports, background-job results, sample data, knowledge-graph relationships, import
templates and SPARQL results in CSV format. No CSV download uses `downloadFile` or a hand-built
`Blob`. The BOM is always on; it is not a user or admin setting.

## Consequences
Excel shows non-Latin text without an import wizard, and the UI's own readers need no change:
`FileReader.readAsText`, `File.text()` and papaparse drop a leading BOM, so an exported file
re-imports as before. Scripts outside OpenMetadata that read a downloaded file see U+FEFF before
the first header; most CSV libraries strip it, and the REST endpoints still return CSV without one.
Revisit only if a supported consumer cannot handle a BOM, and then make the exception at that
consumer's download rather than turning the BOM off globally.
