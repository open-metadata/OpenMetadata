# DBTCloud
In this section, we provide guides and references to use the DBTCloud connector.

## Requirements

OpenMetadata is integrated with DBT cloud up to version [1.8](https://docs.getdbt.com/docs/get-started-dbt) and will continue to work for future DBT cloud versions.

The Ingestion framework uses [DBT Cloud APIs](https://docs.getdbt.com/dbt-cloud/api-v2#/) to connect to the dbtcloud  and fetch metadata.

You can find further information on the dbtcloud connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/dbtcloud).

## Connection Details
$$section
### Host $(id="host")
DBT cloud Access URL eg.`https://abc12.us1.dbt.com`. Go to your dbt cloud account settings then go to the Access URLs section. In there you will find various URLs we need the `Access URL` from that section as the Host. For more info visit [here](https://docs.getdbt.com/docs/cloud/about-cloud/access-regions-ip-addresses#api-access-urls).
$$

$$section
### Discovery API URL $(id="discoveryAPI")
DBT cloud Discovery API URL eg. `https://abc12.metadata.us1.dbt.com/graphql`. Go to your dbt cloud account settings where you found your Access URL. In there scroll down to find `Discovery API URL` . If your `Discovery API URL` doesn't contain the `/graphql` at the end please add it. Make sure you have `/graphql` at the end of your URL. Note that `Semantic Layer GraphQL API URL` is different from `Discovery API URL`.
$$

$$section
### Account Id $(id="accountId")
The Account ID of your DBT cloud Project. Go to your dbt cloud account settings then in the `Account information` you will find `Account ID`. This will be a numeric value but in openmetadata we parse it as a string.
$$

$$section
### Job Ids $(id="jobIds")
Job IDs of your DBT cloud Jobs in your Project to fetch metadata for. Look for the segment after "jobs" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `73659994`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Jobs under the Account Id will be ingested. `Optional`
$$

$$section
### Project Ids $(id="projectIds")
Project IDs of your DBT cloud Account to fetch metadata for. Look for the segment after "projects" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `87477`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Projects under the Account Id will be ingested. `Optional`

Note that if both `Job Ids` and `Project Ids` are passed then it will filter out the jobs from the passed projects. any `Job Ids` not belonging to the `Project Ids` will also be filtered out.
$$

$$section
### Token $(id="token")
The Authentication Token of your DBT cloud API Account. To get your access token you can follow the docs [here](https://docs.getdbt.com/docs/dbt-cloud-apis/authentication).
Make sure you have the necessary permissions on the token to run graphql queries and get job and run details. 
$$
