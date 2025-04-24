
## Reverse Metadata

### Description Management

Snowflake supports full description updates at all levels:
- Database level
- Schema level
- Table level
- Column level

### Owner Management

❌ Owner management is not supported for Snowflake.

### Tag Management

Snowflake supports tag management at the following levels:
- Schema level
- Table level
- Column level

Additionally, Snowflake supports automated masking policy application based on tags. For example, when you apply a `Sensitive` tag to a column in OpenMetadata, the corresponding masking policy will be automatically applied to that column in Snowflake.

{% note %}
While OpenMetadata differentiates between "classification" values and "tag" values, Snowflake's masking policies only support actions based on classification values (tag keys). Therefore, it is advised not to use PII.None along with tag masking policies.
{% /note %}

```sql
-- Create masking policy
CREATE MASKING POLICY SENSITIVE_DATA AS (VAL STRING) RETURNS STRING -> CASE WHEN VAL IS NOT NULL THEN '**********' ELSE NULL END;

-- Apply masking policy to PII.Sensitive tag
ALTER TAG PII SET MASKING POLICY SENSITIVE_DATA;
```

### Owner Management

OpenMetadata does not support owner management for Snowflake, as Snowflake assigns ownership to roles rather than individual users.
To work around this limitation, you can grant ownership to a specific role and then assign that role to the desired user.

```sql
-- Grant ownership on table to the role
GRANT OWNERSHIP ON TABLE DATABASE_NAME.SCHEMA_NAME.TABLE_NAME TO ROLE NEW_ROLE REVOKE CURRENT GRANTS;
```


### Custom SQL Template

Snowflake supports custom SQL templates for metadata changes. The template is interpreted using python f-strings.

Here are examples of custom SQL queries for metadata changes:

```sql
-- Set schema tag
ALTER SCHEMA {database}.{schema} SET TAG {database}.{schema}.{tag_key} = '{tag_value}';
```

The list of variables for custom SQL can be found [here](/connectors/ingestion/workflows/reverse-metadata#custom-sql-template).

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).

### Requirements for Reverse Metadata

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

For more details about reverse metadata ingestion, visit our [Reverse Metadata Documentation](/connectors/ingestion/workflows/reverse-metadata).
