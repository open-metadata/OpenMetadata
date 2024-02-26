---
title: Looker
slug: /connectors/dashboard/looker
---

{% connectorDetailsHeader
  name="Looker"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Owners", "Datamodels", "Lineage"]
  unavailableFeatures=["Tags", "Projects"]
/ %}

In this section, we provide guides and references to use the Looker connector.

Configure and schedule Looker metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/looker/yaml"} /%}

## Requirements

There are two types of metadata we ingest from Looker:
- Dashboards & Charts
- LookML Models

For the `project` metadata being ingested:
- We get the actual LookML Project an Explore or View is developed in.
- For Dashboards, we use the folder name from the UI, since there is no other hierarchy involved there.

In terms of permissions, we need a user with access to the Dashboards and LookML Explores that we want to ingest. You can
create your API credentials following these [docs](https://cloud.google.com/looker/docs/api-auth).

However, LookML Views are not present in the Looker SDK. Instead, we need to extract that information directly from
the GitHub repository holding the source `.lkml` files. In order to get this metadata, we will require a GitHub token
with read only access to the repository. You can follow these steps from the GitHub [documentation](https://docs.github.com/en/enterprise-server@3.4/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

{% note %}

The GitHub credentials are completely optional. Just note that without them, we won't be able to ingest metadata
out of LookML Views, including their lineage to the source databases.

Moreover, Looker lineage only supports LookML views configured with `sql_table_name` and `derived_table` in plain SQL.
We do not yet support liquid variables.

{% /note %}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Looker", 
    selectServicePath: "/images/v1.3/connectors/looker/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/looker/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/looker/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: URL to the Looker instance, e.g., `https://my-company.region.looker.com`.
- **Client ID**: User's Client ID to authenticate to the SDK. This user should have privileges to read all the metadata in Looker.
- **Client Secret**: User's Client Secret for the same ID provided.

Then, if we choose to inform the GitHub credentials to ingest LookML Views:

- **Repository Owner**: The owner (user or organization) of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the owner is `open-metadata`.
- **Repository Name**: The name of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the name is `OpenMetadata`.
- **API Token**: Token to use the API. This is required for private repositories and to ensure we don't hit API limits.

Follow these [steps](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token) in order to create a fine-grained personal access token.

When configuring, give repository access to `Only select repositories` and choose the one containing your LookML files. Then, we only need `Repository Permissions` as `Read-only` for `Contents`.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
