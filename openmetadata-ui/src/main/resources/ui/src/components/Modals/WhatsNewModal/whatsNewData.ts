/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/* eslint-disable max-len */

import incidentManagerSampleData from '../../../assets/img/incidentManagerSampleData.png';
import profilerConfigPage from '../../../assets/img/profilerConfigPage.png';
import collateIcon from '../../../assets/svg/ic-collate.svg';

export const COOKIE_VERSION = 'VERSION_1_4_6'; // To be changed with each release.

// for youtube video make isImage = false and path = {video embed id}
// embed:- youtube video => share => click on embed and take {url with id} from it

const CollateIconWithLinkMD = `[![Collate](${collateIcon})](https://www.getcollate.io/)`;

export const WHATS_NEW = [
  {
    id: 22,
    version: 'v1.3.0',
    description: 'Released on 5th Feb 2024.',
    features: [
      {
        title: 'Settings UI',
        description:
          'OpenMetadata Settings page UI has been revamped to provide an intuitive and user-friendly interface.',
        isImage: false,
        path: 'https://www.youtube.com/embed/qE07HNFXyu8',
      },
      {
        title: 'RTL Support',
        description:
          'OpenMetadata now boasts support for ten languages, having expanded beyond English, French, Chinese, German, Japanese, Portuguese, Russian, and Spanish to include Hebrew and Dutch. To accommodate the Hebrew language, we have implemented substantial UI changes to ensure seamless RTL (right-to-left) support.',
        isImage: false,
        path: 'https://www.youtube.com/embed/MCjK6fZg3pw',
      },
      {
        title: 'Intuitive Lineage UI',
        description:
          'The lineage UI has been revamped to provide an intuitive and comprehensive view of data lineage to facilitate a deeper understanding of the flow and transformations within your data assets.',
        isImage: false,
        path: 'https://www.youtube.com/embed/grwhvTWylbw',
      },
      {
        title: 'Custom Metrics for Profiler',
        description:
          'OpenMetadata has enhanced profiling capabilities, so you can generate your own metrics using custom SQL. You can create custom metrics for the profiler at the Table and Column levels.',
        isImage: false,
        path: 'https://www.youtube.com/embed/1sx5aQKMSBI',
      },
      {
        title: 'Incidents Manager',
        description:
          'The Incidents Manager serves as a centralized hub, streamlining the resolution process and reinforcing the integrity of your data. It provides a comprehensive summary of unresolved failed test cases, offering details on failure severity and the resolution flow.',
        isImage: false,
        path: 'https://www.youtube.com/embed/wz5vc1Al-b8',
      },
      {
        title: 'Data Observability',
        description:
          'In the 1.3 release, data observability alerts have been distinguished from the other general-purpose notifications, making it easy to get to the crucial alerts quickly.',
        isImage: false,
        path: 'https://www.youtube.com/embed/qc-3sZ_eU5Y',
      },
      {
        title: 'Knowledge Center (Exclusively for Collate)',
        description:
          'In the 1.3 release, OpenMetadata supports hierarchical pages to structure the articles for a cohesive view and access. Now, it is easier to associate the knowledge articles with data assets with just a few clicks.',
        isImage: false,
        path: 'https://www.youtube.com/embed/atwTGm1hixg',
      },
    ],
    changeLogs: {
      Lineage: ` - Revamped the lineage UI for an intuitive and comprehensive view of data flow and transformations.
- Organized nodes for better visibility with pagination support.
- Improved the display of circular dependencies.
- Nodes display the service icons, highlight dbt models, and show Data Quality results.
- Lineage can be filtered to search by Ownership, Domain, Service, Service Type, Tier, and Classification Tags.
- Supports search by Column and traces lineage even when the columns are renamed.
- Enhanced user control with collapsible sub-graphs.
- Supports editing the SQL queries for lineage edges from the UI.
- Performance improvements for faster load of large graphs.`,
      'Data Observability Alerts': `- Data observability alerts have been distinguished from other general-purpose notifications, making it easy to get to the crucial alerts quickly.
- Sends alerts for schema changes and test case failures for the data assets that you follow.
- The overall flow has been simplified to let you easily create alerts for schema changes in your data.
- You can now get Data Quality alerts for specific Test Suites.
- Users will be alerted for all the changes to the data assets that they own.`,
      'Incident Manager': `- Introduced Incidents Manager to improve the data quality resolution flow.
- Incidents Manager summarizes all the test case results with information about the failure severity and resolution flow.
- Supports assigning a resolution task to the users in OpenMetadata.
- Tasks are created when a data quality test has been assigned to an Assignee or a Reviewer.
- Resolved test failure also displays the comments posted on the resolution.
- The Resolved Tab displays information on the Test case name, Execution date, Reason, Comments, and information on who Resolved the issue.`,
      [`Knowledge Center ${CollateIconWithLinkMD}`]: `- Supports hierarchical pages to structure the articles.
- You can easily associate knowledge articles with data assets.
- The data assets page displays the related articles.
- The block editor supports callouts to add notes, warnings, tables, and task lists.
- Quicklinks are no longer separate pages; they redirect to external links.
- Data assets can be associated with Quicklinks.
- Added Search support for Knowledge articles to filter by Owner or Tags.
- Supports preview for articles and Quicklinks.`,
      'Custom Metrics for Profiler': `- Supports custom metrics for the data profiler with custom SQL to keep track of your business metrics.
- Custom metrics can be created at Table and Column levels.`,
      'Profiler and Data Quality': `- The Profiler has been improved to support sample data ingestion without computing other metrics.
- Admins can configure the profiler to fetch up to 10,000 rows of sample data.
- Sample data can be stored in S3 buckets.
- Refined the default time range on the test case results page, adjusting it from the Last 3 days to the Last 30 days for a more encompassing view.`,
      Connectors: `- New Google Cloud Storage for storage services. ${CollateIconWithLinkMD}
- New Alation connector to migrate metadata into Collate. ${CollateIconWithLinkMD}
- New Iceberg, SAS Viya, and Doris connectors.
- Introduced the Spark Lineage Agent to extract metadata and end-to-end lineage from Spark jobs.
- MSSQL and Oracle now support Stored Procedures.
- We now exclude system indices from the Elasticsearch connector by default.
- Added support for DB2 IBM I Series.
- Pipeline services now get owner information.
- Performance improvements for the Tableau Connector.
- We now support metadata tag extraction from Databricks.
- Supports the attribute Table Owner for metadata ingestion from Postgres.
- We now extract table descriptions when ingesting metadata from Salesforce.`,
      Glossary: `- Supports soft delete for the default glossaries in OpenMetadata.
- Supports the creation of tasks to request tags or a description.
- Only the Owner can edit the Glossary term.
- Version history displays the Username instead of the User ID.`,
      Localization: `- Now supports RTL UI for the Hebrew language.
- New Dutch language translation.`,
      'Settings UI': `- The Settings page UI has been revamped.`,
      'Data Insights': `- Cost Analysis expanded to support BigQuery & Redshift. ${CollateIconWithLinkMD}
- Improved the Data Insights Report sent via email.`,
      'Other Changes': `- Announcements can be notified over email, Slack, or Teams.
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
- We now support a test email button on the Email SMTP page.`,
    },
  },
  {
    id: 23,
    version: 'v1.3.1',
    description: 'Released on 29th Feb 2024.',
    features: [],
    changeLogs: {
      [`Knowledge Center ${CollateIconWithLinkMD}`]: `- Supports drag and drop for the hierarchy of knowledge articles.
- Enhanced the layout and loading experience of the knowledge page.
        `,
      Lineage: `- When adding a new node in Lineage, the Display Name is supported in search.
- Fixed the issues with displaying lineage from Metabase.
        `,
      Glossary: `- Improved the automation of performance tests for Glossary.
- Performance improvements to display a large Glossary.`,
      'Data Insights': `- Data Insights report has been improved.
- The cost Analysis report has been optimized.`,
      Notifications: `- The format for Slack notifications has been improved.`,
      'Custom Properties': `- Added enum type support for custom properties.`,
      Connectors: `- Now BigQuery connector supports Primary, Foreign, and Unique Constraints. It fetches the column description for views.
- Captures the SQL query that powers a Tableau DataModel.
- Azure Key Vault is supported as a Secrets Manager.
- Fixed an issue with ingestion from Sagemaker, Oracle, LDAP, DB2, dbt, Kafka, Metabase, and Databricks.
- Fixed Looker projects and optional project filter patterns.
- Fixed issues with ingestion pipelines.
- Fixed an issue with the service display name after ingestion.`,
      'Other Changes': `- The functionality for mutually exclusive tags has been disabled.
- PodGC set up for Argo workflows to delete the pods from the Kubernetes environment on a successful run of the pods.
- Fixed the issue with the display of the personal access token.
- Fixed the mentions in comments for Announcements.
- Fixed the issue with setting a Group as a Domain Owner.
- Fixed the issue with the tooltip in the data quality graph.
- Fixed an issue about notifying the Reviewer of a Glossary Term.
- Fixed the issues with testing the email settings.
- Fixed an issue with adding tags.`,
    },
  },
  {
    id: 24,
    version: 'v1.3.2',
    description: 'Released on 26th March 2024.',
    features: [],
    changeLogs: {
      [`MetaPilot ${CollateIconWithLinkMD}`]: `-   New MetaPilot application shipped in preview mode. Try it out in the [Sandbox](https://sandbox.open-metadata.org/)!
-   Get automatically generated descriptions with GenAI. Now it's easier than ever to document your data assets.
-   Chat with the MetaPilot and get SQL queries to help you extract relevant information from your data assets.
-   Let the MetaPilot help you understand and improve the queries used on your tables.`,

      'Authentication Flow': `-   Added generic support for OIDC Authentication. This is SSO provider-agnostic.
-   You can now integrate Confidential Clients to manage the server authentication.
-   Now, the session renewal happens automatically in the backend.`,

      'Data Quality': `-   Pagination support was added for the Data Quality tab for data assets.
-   Fixed an issue with execution summary timeout issue for the data quality test.`,

      Connectors: `-   New Bigtable connector.
-   Now, users can configure the external sample data storage path.
-   Added lineage support for Snowflake materialized view and masking policies.
-   Fixed session invalidation on Databricks during long-running queries.
-   Fixed Ingestion Pipeline list for services with the same name.
-   Fixed an issue with ingesting lineage when data models are ingested from Tableau.
-   Fixed metrics computations for empty tables.
-   Improve PATCH generation for array fields.`,

      'Other Changes': `-   Avoid creating duplicated queries.
-   Speed up the server start time by moving the Secrets Manager Migration to the migration container.
-   Fixed the issue with the date filter for the Incident Manager.
-   Fixed the issue with the Team filter for Data Insights.
-   Fixed an issue with Azure SSO related to the MSAL version.
-   Fixed an issue with search indexing.
-   Fixed the missing input field for conversation source for alerts and notifications.
-   Filter dashboards by a project on the Explore page.`,
    },
  },
  {
    id: 25,
    version: 'v1.4.0',
    description: 'Released on 21st May 2024.',
    features: [
      {
        title: 'Automations',
        description:
          'We have introduced Automations to easily maintain high-quality metadata at scale. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency. We have added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.',
        isImage: false,
        path: 'https://www.youtube.com/embed/zdh4yzHw4w0',
      },
      {
        title: 'Bulk Upload Data Assets',
        description:
          'We have added support for bulk uploading data assets. Users can bulk upload database, schema, and table entities from a CSV file for quick edition or creation. The inline editor helps to validate and update the data assets before importing. Save time by bulk uploading data assets.',
        isImage: false,
        path: 'https://www.youtube.com/embed/CXxDdS6AifY',
      },
      {
        title: 'Data Quality Widget',
        description:
          'A new Data Quality Widget has been added. It lists the summary of data quality tests belonging to a user or their team. Customize your Collate landing page to suit your requirements.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Kakfa-lYGOU',
      },
      {
        title: 'Lineage Layers',
        description:
          'The lineage view in OpenMetadata has been improved. All the nodes are expanded by default. A new ‘Layers’ button has been introduced. Users can choose to view the column level lineage. In the Data Observability View, the data quality results are displayed, such as Success, Aborted, or Failed. The pipeline status displays the last execution run.',
        isImage: false,
        path: 'https://www.youtube.com/embed/wtBMeLvA6Sw',
      },
      {
        title: 'Column Lineage Search',
        description:
          'You can search lineage by column names. You can accurately trace the upstream and downstream nodes by column. OpenMetadata helps you to easily trace and visualize how data is transformed and where it is used in your organization.',
        isImage: false,
        path: 'https://www.youtube.com/embed/KZdVb8DiHJs',
      },
      {
        title: 'Custom Properties',
        description:
          'OpenMetadata has been empowering users to enrich the data assets by extending their attributes with custom properties. Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.',
        isImage: false,
        path: 'https://www.youtube.com/embed/lZoSeKkErBk',
      },
      {
        title: 'Custom Theme',
        description:
          "OpenMetadata previously supported uploading your company logo, monogram, and favicon to customize the platform's appearance according to your brand identity. Now, you can take it a step further by customizing the theme with colors that perfectly align with your company's branding.",
        isImage: false,
        path: 'https://www.youtube.com/embed/-NiU1flBHs0',
      },
      {
        title: 'Data Quality Filters',
        description:
          'We have improved the filters for data quality. Now you have additional filtering options for test suites and test cases.',
        isImage: false,
        path: 'https://www.youtube.com/embed/UNOHvBMVcYM',
      },
      {
        title: 'Data Profiler',
        description:
          'A global profiler configuration page has been implemented for the data profiler. This allows Admins to exclude certain metric computations for specific data types. Navigate to Settings > Preferences > Profiler Configuration to define the metrics to compute based on column data types.',
        isImage: true,
        path: profilerConfigPage,
      },
      {
        title: 'Incident Manager',
        description:
          'Based on the latest failed test cases, a sample of failed rows will be displayed in the Incident Manager. Users can quickly verify the cause of failure based on this sample data. The failed sample data will be deleted once the issue is resolved. This is a Collate only feature.',
        isImage: true,
        path: incidentManagerSampleData,
      },
    ],
    changeLogs: {
      ['Backward Incompatible Changes']: `     
Tooling:
-   Metadata Backup/Recovery is deprecated. No further support will be provided.
-   Users are advised to use database native tools to backup and store it in their object store for recovery.
-   bootstrap/bootstrap_storage.sh has been deprecated in favor of bootstrap/openmetadata-ops.sh

UI:
-   Activity has been improved. New update specific cards display critical information such as data quality test case updates, description, tag update or removal.
-   For Lineage, the Expand All button has been removed. A new Layers button is introduced at the bottom left corner. With the Layers button, you can add Column Level Lineage or Data Observability details to your Lineage view.
-   View Definition is now renamed as Schema Definition.
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-  For Classification, users can set classification to be mutually exclusive only **at the time of creation**. Once created, you cannot change it back to mutually non-exclusive or vice-versa. This is to prevent conflicts of adding multiple tags that belong to same classification and later turning the mutually exclusive flag back to true.

API:
-   Table Schema's ViewDefinition is now renamed to SchemaDefinition to capture Tables' Create Schema.
-   Bulk Import API now creates entities if they are not present during the import.
-   Table's TestSuite is migrated to EntityReference. Previously it used to store entire payload of TestSuite.
`,
      [`Automations ${CollateIconWithLinkMD}`]: `-  Easily maintain high-quality metadata at scale with automations. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency.
-   You can update the properties of your assets by filtering by service, owner, domain, or any other supported property from the advanced search.
-   Easily see which assets have been selected by jumping to the Explore page in one click.
-   For tables, data models, topics, and search indexes, you can apply the action to their columns or fields.
-   We added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.`,

      [`Bulk Upload Data Assets  ${CollateIconWithLinkMD}`]: `-   Bulk upload/download database, schema, and table entities from/into a CSV file for quick edition or creation.
-   Supports an inline editor to validate/update assets before performing the upload.`,

      'Data Quality Improvements': `-   The Table schema page now shows the Data Quality tests for each column.
-   Improved filtering options for test suite and test cases.
-   We have improved how the UI fetches the Data Quality details for improved performance.
-   We now compute Unique and Count in the same query to avoid inconsistency due to the high frequency of data insertion.
-   Fixed the issue with removing the test case description upon the test case display name change.
-   Support has been added for an empty string as a missing count.`,

      'Data Profiler': `-   Implemented a global profiler configuration page, allowing admin to exclude certain metric computations for specific data types.
-   Added profiler support for Redshift complex types and DynamoDB.
-   Fixed an issue with performing sum operations for large values in profiler ingestion.
-   Fixed the histogram unit's issues with scientific notation.`,

      'Incident Manager': `-   We now display a sample of failed rows for the latest failed test cases. Once the issue is resolved, the failed sample will be deleted. ${CollateIconWithLinkMD}
-   Fixed the Date time filter for the Incident Manager.
-   Notifications are sent for the tasks created by the Incident Manager.`,

      'Lineage Improvements': `-   OpenMetadata already supports Column-level lineage, and now we have introduced Task-level lineage for Pipelines, Chart-level lineage for Dashboards, Feature-level lineage for ML Models, Field-level lineage for Topics, and columns for dashboard Data Models.
-   Automated column-level lineage is now supported for Tableau, Superset, QlikCloud, and QlikSense between Data Models and Tables.
-   The child nodes in a lineage graph are sorted in alphabetical order.
-   Improved the log of failed-to-parse queries.
-   Fixed an issue with automated column-level lineage overwriting the pipeline lineage and manual column lineage.
-   Snowflake & Databricks now supports automated lineage between external tables and their origin storage container.
-   Lineage can be exported as a CSV file.
-   OpenMetadata spark agent now supports automated lineage between tables and their origin storage container.
-   Fixed an issue with parsing lineage queries for Redshift.
-   Now, we support pipeline as an edge between any two entity types.
-   We now parse PowerBi DAX files for lineage.
-   Support has been added for dynamic tables.`,

      'Data Insights': `- Previously, the data insights reports displayed only the percentage coverage of ownership and description. Now, users can drill down to view the data assets with no owner or description.
-   Improved the UX for data insight filters.`,

      [`Cost Analysis ${CollateIconWithLinkMD}`]: `-   Lifecycle data for Cost Analysis has been implemented for BigQuery, Snowflake, and Redshift.`,

      'Custom Theme': `-   Previously supported adding logo, monogram, and favicon to your OpenMetadata instance.
-   Now, it supports customizing the theme with colors to suit your company branding.`,

      [`Landing Page Widgets ${CollateIconWithLinkMD}`]: `-  Added a Data Quality Widget to list the summary of data quality tests belonging to a user or their team.`,

      'Ingestion Performance Improvements': `-   Bigquery, Redshift, and Snowflake now support incremental metadata ingestions by scanning DML operations on the query history.
-   Database Services now support parallelizing the metadata ingestion at each schema.`,

      Connectors: `-   Now supports a new connector for [QlikCloud](https://www.qlik.com/us/products/qlik-cloud).
-   New Kafka Connect connector
-   We now parse complex protobuf schemas for Kafka
-   Improved model storage ingestion for Sagemaker and Mlflow.
-   Added an option to include or exclude drafts from dashboards.
-   Added an option to include or exclude paused pipelines in Airflow.
-   Revamped SSL support to allow users to upload the required certificates directly in the UI.
-   The character support has been enhanced for tag ingestion to include /.
-   In the Oracle connector, we rolled back to use all_ tables instead of dba_.
-   Added support for Azure auth in Trino.
-   For QlikSense, we have added an option to disable SSL validation.`,

      'Custom Properties': `-   Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.`,

      'Health Check': `-   Introduced the OpenMetadata Status page to do a Health Check on the setup information.

-   Helps identify missing or outdated credential information for ingestion pipeline, SSO, migration, and related issues.

-   Validates JWT authentication tokens for ingestion bots.`,

      Glossary: `-   The glossary term parent can now be changed from the Details page.
-   On the data assets page, glossary terms are displayed by hierarchy.`,

      'Alerts & Notification Improvements': `-   The Activity Feed provides more contextual information, removing the need to move to entity pages.
-   Alerts give more accurate information about the entity, as well as conversations and tasks.`,

      Localization: `-   Fixed localization issues in the confirmation logic for the delete function.
-   Fixed the search index language configuration.`,

      Roles: `
-   Now, roles can be inherited from the user configuration in SSO.`,

      Search: `-   You can now filter by assets without a description or an owner.
-   Improved the match results for search results.`,

      Others: `-   The description is auto-expanded when the data asset has no data and has the space to accommodate a lengthy description.
-   User email IDs have been masked and are only visible to Admins.
-   Users can filter Queries by owner, tag, and creation date in the UI.
-   Added a button in the Query Editor to copy the Query.
-   Improved Elasticsearch re-indexing.
-   Improved the charts based on custom metrics.
-   Improved the usage of the refresh token.
-   Redundant scroll bars have been removed from the UI.
-   Improved the bot role binding to provide more control over which roles are passed to the system bots.`,
    },
  },
  {
    id: 26,
    version: 'v1.4.1',
    description: `Released on 27th May 2024.`,
    note: "In 1.4.1, we provide migration fixes on top of the 1.4.0 release. Don't miss out the release highlights!",
    features: [
      {
        title: 'Automations',
        description:
          'We have introduced Automations to easily maintain high-quality metadata at scale. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency. We have added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.',
        isImage: false,
        path: 'https://www.youtube.com/embed/zdh4yzHw4w0',
      },
      {
        title: 'Bulk Upload Data Assets',
        description:
          'We have added support for bulk uploading data assets. Users can bulk upload database, schema, and table entities from a CSV file for quick edition or creation. The inline editor helps to validate and update the data assets before importing. Save time by bulk uploading data assets.',
        isImage: false,
        path: 'https://www.youtube.com/embed/CXxDdS6AifY',
      },
      {
        title: 'Data Quality Widget',
        description:
          'A new Data Quality Widget has been added. It lists the summary of data quality tests belonging to a user or their team. Customize your Collate landing page to suit your requirements.',
        isImage: false,
        path: 'https://www.youtube.com/embed/Kakfa-lYGOU',
      },
      {
        title: 'Lineage Layers',
        description:
          'The lineage view in OpenMetadata has been improved. All the nodes are expanded by default. A new ‘Layers’ button has been introduced. Users can choose to view the column level lineage. In the Data Observability View, the data quality results are displayed, such as Success, Aborted, or Failed. The pipeline status displays the last execution run.',
        isImage: false,
        path: 'https://www.youtube.com/embed/wtBMeLvA6Sw',
      },
      {
        title: 'Column Lineage Search',
        description:
          'You can search lineage by column names. You can accurately trace the upstream and downstream nodes by column. OpenMetadata helps you to easily trace and visualize how data is transformed and where it is used in your organization.',
        isImage: false,
        path: 'https://www.youtube.com/embed/KZdVb8DiHJs',
      },
      {
        title: 'Custom Properties',
        description:
          'OpenMetadata has been empowering users to enrich the data assets by extending their attributes with custom properties. Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.',
        isImage: false,
        path: 'https://www.youtube.com/embed/lZoSeKkErBk',
      },
      {
        title: 'Custom Theme',
        description:
          "OpenMetadata previously supported uploading your company logo, monogram, and favicon to customize the platform's appearance according to your brand identity. Now, you can take it a step further by customizing the theme with colors that perfectly align with your company's branding.",
        isImage: false,
        path: 'https://www.youtube.com/embed/-NiU1flBHs0',
      },
      {
        title: 'Data Quality Filters',
        description:
          'We have improved the filters for data quality. Now you have additional filtering options for test suites and test cases.',
        isImage: false,
        path: 'https://www.youtube.com/embed/UNOHvBMVcYM',
      },
      {
        title: 'Data Profiler',
        description:
          'A global profiler configuration page has been implemented for the data profiler. This allows Admins to exclude certain metric computations for specific data types. Navigate to Settings > Preferences > Profiler Configuration to define the metrics to compute based on column data types.',
        isImage: true,
        path: profilerConfigPage,
      },
      {
        title: 'Incident Manager',
        description:
          'Based on the latest failed test cases, a sample of failed rows will be displayed in the Incident Manager. Users can quickly verify the cause of failure based on this sample data. The failed sample data will be deleted once the issue is resolved. This is a Collate only feature.',
        isImage: true,
        path: incidentManagerSampleData,
      },
    ],
    changeLogs: {
      ['Backward Incompatible Changes']: `     
Tooling:
-   Metadata Backup/Recovery is deprecated. No further support will be provided.
-   Users are advised to use database native tools to backup and store it in their object store for recovery.
-   bootstrap/bootstrap_storage.sh has been deprecated in favor of bootstrap/openmetadata-ops.sh

UI:
-   Activity has been improved. New update specific cards display critical information such as data quality test case updates, description, tag update or removal.
-   For Lineage, the Expand All button has been removed. A new Layers button is introduced at the bottom left corner. With the Layers button, you can add Column Level Lineage or Data Observability details to your Lineage view.
-   View Definition is now renamed as Schema Definition.
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-  For Classification, users can set classification to be mutually exclusive only **at the time of creation**. Once created, you cannot change it back to mutually non-exclusive or vice-versa. This is to prevent conflicts of adding multiple tags that belong to same classification and later turning the mutually exclusive flag back to true.

API:
-   Table Schema's ViewDefinition is now renamed to SchemaDefinition to capture Tables' Create Schema.
-   Bulk Import API now creates entities if they are not present during the import.
-   Table's TestSuite is migrated to EntityReference. Previously it used to store entire payload of TestSuite.
`,
      [`Automations ${CollateIconWithLinkMD}`]: `-  Easily maintain high-quality metadata at scale with automations. The Automations streamline governance processes from ownership assignments to tagging, ensuring compliance and consistency.
-   You can update the properties of your assets by filtering by service, owner, domain, or any other supported property from the advanced search.
-   Easily see which assets have been selected by jumping to the Explore page in one click.
-   For tables, data models, topics, and search indexes, you can apply the action to their columns or fields.
-   We added support for the following actions: adding and removing owner, tier, domain, tags, glossary terms and descriptions, ML PII tagging, and propagation of tags and glossary terms through lineage.`,

      [`Bulk Upload Data Assets  ${CollateIconWithLinkMD}`]: `-   Bulk upload/download database, schema, and table entities from/into a CSV file for quick edition or creation.
-   Supports an inline editor to validate/update assets before performing the upload.`,

      'Data Quality Improvements': `-   The Table schema page now shows the Data Quality tests for each column.
-   Improved filtering options for test suite and test cases.
-   We have improved how the UI fetches the Data Quality details for improved performance.
-   We now compute Unique and Count in the same query to avoid inconsistency due to the high frequency of data insertion.
-   Fixed the issue with removing the test case description upon the test case display name change.
-   Support has been added for an empty string as a missing count.`,

      'Data Profiler': `-   Implemented a global profiler configuration page, allowing admin to exclude certain metric computations for specific data types.
-   Added profiler support for Redshift complex types and DynamoDB.
-   Fixed an issue with performing sum operations for large values in profiler ingestion.
-   Fixed the histogram unit's issues with scientific notation.`,

      'Incident Manager': `-   We now display a sample of failed rows for the latest failed test cases. Once the issue is resolved, the failed sample will be deleted. ${CollateIconWithLinkMD}
-   Fixed the Date time filter for the Incident Manager.
-   Notifications are sent for the tasks created by the Incident Manager.`,

      'Lineage Improvements': `-   OpenMetadata already supports Column-level lineage, and now we have introduced Task-level lineage for Pipelines, Chart-level lineage for Dashboards, Feature-level lineage for ML Models, Field-level lineage for Topics, and columns for dashboard Data Models.
-   Automated column-level lineage is now supported for Tableau, Superset, QlikCloud, and QlikSense between Data Models and Tables.
-   The child nodes in a lineage graph are sorted in alphabetical order.
-   Improved the log of failed-to-parse queries.
-   Fixed an issue with automated column-level lineage overwriting the pipeline lineage and manual column lineage.
-   Snowflake & Databricks now supports automated lineage between external tables and their origin storage container.
-   Lineage can be exported as a CSV file.
-   OpenMetadata spark agent now supports automated lineage between tables and their origin storage container.
-   Fixed an issue with parsing lineage queries for Redshift.
-   Now, we support pipeline as an edge between any two entity types.
-   We now parse PowerBi DAX files for lineage.
-   Support has been added for dynamic tables.`,

      'Data Insights': `- Previously, the data insights reports displayed only the percentage coverage of ownership and description. Now, users can drill down to view the data assets with no owner or description.
-   Improved the UX for data insight filters.`,

      [`Cost Analysis ${CollateIconWithLinkMD}`]: `-   Lifecycle data for Cost Analysis has been implemented for BigQuery, Snowflake, and Redshift.`,

      'Custom Theme': `-   Previously supported adding logo, monogram, and favicon to your OpenMetadata instance.
-   Now, it supports customizing the theme with colors to suit your company branding.`,

      [`Landing Page Widgets ${CollateIconWithLinkMD}`]: `-  Added a Data Quality Widget to list the summary of data quality tests belonging to a user or their team.`,

      'Ingestion Performance Improvements': `-   Bigquery, Redshift, and Snowflake now support incremental metadata ingestions by scanning DML operations on the query history.
-   Database Services now support parallelizing the metadata ingestion at each schema.`,

      Connectors: `-   Now supports a new connector for [QlikCloud](https://www.qlik.com/us/products/qlik-cloud).
-   New Kafka Connect connector
-   We now parse complex protobuf schemas for Kafka
-   Improved model storage ingestion for Sagemaker and Mlflow.
-   Added an option to include or exclude drafts from dashboards.
-   Added an option to include or exclude paused pipelines in Airflow.
-   Revamped SSL support to allow users to upload the required certificates directly in the UI.
-   The character support has been enhanced for tag ingestion to include /.
-   In the Oracle connector, we rolled back to use all_ tables instead of dba_.
-   Added support for Azure auth in Trino.
-   For QlikSense, we have added an option to disable SSL validation.`,

      'Custom Properties': `-   Custom Properties now allow linking other assets in the platform, such as Tables, Dashboards, etc. To enable this, create a Custom Property as an Entity Reference or Entity Reference List.`,

      'Health Check': `-   Introduced the OpenMetadata Status page to do a Health Check on the setup information.

-   Helps identify missing or outdated credential information for ingestion pipeline, SSO, migration, and related issues.

-   Validates JWT authentication tokens for ingestion bots.`,

      Glossary: `-   The glossary term parent can now be changed from the Details page.
-   On the data assets page, glossary terms are displayed by hierarchy.`,

      'Alerts & Notification Improvements': `-   The Activity Feed provides more contextual information, removing the need to move to entity pages.
-   Alerts give more accurate information about the entity, as well as conversations and tasks.`,

      Localization: `-   Fixed localization issues in the confirmation logic for the delete function.
-   Fixed the search index language configuration.`,

      Roles: `
-   Now, roles can be inherited from the user configuration in SSO.`,

      Search: `-   You can now filter by assets without a description or an owner.
-   Improved the match results for search results.`,

      Others: `-   The description is auto-expanded when the data asset has no data and has the space to accommodate a lengthy description.
-   User email IDs have been masked and are only visible to Admins.
-   Users can filter Queries by owner, tag, and creation date in the UI.
-   Added a button in the Query Editor to copy the Query.
-   Improved Elasticsearch re-indexing.
-   Improved the charts based on custom metrics.
-   Improved the usage of the refresh token.
-   Redundant scroll bars have been removed from the UI.
-   Improved the bot role binding to provide more control over which roles are passed to the system bots.
-   Implemented a fix for SSL migration.`,
    },
  },
  {
    id: 27,
    version: 'v1.4.2',
    description: `Released on 10th June 2024.`,
    features: [],
    changeLogs: {
      Enhancements: `-  In OpenMetadata, we support connecting the data assets to the knowledge articles. The knowledge articles that are pulled from the Alation connector have image URLs. We have enhanced the Alation connector to download and display the images in the Knowledge Articles.
-   Test cases can now be filtered by Service, Tag, and Tier.`,
      Changes: `-   One team or multiple users can be selected as reviewers for a Glossary term.,
-   Updated the openmetadata.yaml to remove WebAnalyticsHandler.,
-   Add appType as part of the schema in the ingestion pipeline.,
-   We now sanitize the Activity Feed editor content.`,
      Improvements: `-   Fixed the lineage view for tables with many columns.
-   Fixed an issue with updating the lineage edge descriptions.
-   Fixed an issue with Null Schema Field.
-   Fixed the glossary term review process issues.
-   Fixed the Kafka SSL connection arguments.
-   Fixed an issue with dbt ingestion pipeline that was occurring due to non enum values.
-   Fixed an issue with Announcements.
-   Fixed redirection issues for Tags and Glossary Terms.
-   Fixed a minor issue with filtering the Profiler.
-   Fixed the registration Issue with Event Handlers.
-   Fixed the sign-in issues with SAML.
-   Fixed issues with partition migration with Redshift services.
-   Fixed an issue with the Quicksight connector.
-   Fixed some minor issues with the user Profile page.
-   Fixed some issues with the Teams page.`,
    },
  },
  {
    id: 28,
    version: 'v1.4.3',
    description: `Released on 15th June 2024.`,
    features: [],
    changeLogs: {
      Improvements: `- Fixed User Signup Flow Issue missing authorize.
-   Fixed vulnerabilities for azure-identity and msal4j.`,
    },
  },
  {
    id: 29,
    version: 'v1.4.4',
    description: `Released on 3rd July 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Introduced SSL for Salesforce.
-   Fixed the claim mappings and usernames.
-   Fixed issues in Salesforce connector.
-   FIxed issues in Alation connector.
-   Verified for changes in new env for claim mapping.`,
    },
  },
  {
    id: 30,
    version: 'v1.4.5',
    description: `Released on 9th July 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Improve query filtering with prepared statements.
-   Big fix in regex to match test case when using sampled data.
-   Bug fix in global profiler config for Snowflake, Redshift, and BigQuery.
-   Bug fix for Arg mismatch for DataModels in QlikSense.`,
    },
  },
  {
    id: 31,
    version: 'v1.4.6',
    description: `Released on 29th July 2024.`,
    features: [],
    changeLogs: {
      Improvements: `-   Fixed test case summary updates
-   Fixed Test Suite indexing
-   Fix repeated alerts being sent after no changes in the Entity
-   Fixed table import
-   Fixed an issue handling users with capital letters
-   Centralize OIDC flow handling
-   Fixed Ingestion Pipeline alert URL`,
    },
  },
];
