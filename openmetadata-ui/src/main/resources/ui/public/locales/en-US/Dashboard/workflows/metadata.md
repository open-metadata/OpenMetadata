# Metadata

DashboardService Metadata Pipeline Configuration.

## Properties

### Dashboard Filter Pattern $(id="dashboardFilterPattern")

Dashboard filter patterns to control whether or not to include dashboard as part of metadata ingestion. Enter the regex pattern form the for including or excluding the dashboard.

### Chart Filter Pattern $(id="chartFilterPattern")

Chart filter patterns to control whether or not to include chart as part of metadata ingestion. Enter the regex pattern form the for including or excluding the chart.

### Datamodel Filter Pattern $(id="dataModelFilterPattern")

Datamodel filter patterns to control whether or not to include Datamodel as part of metadata ingestion. Enter the regex pattern form the for including or excluding the Datamodel.

### Database Service Name $(id="dbServiceNames")

Enter the name of Database Service which is already ingested in OpenMetadata to create lineage between dashboards and database tables.

### Enable Debug Logs

Enabling debug logs tracks error messages during ingestion for troubleshooting.

### Override Current Owner $(id="overrideOwner")

Set the Override Current Owner toggle to override current owner with new owner, if that is fetched during metadata ingestion For first time of metadata ingestion, kindly make sure to keep it enabled to get the owner.

### Include Tags  $(id="includeTags")

Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.    

### Include Data Models $(id="includeDataModels")

Set the Include tags toggle to control whether or not to include data models as part of metadata ingestion.    

### Mark Dashboard Tables $(id="markDeletedDashboards")

Optional configuration to soft delete 'dashboards' in OpenMetadata if the source 'dashboards' are deleted. After deleting, all the associated entities like lineage, etc., with that 'dashboard' will be deleted.