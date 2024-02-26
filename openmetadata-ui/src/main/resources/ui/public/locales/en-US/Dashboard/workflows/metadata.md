# Metadata

Dashboard Service Metadata Pipeline Configuration.

## Configuration

$$section

### Dashboard Filter Pattern $(id="dashboardFilterPattern")

Dashboard filter patterns to control whether to include Dashboards as part of metadata ingestion.

**Include**: Explicitly include Dashboards by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Dashboards with names matching one or more of the supplied regular expressions. All other Dashboards will be excluded.

For example, to include only those Dashboards whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude Dashboards by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Dashboards with names matching one or more of the supplied regular expressions. All other Dashboards will be included.

For example, to exclude all Dashboards with the name containing the word `demo`, add the regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on filter patterns.
$$

$$section
### Chart Filter Pattern $(id="chartFilterPattern")

Chart filter patterns are used to control whether to include Charts as part of metadata ingestion.

**Include**: Explicitly include Charts by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Charts with names matching one or more of the supplied regular expressions. All other Charts will be excluded.

For example, to include only those Charts whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude Charts by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Charts with names matching one or more of the supplied regular expressions. All other Charts will be included.

For example, to exclude all Charts with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on filter patterns.
$$

$$section
### Data Model Filter Pattern $(id="dataModelFilterPattern")

Data Model filter patterns are used to control whether to include Data Models as part of metadata ingestion.

**Include**: Explicitly include Data Models by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Data Models with names matching one or more of the supplied regular expressions. All other Data Models will be excluded.

For example, to include only those Data Models whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude Data Models by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Data Models with names matching one or more of the supplied regular expressions. All other Data Models will be included.

For example, to exclude all Data Models with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on filter patterns.
$$

$$section
### Database Service Name $(id="dbServiceNames")

When processing Dashboards and Charts we can extract information on which tables are used to create them.

In order to create the lineage between the Dashboard sources and their tables of origin, we need to know where to look for such tables.

You can enter a list of Database Services that are hosting the tables used to create the Dashboards.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Include Owners $(id="includeOwners")

Set the `Include Owner` toggle to control whether to include owners to the ingested entity if its email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
$$

$$section
### Include Tags  $(id="includeTags")

Set the Include tags toggle to control whether to include tags as part of metadata ingestion.    
$$

$$section
### Include Data Models $(id="includeDataModels")

Set the Include tags toggle to control whether to include Data Models as part of metadata ingestion.    
$$

$$section
### Mark Deleted Dashboard $(id="markDeletedDashboards")

Optional configuration to soft delete `dashboards` in OpenMetadata if the source `dashboards` are deleted. After deleting, all the associated entities like lineage, etc., with that `dashboard` will be deleted.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$

