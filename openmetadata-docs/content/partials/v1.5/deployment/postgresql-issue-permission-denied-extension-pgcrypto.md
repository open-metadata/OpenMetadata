If you are facing the below issue with PostgreSQL as Database Backend for OpenMetadata Application,

```
Message: ERROR: permission denied to create extension "pgcrypto"
Hint: Must be superuser to create this extension.
```

It seems the Database User does not have sufficient privileges. In order to resolve the above issue, grant usage permissions to the PSQL User.

```sql
GRANT USAGE ON SCHEMA schema_name TO <openmetadata_psql_user>;
GRANT CREATE ON EXTENSION pgcrypto TO <openmetadata_psql_user>;
```

{%note%}

In the above command, replace `<openmetadata_psql_user>` with the sql user used by OpenMetadata Application to connect to PostgreSQL Database.

{%\note%}