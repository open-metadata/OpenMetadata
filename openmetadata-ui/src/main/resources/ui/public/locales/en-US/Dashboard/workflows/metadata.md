# Metadata

DashboardService Metadata Pipeline Configuration.

## Properties



$$section

### Dashboard Filter Pattern $(id="dashboardFilterPattern")

Dashboard filter patterns to control whether or not to include dashboard as part of metadata ingestion.

**Include**: Explicitly include dashboards by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all dashboards with names matching one or more of the supplied regular expressions. All other dashboards will be excluded. 

for example, to include only those dashboards for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude dashboards by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all dashboards with names matching one or more of the supplied regular expressions. All other dashboards will be included.

for example, to exclude all dashboards with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database) document for more examples on filter patterns
$$

$$section
### Chart Filter Pattern $(id="chartFilterPattern")

Chart filter patterns to control whether or not to include chart as part of metadata ingestion. 

**Include**: Explicitly include charts by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all charts with names matching one or more of the supplied regular expressions. All other charts will be excluded.

for example, to include only those charts for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.


**Exclude**: Explicitly exclude charts by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all charts with names matching one or more of the supplied regular expressions. All other charts will be included.

for example, to exclude all charts with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database) document for more examples on filter patterns
$$

$$section
### Datamodel Filter Pattern $(id="dataModelFilterPattern")

Datamodel filter patterns to control whether or not to include Datamodel as part of metadata ingestion.

**Include**: Explicitly include data models by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all data models with names matching one or more of the supplied regular expressions. All other data models will be excluded.

for example, to include only those datamodels for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude data models by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all data models with names matching one or more of the supplied regular expressions. All other data models will be included.

for example, to exclude all datamodels with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database) document for more examples on filter patterns
$$

$$section
### Database Service Name $(id="dbServiceNames")

Enter the name of Database Service which is already ingested in OpenMetadata to create lineage between dashboards and database tables.
$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section
### Include Owners $(id="includeOwners")

Set the `Include Owner` toggle to control whether to include owners to the ingested entity if its email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
$$

$$section
### Include Tags  $(id="includeTags")

Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.    
$$

$$section
### Include Data Models $(id="includeDataModels")

Set the Include tags toggle to control whether or not to include data models as part of metadata ingestion.    
$$

$$section
### Mark Deleted Dashboard $(id="markDeletedDashboards")

Optional configuration to soft delete 'dashboards' in OpenMetadata if the source 'dashboards' are deleted. After deleting, all the associated entities like lineage, etc., with that 'dashboard' will be deleted.
$$