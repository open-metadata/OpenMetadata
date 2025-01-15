---
title: Connection Details
slug: /connectors/database/salesforce/connections
---

#### Connection Details

- **Username**: Username to connect to the Salesforce. This user should have the access as defined in requirements.
- **Password**: Password to connect to Salesforce.
- **Security Token**: Salesforce Security Token is required to access the metadata through APIs. You can checkout [this doc](https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm&type=5) on how to get the security token.
- **Organization ID**: Salesforce Organization ID is the unique identifier for your Salesforce identity. You can check out [this doc](https://help.salesforce.com/s/articleView?id=000385215&type=1) on how to get the your Salesforce Organization ID.
  {% note %}
  **Note**: You need to provide `15` digit organization id in this section. for e.g. `00DIB000004nDEq`, which you can find by following the steps mentioned in above doc (`Salesforce dashboard->Setup->Company Profile->Company Information->Salesforce.com Organization Id`).
  {% /note %}
  {% note %}
  **Note**: If you want to access salesforce metadata without token(only by using organization id), you will need to setup your ip in trusted ip ranges. You can go (`Salesforce dashboard->Setup->Security->Network Access->Trusted IP Ranges`) to configure this. You can check [here](https://help.salesforce.com/s/articleView?id=sf.security_networkaccess.htm&type=5) to configure your ip in trusted ip ranges.
  {% /note %}
- **Salesforce Object Name**: Specify the Salesforce Object Name in case you want to ingest a specific object.  If left blank, we will ingest all the Objects.
- **Salesforce API Version**: Follow the steps mentioned [here](https://help.salesforce.com/s/articleView?id=000386929&type=1) to get the API version. Enter the numerical value in the field, For example `42.0`.
- **Salesforce Domain**: When connecting to Salesforce, you can specify the domain to use for accessing the platform. The common domains include `login` and `test`, and you can also utilize Salesforce My Domain.
By default, the domain `login` is used for accessing Salesforce.

**SSL Configuration**

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under sslConfig which is placed in the source.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}