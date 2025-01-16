#### Connection Details

- **Username**: Specify the User to connect to Snowflake. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Snowflake.
- **Account**: Snowflake account identifier uniquely identifies a Snowflake account within your organization, as well as throughout the global network of Snowflake-supported cloud platforms and cloud regions. If the Snowflake URL is `https://xyz1234.us-east-1.gcp.snowflakecomputing.com`, then the account is `xyz1234.us-east-1.gcp`.
- **Role (Optional)**: You can specify the role of user that you would like to ingest with, if no role is specified the default roles assigned to user will be selected.
- **Warehouse**: Snowflake warehouse is required for executing queries to fetch the metadata. Enter the name of warehouse against which you would like to execute these queries.
- **Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Private Key (Optional)**: If you have configured the key pair authentication for the given user you will have to pass the private key associated with the user in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.
  - The multi-line key needs to be converted to one line with `\n` for line endings i.e. `-----BEGIN ENCRYPTED PRIVATE KEY-----\nMII...\n...\n-----END ENCRYPTED PRIVATE KEY-----`
- **Snowflake Passphrase Key (Optional)**: If you have configured the encrypted key pair authentication for the given user you will have to pass the paraphrase associated with the private key in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.
- **Include Temporary and Transient Tables**: 
Optional configuration for ingestion of `TRANSIENT` and `TEMPORARY` tables, By default, it will skip the `TRANSIENT` and `TEMPORARY` tables.
- **Client Session Keep Alive**: Optional Configuration to keep the session active in case the ingestion job runs for longer duration.
