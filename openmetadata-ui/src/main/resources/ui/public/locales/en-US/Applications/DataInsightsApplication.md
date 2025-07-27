# DataInsightsAppConfig

This schema defines configuration for the Data Insights Application.

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
### Enabled $(id="backfillConfiguration.enabled")

Enable Backfill for the configured dates

$$

$$section
### Start Date $(id="backfillConfiguration.startDate")

Date from which to start the backfill

$$

$$section
### End Date $(id="backfillConfiguration.endDate")

Date for which the backfill will end

$$

$$section
### moduleConfiguration $(id="moduleConfiguration")

$$

$$section
### Data Assets Module $(id="moduleConfiguration.dataAssets")

Data Assets Insights Module configuration

$$

$$section
### Enabled $(id="moduleConfiguration.dataAssets.enabled")

If Enabled, Data Asset insights will be populated when the App runs.

$$

$$section
### Entities $(id="moduleConfiguration.dataAssets.entities")

List of entities that you need to reindex

$$

$$section
### Data Retention (Days) $(id="moduleConfiguration.dataAssets.retention")

Defines the number of days the Data Assets Insights information will be kept. After it they will be deleted.

$$

$$section
### moduleConfiguration.dataAssets.serviceFilter $(id="moduleConfiguration.dataAssets.serviceFilter")

$$

$$section
### moduleConfiguration.dataAssets.serviceFilter.serviceType $(id="moduleConfiguration.dataAssets.serviceFilter.serviceType")

$$

$$section
### moduleConfiguration.dataAssets.serviceFilter.serviceName $(id="moduleConfiguration.dataAssets.serviceFilter.serviceName")

$$

$$section
### App Analytics Module $(id="moduleConfiguration.appAnalytics")

App Analytics Module configuration

$$

$$section
### Enabled $(id="moduleConfiguration.appAnalytics.enabled")

If Enabled, App Analytics insights will be populated when the App runs.

$$

$$section
### Data Quality Insights Module $(id="moduleConfiguration.dataQuality")

Data Quality Insights Module configuration

$$

$$section
### Enabled $(id="moduleConfiguration.dataQuality.enabled")

If Enabled, Data Quality insights will be populated when the App runs.

$$

$$section
### Cost Analysis Insights Module $(id="moduleConfiguration.costAnalysis")

Cost Analysis Insights Module configuration

$$

$$section
### Enabled $(id="moduleConfiguration.costAnalysis.enabled")

If Enabled, Cost Analysis insights will be populated when the App runs.

$$