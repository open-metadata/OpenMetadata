#### Connection Details

- **Host and Port**: This parameter specifies the host and port of the SAP ERP instance. This should be specified as a string in the format `https://hostname.com`.
- **API Key**: Api Key to authenticate the SAP ERP Apis.
- **database**: Optional name to give to the database in OpenMetadata. If left blank, we will use `default` as the database name.
- **databaseSchema**: Optional name to give to the database schema in OpenMetadata. If left blank, we will use `default` as the database schema name.
- **paginationLimit**: Pagination limit used while querying the SAP ERP APIs for fetching the entities.