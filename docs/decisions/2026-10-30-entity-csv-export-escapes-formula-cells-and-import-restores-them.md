# Entity CSV export escapes formula cells with a quote, and import removes exactly that quote

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `EntityCsvTest.test_exportNeutralizesFormulaCellsAndImportRestoresThem`; `DatabaseServiceResourceIT.test_importExportRecursive_escapesFormulaCellsOnce`; the formula cases in `openmetadata-ui/src/main/resources/ui/src/utils/CSV/CSVPureUtils.test.ts`; new readers of export output: reviewer
- **Related:** #36070, ADR:2026-10-19-ui-csv-downloads-start-with-a-utf8-bom

## Context
Any user who can edit a description, display name or custom property can store a value such as
`=HYPERLINK("http://…")`. Entity CSV exports wrote it verbatim, so a spreadsheet opening the
export evaluated it as a formula. Unlike search-result export, entity CSV is re-imported, so the
escape has to be reversible or every round trip would change data.

## Decision
- `CsvUtil.formatCsv` prefixes `'` to every cell that matches `^'*[=+\-@\t\r]`: a formula
  trigger, possibly behind leading quotes. Only the first character decides. Dots, quoted FQN
  parts, `;`, `:` and everything after the first character are untouched.
- Both `EntityCsv.parse` overloads remove one leading `'` from a cell when the rest still matches
  that pattern. Escape and restore are exact inverses, so `'=x` exports as `''=x` and imports
  back as `'=x`.
- The escape is in the REST export response, not only in downloaded files, so API consumers are
  protected too.
- Code that reads export output and writes it into another CSV calls `CsvUtil.restoreFormula` on
  each cell first (the recursive database- and drive-service exports), so a cell is escaped once.
- The UI bulk-edit grid restores cells when it loads a CSV and escapes them again when it builds the
  CSV for import, with the same rule (`restoreFormula` / `neutralizeFormula` in `CSVPureUtils.ts`).

## Consequences
Exports are safe to open in a spreadsheet, and a value survives any number of export and import
round trips. Scripts that read the export API see `'-5` where the stored value is `-5`. A
hand-written import file whose cell starts with `'` followed by a trigger loses that one quote. A
file exported by a server with this rule and imported into one without it keeps the quote. Any new
reader of export output, on the server or in the UI, must restore cells first. Revisit only if a
supported consumer needs raw values from the export API; keep the import-side restore either way,
because files already exported carry the quote.
