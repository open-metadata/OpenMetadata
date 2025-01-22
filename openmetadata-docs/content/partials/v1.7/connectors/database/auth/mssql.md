
#### Connection Details

- **Connection Scheme**: Defines how to connect to MSSQL. We support `mssql+pytds`, `mssql+pyodbc`, and `mssql+pymssql`. (If you are using windows authentication from a linux deployment please use pymssql)
- **Username**: Specify the User to connect to MSSQL. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to MSSQL.
- **Host and Port**: Enter the fully qualified hostname and port number for your MSSQL deployment in the Host and Port field.
- **URI String**: In case of a `pyodbc` connection.
- **Database**: The initial database to establish a connection to the data source.
- **Ingest All Databases**: If you need to ingest multiple databases - aside from the initial one above - you can enable this option.