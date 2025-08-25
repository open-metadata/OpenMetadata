# Looker

In this section, we provide guides and references to use the Looker connector.

## Requirements

There are two types of metadata we ingest from Looker:
- Dashboards & Charts
- LookML Models

In terms of permissions, we need a user with access to the Dashboards and LookML Explores that we want to ingest. You can create your API credentials following these <a href="https://cloud.google.com/looker/docs/api-auth" target="_blank">docs</a>.

However, LookML Views are not present in the Looker SDK. Instead, we need to extract that information directly from the GitHub repository holding the source `.lkml` files. In order to get this metadata, we will require a GitHub token with read only access to the repository. You can follow these steps from the GitHub <a href="https://docs.github.com/en/enterprise-server@3.4/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token" target="_blank">documentation</a>.

$$note

The GitHub credentials are completely optional. Just note that without them, we won't be able to ingest metadata out of LookML Views, including their lineage to the source databases.

$$

You can find further information on the Kafka connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/looker" target="_blank">docs</a>.

## Connection Details

$$section
### Client ID $(id="clientId")

User's Client ID to authenticate to the SDK. This user should have privileges to read all the metadata in Looker.

$$

$$section
### Client Secret $(id="clientSecret")

User's Client Secret for the same ID provided.

$$

$$section
### Host Port $(id="hostPort")

URL to the Looker instance, e.g., `https://my-company.region.looker.com`

$$

### GitHub Credentials

If we choose to inform the GitHub credentials to ingest LookML Views:

#### Repository Owner $(id="repositoryOwner")

The owner (user or organization) of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the owner is `open-metadata`.

#### Repository Name $(id="repositoryName")

The name of a GitHub repository. For example, in https://github.com/open-metadata/OpenMetadata, the name is `OpenMetadata`.

#### API Token $(id="token")

Token to use the API. This is required for private repositories and to ensure we don't hit API limits.

Follow these <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token" target="_blank">steps</a> in order to create a fine-grained personal access token.

When configuring, give repository access to `Only select repositories` and choose the one containing your LookML files. Then, we only need `Repository Permissions` as `Read-only` for `Contents`.
