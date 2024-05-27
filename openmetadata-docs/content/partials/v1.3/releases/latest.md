# 1.3.4 Release 🎉

{% note noteType="Tip" %}
**2024, May 7th**
{% /note %}

- Fixes reindex issues related to the `changeDescription` payload of some entities
- Adds Cypress tests to validate reindex app execution

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.3.3-release...1.3.4-release)

See below all the amazing features the community shipped in the 1.3 release!

# 1.3.3 Release

- Fix Application installation
- Fix JWT Filter validation against personal token
- Add Databricks SSL python dependencies
- Fix postgres app migrations
- Improve App UI preview

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.3.2-release...1.3.3-release)

# 1.3.2 Release

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.3.3!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.3.2-release).

## MetaPilot (Collate)
- New MetaPilot application shipped in preview mode. Try it out in the [Sandbox](https://sandbox.open-metadata.org/)!
- Get automatically generated descriptions with GenAI. Now it’s easier than ever to document your data assets.
- Chat with the MetaPilot and get SQL queries to help you extract relevant information from your data assets.
- Let the MetaPilot help you understand and improve the queries used on your tables.

## Authentication Flow
- Added generic support for OIDC Authentication. This is SSO provider-agnostic.
- You can now integrate Confidential Clients to manage the server authentication.
- Now, the session renewal happens automatically in the backend.

## Data Quality
- Pagination support was added for the Data Quality tab for data assets.
- Fixed an issue with execution summary timeout issue for the data quality test.

## Connectors
- New Bigtable connector.
- Now, users can configure the external sample data storage path.
- Added lineage support for Snowflake materialized view and masking policies.
- Fixed session invalidation on Databricks during long-running queries.
- Fixed Ingestion Pipeline list for services with the same name.
- Fixed an issue with ingesting lineage when data models are ingested from Tableau.
- Fixed metrics computations for empty tables.
- Improve PATCH generation for array fields.

## Other Changes
- Avoid creating duplicated queries.
- Speed up the server start time by moving the Secrets Manager Migration to the migration container.
- Fixed the issue with the date filter for the Incident Manager.
- Fixed the issue with the Team filter for Data Insights.
- Fixed an issue with Azure SSO related to the MSAL version.
- Fixed an issue with search indexing.
- Fixed the missing input field for conversation source for alerts and notifications.
- Filter dashboards by a project on the Explore page.
---

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.3.1-release...1.3.2-release)

# 1.3.1 Release 🎉

{% note noteType="Tip" %}
**2024, February 29th**

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.3.1-release).
{% /note %}


## Knowledge Center (Collate)
- Supports drag and drop for the hierarchy of knowledge articles.
- Enhanced the layout and loading experience of the knowledge page.

## Lineage
- When adding a new node in Lineage, the Display Name is supported in search.
- Fixed the issues with displaying lineage from Metabase.

## Glossary
- Improved the automation of performance tests for Glossary.
- Performance improvements to display a large Glossary.

## Data Insights
- Data Insights report has been improved.
- The cost Analysis report has been optimized.

## Notifications
- The format for Slack notifications has been improved.

## Custom Properties
- Added enum type support for custom properties.

## Connectors
- Now BigQuery connector supports Primary, Foreign, and Unique Constraints. It fetches the column description for views.
- Captures the SQL query that powers a Tableau DataModel.
- Azure Key Vault is supported as a Secrets Manager.
- Fixed an issue with ingestion from Sagemaker, Oracle, LDAP, DB2, dbt, Kafka, Metabase, and Databricks.
- Fixed Looker projects and optional project filter patterns.
- Fixed issues with ingestion pipelines.
- Fixed an issue with the service display name after ingestion.

## Other Changes
- The functionality for mutually exclusive tags has been disabled.
- PodGC set up for Argo workflows to delete the pods from the Kubernetes environment on a successful run of the pods.
- Fixed the issue with the display of the personal access token.
- Fixed the mentions in comments for Announcements.
- Fixed the issue with setting a Group as a Domain Owner.
- Fixed the issue with the tooltip in the data quality graph.
- Fixed an issue about notifying the Reviewer of a Glossary Term.
- Fixed the issues with testing the email settings.
- Fixed an issue with adding tags.


# 1.3.0 Release

{% note noteType="Tip" %}
**2024, February 5th**

[OpenMetadata 1.3 Release - Intuitive Lineage UI, Data Observability Alerts, Data Quality Incident Manager, Custom Metrics for Profiler, Knowledge Center Improvements, and lots more](https://blog.open-metadata.org/openmetadata-release-1-3-ac801834ee80)
{% /note %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.3.0-release).

{%  youtube videoId="cVYP1HFXeRM" start="0:00" end="4:49" width="560px" height="315px" /%}

## Lineage

{%  youtube videoId="grwhvTWylbw" start="0:00" end="1:43" width="560px" height="315px" /%}

- Revamped the lineage UI for an intuitive and comprehensive view of data flow and transformations.
- Organized nodes for better visibility with pagination support.
- Improved the display of circular dependencies.
- Nodes display the service icons, highlight dbt models, and show Data Quality results.
- Lineage can be filtered to search by Ownership, Domain, Service, Service Type, Tier, and Classification Tags.
- Supports search by Column and traces lineage even when the columns are renamed.
- Enhanced user control with collapsible sub-graphs.
- Supports editing the SQL queries for lineage edges from the UI.
- Performance improvements for faster load of large graphs.

## Data Observability Alerts

{%  youtube videoId="qc-3sZ_eU5Y" start="0:00" end="2:04" width="560px" height="315px" /%}

- Data observability alerts have been distinguished from other general-purpose notifications, making it easy to get to the crucial alerts quickly.
- Sends alerts for schema changes and test case failures for the data assets that you follow.
- The overall flow has been simplified to let you easily create alerts for schema changes in your data.
- You can now get Data Quality alerts for specific Test Suites.
- Users will be alerted for all the changes to the data assets that they own.

## Incident Manager

{%  youtube videoId="wz5vc1Al-b8" start="0:00" end="2:19" width="560px" height="315px" /%}

- Introduced Incidents Manager to improve the data quality resolution flow.
- Incidents Manager summarizes all the test case results with information about the failure severity and resolution flow.
- Supports assigning a resolution task to the users in OpenMetadata.
- Tasks are created when a data quality test has been assigned to an Assignee or a Reviewer.
- Resolved test failure also displays the comments posted on the resolution.
- The Resolved Tab displays information on the Test case name, Execution date, Reason, Comments, and information on who Resolved the issue.

## Knowledge Center (Collate)

{%  youtube videoId="atwTGm1hixg" start="0:00" end="1:22" width="560px" height="315px" /%}

- Supports hierarchical pages to structure the articles.
- You can easily associate knowledge articles with data assets.
- The data assets page displays the related articles.
- The block editor supports callouts to add notes, warnings, tables, and task lists.
- Quicklinks are no longer separate pages; they redirect to external links.
- Data assets can be associated with Quicklinks.
- Added Search support for Knowledge articles to filter by Owner or Tags.
- Supports preview for articles and Quicklinks.

## Custom Metrics for Profiler

{%  youtube videoId="1sx5aQKMSBI" start="0:00" end="1:52" width="560px" height="315px" /%}

- Supports custom metrics for the data profiler with custom SQL to keep track of your business metrics.
- Custom metrics can be created at Table and Column levels.

## Profiler and Data Quality
- The Profiler has been improved to support sample data ingestion without computing other metrics.
- Admins can configure the profiler to fetch up to 10,000 rows of sample data.
- Sample data can be stored in S3 buckets.
- Refined the default time range on the test case results page, adjusting it from the Last 3 days to the Last 30 days for a more encompassing view.

## Connectors
- New Google Cloud Storage for storage services. (Collate)
- New Alation connector to migrate metadata into Collate. (Collate)
- New Iceberg, SAS Viya, and Doris connectors.
- Introduced the Spark Lineage Agent to extract metadata and end-to-end lineage from Spark jobs.
- MSSQL and Oracle now support Stored Procedures.
- We now exclude system indices from the Elasticsearch connector by default.
- Added support for DB2 IBM I Series.
- Pipeline services now get owner information.
- Performance improvements for the Tableau Connector.
- We now support metadata tag extraction from Databricks.
- Supports the attribute Table Owner for metadata ingestion from Postgres.
- We now extract table descriptions when ingesting metadata from Salesforce.

## Glossary
- Supports soft delete for the default glossaries in OpenMetadata.
- Supports the creation of tasks to request tags or a description.
- Only the Owner can edit the Glossary term.
- Version history displays the Username instead of the User ID.

## Localization

{%  youtube videoId="MCjK6fZg3pw" start="0:00" end="0:36" width="560px" height="315px" /%}

- Now supports RTL UI for the Hebrew language.
- New Dutch language translation.

## Settings UI

{%  youtube videoId="qE07HNFXyu8" start="0:00" end="0:48" width="560px" height="315px" /%}

- The Settings page UI has been revamped.

## Data Insights
- Cost Analysis expanded to support BigQuery & Redshift. (Collate)
- Improved the Data Insights Report sent via email.

## Other Changes
- Announcements can be notified over email, Slack, or Teams.
- Alerts are sent to a user when they are mentioned in a task or activity feed.
- We have improved the display of search results for column matches. When searching for columns, the matched results will be displayed and highlighted in the Preview pane.
- Table Type filter has been added in the Advanced Search, so that users can exclude the temporary or staging tables from search.
- Now it is easy to filter the Data assets without a Owner.
- Database and Schema were added to the Explore menu to enhance data discovery.
- Custom properties are displayed on the right of the data asset details page.
- We now display the Domain on the Users page.
- Supports the sorting of data assets by popularity based on the number of followers and thumbs up as signals.
- OpenMetadata can now handle metric history for ML models.
- When configuring the Email settings, the Username and Password fields can be left blank.
- We now support a test email button on the Email SMTP page.
