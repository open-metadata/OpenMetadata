---
title: Snowflake Troubleshooting Guide | OpenMetadata Support
description: Fix Snowflake connector issues fast with OpenMetadata'stroubleshooting guide. Get solutions for common problems, error codes, and connection failures.
slug: /connectors/database/snowflake/troubleshooting
---

{% partial file="/v1.8/connectors/troubleshooting.md" /%}

## Snowflake User Access Disabled

If you encounter the following error when attempting to connect to a Snowflake database:

```yaml

(snowflake.connector.errors.DatabaseError) 250001 (08001): None: Failed to connect to DB: <your-account>.snowflakecomputing.com:443. User access disabled. Contact your local system administrator.

```

This indicates that the Snowflake user account used for the connection has been **disabled**.


### Resolution

1. **Log in to Snowflake** using an account with administrative privileges.
2. Run the following SQL command to re-enable the user:

   ```sql
   ALTER USER <username> SET DISABLED = FALSE;
    ```
