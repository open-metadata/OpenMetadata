# Metadata

MessagingService Metadata Pipeline Configuration.

## Properties

$$section

### ML Model Filter Pattern $(id="mlModelFilterPattern")

ML model filter patterns to control whether or not to include model as part of metadata ingestion.

**Include**: Explicitly include models by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all models with names matching one or more of the supplied regular expressions. All other models will be excluded. 

for example, to include only those models for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude models by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all models with names matching one or more of the supplied regular expressions. All other models will be included.

for example, to exclude all models with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database) document for more examples on filter patterns
$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section
### Mark Deleted Ml Model $(id="markDeletedMlModels")

Optional configuration to soft delete 'ML models' in OpenMetadata if the source 'ML models' are deleted. After deleting, all the associated entities like lineage, etc., with that 'ML model' will be deleted.
$$