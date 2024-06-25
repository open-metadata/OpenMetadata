---
title: BigQuery
slug: /connectors/database/bigquery/create-credentials
---

# Create Service Account & Credential 

This documentation will guide you on how to create a service account in GCP and create credentials to access the same.


## Navigate to Service Accounts

Login to your GCP console and navigate to service accounts page.

{% image
src="/images/v1.4/connectors/bigquery/bq-service-account-search.png"
alt="Navigate to Service Accounts"
caption="Navigate to Service Accounts" /%}


## Create Service Account & Grant Role

Once you are on service account page, click on `Create Service Account` button.

{% image
src="/images/v1.4/connectors/bigquery/bq-create-service-account.png"
alt="Create Service Accounts"
caption="Create Service Accounts" /%}

Fill the service account details 

{% image
src="/images/v1.4/connectors/bigquery/bq-create-service-account-1.png"
alt="Create Service Accounts"
caption="Create Service Accounts" /%}

Grant a role to service account which has all the required permission to ingest BigQuery metadata in OpenMetadata checkout [this](/connectors/database/bigquery/roles) documentation for details on how to create a custom role with required permissions.

{% image
src="/images/v1.4/connectors/bigquery/bq-service-account-grant-role.png"
alt="Grant Role to Service Account"
caption="Grant Role to Service Account" /%}


## Create Key Credentials

On service accounts page, look for the service account that you just created, click on the three dots menu and go to manage keys

{% image
src="/images/v1.4/connectors/bigquery/bq-service-account-manage-keys.png"
alt="Service Account Manage Keys"
caption="Service Account Manage Keys" /%}


Click on Add Key > New Key > Select Json and download the key.

{% image
src="/images/v1.4/connectors/bigquery/bq-create-service-account-key.png"
alt="Create New Key"
caption="Create New Key" /%}

{% image
src="/images/v1.4/connectors/bigquery/bq-create-key-modal.png"
alt="Download json Key"
caption="Download json Key" /%}

Open this downloaded key and you will get all the required credentials details to fetch metadata from Bigquery.
