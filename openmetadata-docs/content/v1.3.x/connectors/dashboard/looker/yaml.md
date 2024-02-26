---
title: Run the Looker Connector Externally
slug: /connectors/dashboard/looker/yaml
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

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

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

### Python Requirements

To run the Looker ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[looker]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas. 
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/lookerConnection.json)
you can find the structure to create a connection to Looker.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Looker:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**clientId**: Specify the Client ID to connect to Looker. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**clientSecret**: Client Secret to connect to Looker.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: URL to the Looker instance.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**githubCredentials** (Optional): GitHub API credentials to extract LookML Views' information by parsing the source `.lkml` files. There are three
properties we need to add in this case:

- **repositoryOwner**: The owner (user or organization) of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the owner is `open-metadata`.
- **repositoryName**: The name of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the name is `OpenMetadata`.
- **token**: Token to use the API. This is required for private repositories and to ensure we don't hit API limits.

Follow these [steps](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token) in order to create a fine-grained personal access token.

When configuring, give repository access to `Only select repositories` and choose the one containing your LookML files. Then, we only need `Repository Permissions` as `Read-only` for `Contents`.


{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: looker
  serviceName: local_looker
  serviceConnection:
    config:
      type: Looker
```
```yaml {% srNumber=1 %}
      clientId: Client ID
```
```yaml {% srNumber=2 %}
      clientSecret: Client Secret
```
```yaml {% srNumber=3 %}
      hostPort: http://hostPort
```
```yaml {% srNumber=4 %}
      gitCredentials:
        type: GitHub # Or BitBucket, depending on your hosting
        repositoryOwner: open-metadata
        repositoryName: OpenMetadata
        token: XYZ
```

{% partial file="/v1.3/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
