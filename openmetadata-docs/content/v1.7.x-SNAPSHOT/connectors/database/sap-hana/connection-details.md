---
title: Connection Details
slug: /connectors/database/sap-hana/connections
---

#### Connection Details

We support two possible connection types:
1. **SQL Connection**, where you will the username, password and host.
2. **HDB User Store** [connection](https://help.sap.com/docs/SAP_HANA_PLATFORM/b3ee5778bc2e4a089d3299b82ec762a7/dd95ac9dbb571014a7d7f0234d762fdb.html?version=2.0.05&locale=en-US). 
  Note that the HDB Store will need to be locally available to the instance running the ingestion process. 
  If you are unsure about this setting, you can run the ingestion process passing the usual SQL connection details.

**SQL Connection**

- **Host and Port**: Host and port of the SAP Hana service. This should be specified as a string in the format `hostname:port`. E.g., `localhost:39041`, `host.docker.internal:39041`.
- **Username**: Specify the User to connect to SAP Hana. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to SAP Hana.
- **database**: Optional parameter to connect to a specific database.
- **databaseSchema**: databaseSchema of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.

**HDB USet Store**

- **User Key**: HDB Store User Key generated from the command `hdbuserstore SET <KEY> <host:port> <USERNAME> <PASSWORD>`.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}