# Metadata

StorageService Metadata Pipeline Configuration.

## Properties

$$section

### Container Filter Pattern $(id="containerFilterPattern")

Container filter patterns to control whether or not to include container as part of metadata ingestion.

**Include**: Explicitly include containers by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all containers with names matching one or more of the supplied regular expressions. All other containers will be excluded. 

for example, to include only those containers for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude containers by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all containers with names matching one or more of the supplied regular expressions. All other containers will be included.

for example, to exclude all containers with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database) document for more examples on filter patterns
$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$