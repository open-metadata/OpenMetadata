
## Reverse Metadata Ingestion

Snowflake supports the following reverse metadata ingestion features:
- Full support for Description updates (Database, Schema, Table, Column)
- Tag management (Schema, Table, Column)
- Automated masking policy application based on tags
- Integration with auto-classification workflows

### Requirements for Reverse Metadata Ingestion

In addition to the basic ingestion requirements, for reverse metadata ingestion the user needs:
- `ACCOUNTADMIN` role or a role with similar privileges to modify descriptions and tags
- Access to `snowflake.account_usage.tag_references` for tag management

```sql
-- Grant modify database privileges to the role
GRANT MODIFY ON DATABASE DATABASE_NAME TO ROLE NEW_ROLE;

-- Grant ownership on schema to the role
GRANT OWNERSHIP ON SCHEMA DATABASE_NAME.SCHEMA_NAME TO ROLE NEW_ROLE REVOKE CURRENT GRANTS;

-- Grant ownership on table to the role
GRANT OWNERSHIP ON TABLE DATABASE_NAME.SCHEMA_NAME.TABLE_NAME TO ROLE NEW_ROLE REVOKE CURRENT GRANTS;

-- Grant imported privileges on snowflake database to the role
GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE NEW_ROLE;
```

### Automated Masking Policies with Tags

You can configure masking policies in Snowflake to be automatically applied when specific tags are set through OpenMetadata. For example, when you apply a `Sensitive` tag to a column in OpenMetadata, the corresponding masking policy will be automatically applied to that column in Snowflake.

```sql
-- Create masking policy
CREATE MASKING POLICY SENSITIVE_DATA AS (VAL STRING) RETURNS STRING -> CASE WHEN VAL IS NOT NULL THEN '**********' ELSE NULL END;

-- Apply masking policy to PII.Sensitive tag
ALTER TAG PII SET MASKING POLICY SENSITIVE_DATA;
```

### Auto-Classification Integration

The reverse ingestion workflow can be combined with OpenMetadata's auto-classification feature. When you run the auto-classification workflow:
1. Tags will be automatically identified and added in OpenMetadata
2. These tags will then be synchronized back to Snowflake through the reverse ingestion process

This creates a seamless workflow for identifying and protecting sensitive data across both platforms.


For more details about reverse metadata ingestion, visit our [Reverse Metadata Ingestion Documentation](/connectors/ingestion/workflows/reverse-metadata).
