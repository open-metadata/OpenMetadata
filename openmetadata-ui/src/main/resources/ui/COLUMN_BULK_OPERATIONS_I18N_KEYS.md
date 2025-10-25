# I18n Translation Keys for Column Bulk Operations

## Required Translation Keys

Add these keys to `src/locale/languages/en-us.json`:

```json
{
  "label": {
    "column-bulk-operations": "Column Bulk Operations",
    "search-and-update": "Search & Update",
    "export-csv": "Export CSV",
    "import-csv": "Import CSV",
    "bulk-update": "Bulk Update",
    "search-by-column-name": "Search by column name",
    "select-entity-type-plural": "Select entity types",
    "filter-by-column-name-optional": "Filter by column name (optional)",
    "service-name-optional": "Service name (optional)",
    "database-name-optional": "Database name (optional)",
    "schema-name-optional": "Schema name (optional)",
    "occurrences": "Occurrences",
    "bulk-update-column": "Bulk Update: {{name}}",
    "preview-changes": "Preview Changes",
    "apply-changes": "Apply Changes",
    "current-display-name": "Current Display Name",
    "new-display-name": "New Display Name",
    "current-description": "Current Description",
    "new-description": "New Description",
    "current-tag-plural": "Current Tags",
    "new-tag-plural": "New Tags",
    "enter-display-name": "Enter display name",
    "enter-description": "Enter description",
    "total-column-plural": "Total Columns",
    "with-changes": "With Changes",
    "no-changes": "No Changes",
    "changes-preview": "Changes Preview",
    "export-columns-to-csv": "Export Columns to CSV",
    "import-columns-from-csv": "Import Columns from CSV",
    "upload": "Upload",
    "upload-csv-file": "Upload CSV File",
    "preview": "Preview",
    "validate-and-preview": "Validate & Preview",
    "import": "Import",
    "import-and-apply": "Import & Apply",
    "validation-results": "Validation Results",
    "import-results": "Import Results",
    "total-rows-processed": "Total Rows Processed",
    "rows-passed": "Rows Passed",
    "rows-failed": "Rows Failed",
    "detailed-results": "Detailed Results",
    "import-another": "Import Another",
    "csv-format": "CSV Format",
    "back": "Back"
  },
  "message": {
    "column-bulk-operations-description": "Bulk edit column metadata across your data assets. Search for columns by name, update them in one place, or use CSV import/export for large-scale changes.",
    "column-search-help": "Search for columns across different entity types (tables, dashboard data models) and update their metadata in bulk. Changes will be applied to all matching columns.",
    "no-columns-found": "No columns found matching your search criteria.",
    "bulk-update-info": "This will update {{count}} occurrences of this column across different entities.",
    "bulk-update-started": "Bulk update started successfully. Job ID: {{jobId}}. You will be notified when it completes.",
    "no-changes-to-apply": "No changes detected. All columns already have the same metadata.",
    "csv-export-help": "Export unique column names and their metadata to a CSV file. You can then edit the CSV and re-import it to apply bulk changes.",
    "csv-export-success": "CSV exported successfully!",
    "csv-export-format-info": "The exported CSV will contain the following columns:",
    "column-name-required": "Unique identifier for the column (required, case-sensitive)",
    "column-display-name": "Human-readable display name for the column",
    "column-description": "Markdown description of the column",
    "column-tags-semicolon": "Classification tags separated by semicolons (e.g., PII.Sensitive;Security.Confidential)",
    "column-glossary-terms-semicolon": "Glossary terms separated by semicolons (e.g., BusinessGlossary.CustomerData)",
    "csv-import-help": "Import column metadata from a CSV file. The system will search for all columns with matching names and apply the updates based on your filters.",
    "csv-import-started": "CSV import started successfully. Job ID: {{jobId}}. You will be notified when it completes.",
    "csv-import-in-progress": "CSV import is being processed in the background.",
    "csv-import-notification-info": "You will receive a notification when the import completes. You can continue working while the import processes.",
    "validation-passed": "All rows passed validation! You can proceed with the import.",
    "validation-failed": "Some rows failed validation. Please fix the errors before importing.",
    "validation-failed-details": "Review the detailed results below to see which rows failed and why.",
    "import-successful": "Import completed successfully!",
    "import-failed": "Some rows failed to import.",
    "import-failed-details": "Review the detailed results below to see which rows failed and why.",
    "import-results-csv-info": "Detailed results showing which rows passed and failed:"
  }
}
```

## Notes:
- These keys follow the existing OpenMetadata i18n naming conventions
- Labels use kebab-case
- Messages use sentence-case descriptions
- Interpolation variables use double curly braces: `{{variable}}`
