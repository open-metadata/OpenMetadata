---
title: PGSpider
slug: /connectors/database/pgspider
---

# PGSpider

In this section, we provide guides and references to use the PGSpider connector.

PGSpider connector was created based on Postgres connector. Therefore, it inherits all the features of Postgres connector:
- Metadata Ingestion
- Query Usage and Lineage Ingestion
- Data Profiler
- Data Quality
- dbt Integration

PGSpider connector has a new feature compared to Postgres connector:
- [Ingest Lineage information for multi-tenant tables and foreign tables](#ingest-lineage-information-for-multi-tenant-tables-and-foreign-tables)

## Ingest Lineage information for multi-tenant tables and foreign tables
Lineage feature of PGSpider connector expresses the connection between multi-tenant table and child foreign table of PGSpider.  
Multi-tenant table is the target table, and child foreign tables are source tables.  
It supports both Table Level Lineage and Column Level Lineage

<Image
src="../../../../images/openmetadata/connectors/pgspider/lineage-multi-tenant-tables-and-foreign-tables.png"
alt="Lineage of multi-tenant tables and foreign tables"
caption="Lineage of multi-tenant tables and foreign tables"
/>