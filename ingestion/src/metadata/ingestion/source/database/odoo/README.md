# Odoo Database Connector — OpenMetadata Hackathon PR

## Overview
This PR introduces the **Odoo Database Ingestion Connector** (Issue #26102), allowing OpenMetadata to directly extract ERP models, schema details, and metadata from any Odoo instance (v10+).

## Architecture
Odoo operates differently from standard SQL databases by restricting direct PostgreSQL access and requiring metadata extraction through its native **XML-RPC** APIs.

This connector implements a custom **`OdooClient`** that inherits from the `CommonDbSourceService` but bypasses SQLAlchemy, interacting with the `/xmlrpc/2/common` and `/xmlrpc/2/object` endpoints:
1. **Authentication:** Authenticates to `/common` retrieving the session `uid`.
2. **Topology Mapping:** Calls `ir.model` to fetch all business models (e.g., `res.partner`, `sale.order`) and yields them as OpenMetadata `Tables`.
3. **Column Extraction:** Calls `ir.model.fields` to fetch field metadata (e.g., `char`, `many2one`), converting them to OpenMetadata `Columns` mapped to standard `DataType` enums.

## Business Impact
By integrating Odoo, OpenMetadata users can seamlessly track the lineage, quality, and origin of their ERP data.
* **`res.partner`** translates to CRM contacts and vendors.
* **`sale.order`** and **`purchase.order`** become fully traceable data assets.
* Data teams can now catalog critical business data and view exactly how ERP modules map relationally through `many2one` and `one2many` references.

## Zero-Dependency Implementation
We achieved this without adding any external dependencies to the OpenMetadata Python package. The `OdooClient` relies entirely on Python's native, built-in `xmlrpc.client`. This keeps the connector exceptionally lightweight, stable, and completely avoids dependency bloat or conflicts.

## Execution Details & Phased Implementation
The implementation of this connector was strategically broken down into 5 distinct execution slices to ensure high modularity and rigorous validation:

1. **Phase 1: Codebase Discovery & Architecture Planning**
   * Investigated the SAP ERP connector as the primary design blueprint for non-SQL database ingestion topologies within OpenMetadata.
   * Discovered how to safely bypass the standard SQLAlchemy engine instantiation using `NON_SQA_DATABASE_CONNECTIONS`.
2. **Phase 2: Frontend & UI Schema Wiring**
   * Registered the Odoo service within the backend registry (`databaseService.json`).
   * Designed the connection form (`odooConnection.json`) matching the exact frontend `javaType` object structures to generate dynamic UI forms (e.g., password masking, host configs).
   * Implemented custom React routing within `DatabaseServiceUtils.tsx` and injected the official Odoo SVG asset.
3. **Phase 3: Python API Client & Connection Testing**
   * Developed `odoo/client.py` as a lightweight XML-RPC wrapper. Built robust authentication and endpoint testing methods.
   * Wired `connection.py` directly into OpenMetadata's `test_connection_steps` to surface specific UI error messages (e.g., separating authentication failures from permission failures).
4. **Phase 4: Metadata Ingestion Topology**
   * Created Pydantic data models for structural validation.
   * Built `odoo/metadata.py` inheriting `CommonDbSourceService`. Re-routed metadata processing directly to the Odoo XML-RPC endpoints.
   * Implemented extensive type mapping algorithms mapping native `char`/`selection`/`many2one` to OpenMetadata `VARCHAR`/`ENUM` and safely managing edge-case payload types from Odoo APIs (handling `False` boolean payloads from missing string descriptions).
5. **Phase 5: Offline Testing Suite**
   * Developed robust offline mock-based tests leveraging `@patch` targeting `xmlrpc.client.ServerProxy`.

## Test Coverage
We have fully covered the `OdooClient`, connection testing mechanisms, and the extraction topology mapping using strictly mocked tests that hit no live endpoints.

[INSERT SCREENSHOT OF PYTEST RESULTS HERE]
```text
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.0.3, pluggy-1.6.0
rootdir: D:\OpenMetadata\ingestion
configfile: pyproject.toml
plugins: anyio-4.12.1, openmetadata-ingestion-1.12.0.0.dev0
collected 8 items

ingestion\tests\unit\source\database\odoo\test_client.py .....           [ 62%]
ingestion\tests\unit\source\database\odoo\test_connection.py ..          [ 87%]
ingestion\tests\unit\source\database\odoo\test_metadata.py .             [100%]

============================== 8 passed in 0.08s ==============================
```
