# ODCS Test Data Examples

This folder contains example ODCS (Open Data Contract Standard) files for manual testing of the import functionality.

## Valid Examples

| File | Description | Tests |
|------|-------------|-------|
| `valid-basic.yaml` | Minimal valid contract | Basic parsing, required fields only |
| `valid-full.yaml` | Complete contract with all sections | Schema, SLA, Team, Roles, Quality |
| `valid-with-timestamps.yaml` | Contract using v3.1.0 timestamp/time types | New logical types, timezone options |
| `valid-quality-rules.yaml` | Contract with comprehensive quality rules | Library metrics, custom rules, scheduling |
| `valid-draft-status.yaml` | Contract in draft status | Non-active status handling |
| `valid-basic.json` | Basic contract in JSON format | JSON parsing support |
| `valid-full.json` | Full contract in JSON format | JSON with all sections |

## Invalid Examples

| File | Description | Expected Error |
|------|-------------|----------------|
| `invalid-missing-apiversion.yaml` | Missing apiVersion field | "Invalid ODCS contract format" |
| `invalid-missing-kind.yaml` | Missing kind field | "Invalid ODCS contract format" |
| `invalid-missing-status.yaml` | Missing status field | "Invalid ODCS contract format" |
| `invalid-wrong-apiversion.yaml` | Invalid apiVersion value (v99.0.0) | Backend validation error |
| `invalid-wrong-kind.yaml` | Wrong kind value (ServiceContract) | Backend validation error |
| `invalid-malformed-yaml.yaml` | Invalid YAML syntax | YAML parse error |
| `invalid-malformed.json` | Invalid JSON syntax | JSON parse error |
| `invalid-empty-file.yaml` | Empty/comment-only file | "Invalid ODCS contract format" |
| `invalid-not-yaml.txt` | Plain text file | File type rejection |

## Testing Scenarios

### 1. New Contract Import (No Existing Contract)
1. Navigate to a table without a data contract
2. Click "Add Contract" > "Import from ODCS"
3. Upload one of the valid files
4. Verify contract preview shows correct information
5. Click Import
6. Verify contract is created with correct data

### 2. Merge with Existing Contract
1. Navigate to a table with an existing data contract
2. Click Manage > "Import ODCS"
3. Upload a valid file
4. Verify "Existing contract detected" warning appears
5. Select "Merge with existing" option
6. Verify merge description shows what will happen
7. Click Import
8. Verify existing ID is preserved, new fields are merged

### 3. Replace Existing Contract
1. Navigate to a table with an existing data contract
2. Click Manage > "Import ODCS"
3. Upload a valid file
4. Select "Replace existing" option
5. Verify replace warning shows data loss implications
6. Click Import
7. Verify old contract is deleted and new one created

### 4. Error Handling
1. Try uploading each invalid file
2. Verify appropriate error messages are shown
3. Verify Import button is disabled for invalid files

### 5. File Type Validation
1. Try uploading `invalid-not-yaml.txt`
2. Verify file is rejected (only .yaml/.yml accepted)

## ODCS v3.1.0 Features to Test

- **Timestamp type**: `logicalType: timestamp` with timezone options
- **Time type**: `logicalType: time` with timezone options
- **Quality metrics library**: `rowCount`, `nullValues`, `invalidValues`, `duplicateValues`, `missingValues`
- **Quality scheduling**: `scheduler` and `schedule` fields
- **SLA timezone**: timezone field on SLA properties

## OpenMetadata Mapping

| ODCS Field | OpenMetadata Field |
|------------|-------------------|
| `id` | Ignored (OM generates) |
| `name` | `name` |
| `version` | `contractVersion` |
| `status` | `status` |
| `description.purpose` | `description` |
| `schema` | `schema` |
| `slaProperties` | `sla` |
| `quality` | Mapped to test cases |
| `team` | `owners` / `stakeholders` |
| `roles` | `roles` |
