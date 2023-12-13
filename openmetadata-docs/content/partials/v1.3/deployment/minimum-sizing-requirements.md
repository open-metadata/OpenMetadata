## Minimum Sizing Requirements

We recommend you to allocate openmetadata-server with minimum of 2vCPUs and 6 GiB Memory.

For External Services that openmetadata depends on -
- For the database, minimum 2 vCPUs and 2 GiB RAM (per instance) with 30 GiB of Storage Volume Attached (dynamic expansion up to 100 GiB)
- For Elasticsearch, minimum 2 vCPUs and 2 GiB RAM (per instance) with 30 GiB of Storage volume attached

These settings apply as well when using managed instances, such as AWS RDS or GCP CloudSQL or AWS OpenSearch.