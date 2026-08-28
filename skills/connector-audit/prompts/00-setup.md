# Prompt 0: Setup

Set up the audit context for connector reliability analysis.

---

## Steps

1. **Ask the user** which connector they want to audit (if not provided as an argument).

2. **Find the source directory** under `ingestion/src/metadata/ingestion/source/`. List the service type directories (database, dashboard, pipeline, storage, messaging, search, mlmodel, api) and locate the connector within the correct one.

3. **Determine the service type** from the directory structure.

4. **Write `.claude/connector-audit.json`**:
   ```json
   {
     "connector_name": "<name>",
     "service_type": "<type>",
     "source_path": "ingestion/src/metadata/ingestion/source/<type>/<name>/"
   }
   ```

5. **Create the `.claude/audit-results/` directory** if it doesn't exist.

6. **Confirm** what you found and what you wrote. Show the user:
   - Connector name
   - Service type
   - Source path
   - Files found in the connector directory
