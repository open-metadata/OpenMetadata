# DataInsightsAppConfig

This schema defines configuration for the Data Insights Application.

$$section
### Application Type $(id="type")

Application Type

$$

$$section
### batchSize $(id="batchSize")

Maximum number of events processed at a time (Default 100).

$$

$$section
### Recreate DataInsights DataAssets Index $(id="recreateDataAssetsIndex")

Recreates the DataAssets index on DataInsights. Useful if you changed a Custom Property Type and are facing errors. Bear in mind that recreating the index will delete your DataAssets and a backfill will be needed.

$$

$$section
### backfillConfiguration $(id="backfillConfiguration")

$$

$$section
### moduleConfiguration $(id="moduleConfiguration")

$$