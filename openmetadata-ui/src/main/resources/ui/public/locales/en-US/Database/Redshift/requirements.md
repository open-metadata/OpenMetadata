# Requirements
Redshift user must grant `SELECT` privilege on `SVV_TABLE_INFO` to fetch the metadata of tables and views.

```sql
CREATE USER test_user with PASSWORD 'password';
GRANT SELECT ON TABLE svv_table_info to test_user;
```

If you plan on running the profiler and quality tests you need to make sure your user has `SELECT` privilege on the tables you wish to run those workflows against.  For more information visit [here](https://docs.aws.amazon.com/redshift/latest/dg/c_visibility-of-data.html).

You can find more details in the [Redshift section](https://docs.open-metadata.org/connectors/database/redshift) of the documentation 