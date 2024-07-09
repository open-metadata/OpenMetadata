# DBTCloud
In this section, we provide guides and references to use the DBTCloud connector.

## Requirements

OpenMetadata is integrated with DBT cloud up to version [1.8](https://docs.getdbt.com/docs/get-started-dbt) and will continue to work for future DBT cloud versions.

The Ingestion framework uses [DBT Cloud APIs](https://docs.getdbt.com/dbt-cloud/api-v2#/) to connect to the dbtcloud  and fetch metadata.

You can find further information on the dbtcloud connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/dbtcloud).

## Connection Details
$$section
### Host $(id="host")
DBT cloud Access URL eg.`https://abc12.us1.dbt.com`. Go to your dbt cloud account settings to know your Access URL.
$$

$$section
### Discovery API URL $(id="discoveryAPI")
DBT cloud Access URL eg. `https://metadata.cloud.getdbt.com/graphql`. Go to your dbt cloud account settings to know your Discovery API url.
$$

$$section
### Account Id $(id="accountId")
The Account ID of your DBT cloud Project. Go to your dbt cloud account settings to know your Account Id. This will be a numeric value but in openmetadata we parse it as a string.
$$

$$section
### Job Id $(id="jobId")
The Job ID of your DBT cloud Job in your Project to fetch metadata for. Look for the segment after "jobs" in the URL. For instance, in a URL like `https://cloud.getdbt.com/accounts/123/projects/87477/jobs/73659994`, the job ID is `73659994`. This will be a numeric value but in openmetadata we parse it as a string. If not passed all Jobs under the Account id will be ingested. `Optional`
$$

$$section
### Token $(id="token")
The Authentication Token of your DBT cloud API Account. To get your access token you can follow the docs [here](https://docs.getdbt.com/docs/dbt-cloud-apis/authentication).
Make sure you have the necessary permissions on the token to run graphql queries and get job and run details. 
$$
