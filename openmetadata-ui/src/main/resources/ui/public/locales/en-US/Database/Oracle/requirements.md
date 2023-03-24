To ingest metadata from Oracle, a user must have `CREATE SESSION` privilege.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;
```

**Important:** To fetch metadata from Oracle database we use `python-oracledb`. This library only supports Oracle 12c, 18c, 19c and 21c versions!

You can find more details in the [Oracle section](https://docs.open-metadata.org/connectors/database/oracle) of the documentation 