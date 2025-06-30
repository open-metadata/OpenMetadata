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

import collateIcon from '../../../assets/svg/ic-collate.svg';
import { CarousalData } from './FeaturesCarousel.interface';

export const COOKIE_VERSION = 'VERSION_1_8_0'; // To be changed with each release.

// for youtube video make isImage = false and path = {video embed id}
// embed:- youtube video => share => click on embed and take {url with id} from it

const CollateIconWithLinkMD = `[![Collate](${collateIcon})](https://www.getcollate.io/)`;

export const WHATS_NEW = [
  {
    id: 56,
    version: 'v1.6.0',
    description: 'Released on 10th December 2024.',
    features: [
      {
        title: `Visualizing Your Data Landscape with Entity Relationship (ER) Diagrams (Collate)`,
        description: `Understanding complex database schemas can be challenging without clear visualization. While OpenMetadata's best-in-class Lineage UI helps track data flow, there are better options for viewing structural relationships between tables. Collate 1.6 introduces ER diagrams as a new feature to let you:

1.  Visualize table connections through primary and foreign key constraints

2.  Navigate between data assets to discover relationships

3.  Modify connections using the built-in UI editor

ER diagrams help you better understand and manage your data architecture by showing how your database tables relate to each other.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/3m2xHpIsYuM',
      },
      {
        title:
          'Establishing Smooth Data Governance with Automated Glossary Approval Workflows (Collate)',
        description: `Organizations often struggle with data governance due to rigid, pre-defined manual workflows. OpenMetadata 1.6 introduces a new, automated data governance framework designed to be customized to each organization's needs.

In Collate 1.6, the Glossary Approval Workflow has been migrated to this new framework. Now, you can create custom approval processes with specific conditions and rules and easily visualize them through intuitive workflow diagrams. You can also create smart approval processes for glossary terms with real-time state changes and task creation to save time and streamline work. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/yKJNWUb_ucA',
      },
      {
        title:
          'Data Certification Workflows for Automated Bronze, Silver, & Gold Data Standardization (Collate)',
        description: `Collate 1.6 also leverages the new data governance framework for a new Data Certification Workflow, allowing you to define your organization's rules to certify your data as Bronze, Silver, or Gold. Certified assets are a great way to help users discover the right data and inform them which data has been properly curated.

Our vision is to expand our governance framework to allow our users to create their own Custom Governance workflows. We want to enable data teams to implement and automate data governance processes that perfectly fit your organization, promoting data quality and compliance.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/hqxtn6uAvt4',
      },
      {
        title:
          'Maintaining a Healthy Data Platform with Observability Dashboards (Collate)',
        description: `Monitoring data quality and incident management across platforms can be challenging. OpenMetadata has been a pillar for data quality implementations, with its ability to create tests from the UI, native observability alerts, and Incident Manager. It offers data quality insights on a per-table level. .

In Collate 1.6, we’re introducing platform-wide observability dashboards that allow you to track overall data quality coverage trends and analyze incident response performance across your entire data estate. Quickly identify root causes through enhanced asset and lineage views and enable proactive data quality management across your entire data ecosystem.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/DQ-abGXOsHE',
      },
      {
        title: 'Elevating Metric Management with Dedicated Metric Entities',
        description: `Metrics are essential for data-driven organizations, but OpenMetadata previously lacked dedicated metric management, forcing users to use glossary terms as a workaround. The new "Metric" entity in OpenMetadata 1.6 provides a purpose-built solution to:.

1. Document detailed metric calculations and descriptions

2. Record calculation formulas and implementation code (Python, Java, SQL, LaTeX)

3. Visualize metric lineage from source data to insights

This new addition helps teams better manage, understand, and calculate their business KPIs, for improved data literacy and consistency across data teams. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/Nf97_oWNAmM',
      },
      {
        title: 'Reinforcing Data Security with Search RBAC',
        description: `OpenMetadata's Roles and Policies enable granular permission control, ensuring appropriate access to metadata across different domains and teams. Some data teams may wish to enable data discovery to search for other tables while still enforcing controls with access requests. Other data teams in more restrictive environments may also wish to control the search experience.

OpenMetadata 1.6 extends Role-Based Access Control (RBAC) to search functionality, allowing administrators to tailor user search experience. This provides personalized search results, with users only seeing assets they have permission to access, as well as stronger data governance by ensuring users only interact with data within their defined roles and responsibilities.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/03ke9uv0PG0',
      },
      {
        title: 'Streamlining Data Management with Additional Enhancements',
        description: `Release 1.6 comes with several other notable improvements:

- **Asynchronous Export APIs** : Enjoy increased efficiency when exporting and importing large datasets with new asynchronous APIs.

- **Faster Search Re-indexing**:  Experience significantly improved performance in search re-indexing, making data discovery even smoother.

- **Improved Data Insights Custom Dashboards UI (Collate)**: To make it even easier to write your own insights dashboards in Collate.

- **Slack Integration (Collate)**: Collate is releasing a new Application that lets your users find and share assets directly within your Slack workspace!

- **Alert Debuggability**: Allowing users to test the destinations and see whenever the alert was triggered.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/7pUF9ZK2iK4',
      },
      {
        title: 'Expanded Connector Ecosystem and Diversity',
        description: `OpenMetadata’s ingestion framework contains 80+ native connectors. These connectors are the foundation of the platform and bring in all the metadata your team needs: technical metadata, lineage, usage, profiling, etc.

We bring new connectors in each release, continuously expanding our coverage. This time, release 1.6 comes with seven new connectors:

1. **OpenAPI**: Extract rich metadata from OpenAPI specifications, including endpoints and schemas.

2. **Sigma**: Bringing in your BI dashboard information.

3. **Exasol**: Gain insights into your Exasol database, now supported thanks to Nicola Coretti’s OSS contribution!

And in Collate, we are bringing four ETL, dashboarding and ML tools: **Matillion, Azure Data Factory, Stitch, PowerBI Server** and **Vertex AI!**`,
        isImage: false,
        path: '',
      },
    ] as CarousalData[],
    changeLogs: {
      ['Backward Incompatible Changes']: `

**Ingestion Workflow Status:**

We are updating how we compute the success percentage. Previously, we took into account for partial success the results of the Source (e.g., the tables we were able to properly retrieve from Snowflake, Redshift, etc.). This means that we had an error threshold in there were if up to 90% of the tables were successfully ingested, we would still consider the workflow as successful. However, any errors when sending the information to OpenMetadata would be considered as a failure.
Now, we're changing this behavior to consider the success rate of all the steps involved in the workflow. The UI will then show more Partial Success statuses rather than Failed, properly reflecting the real state of the workflow.

**Profiler & Auto Classification Workflow:**

We are creating a new Auto Classification workflow that will take care of managing the sample data and PII classification, which was previously done by the Profiler workflow. This change will allow us to have a more modular and scalable system.
The Profiler workflow will now only focus on the profiling part of the data, while the Auto Classification will take care of the rest.

This means that we are removing these properties from the DatabaseServiceProfilerPipeline schema:

-   generateSampleData
-   processPiiSensitive
-   confidence which will be moved to the new
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-   DatabaseServiceAutoClassificationPipeline schema.

What you will need to do:

-   If you are using the EXTERNAL ingestion for the profiler (YAML configuration), you will need to update your configuration, removing these properties as well.
-   If you still want to use the Auto PII Classification and sampling features, you can create the new workflow from the UI.
`,

      ['RBAC Policy Updates for EditTags']: `We have given more granularity to the EditTags policy. Previously, it was a single policy that allowed the user to manage any kind of tagging to the assets, including adding tags, glossary terms, and Tiers.

Now, we have split this policy to give further control on which kind of tagging the user can manage. The EditTags policy has been
split into:

-   **EditTags**: to add tags.
-   **EditGlossaryTerms**: to add Glossary Terms.
-   **EditTier**: to add Tier tags.`,

      [`Metadata Actions for ML Tagging - Deprecation Notice ${CollateIconWithLinkMD}`]: `
Since we are introducing the Auto Classification workflow, we are going to remove in 1.7 the ML Tagging action from the Metadata Actions. That feature will be covered already by the Auto Classification workflow, which even brings more flexibility allow the on-the-fly usage of the sample data for classification purposes without having to store it in the database.`,

      [`Service Spec for the Ingestion Framework`]: `This impacts users who maintain their own connectors for the ingestion framework that are NOT part of the OpenMetadata python library (openmetadata-ingestion). Introducing the "connector specifcication class (ServiceSpec)". The ServiceSpec class serves as the entrypoint for the connector and holds the references for the classes that will be used to ingest and process the metadata from the source. You can see postgres for an implementation example.`,
    },
  },
  {
    id: 57,
    version: 'v1.6.1',
    description: 'Released on 10th December 2024.',
    note: "In 1.6.1, Fixes tags listing for explore page on top of 1.6.0 release. Don't miss out the release highlights!",
    features: [
      {
        title: `Visualizing Your Data Landscape with Entity Relationship (ER) Diagrams (Collate)`,
        description: `Understanding complex database schemas can be challenging without clear visualization. While OpenMetadata's best-in-class Lineage UI helps track data flow, there are better options for viewing structural relationships between tables. Collate 1.6 introduces ER diagrams as a new feature to let you:

1.  Visualize table connections through primary and foreign key constraints

2.  Navigate between data assets to discover relationships

3.  Modify connections using the built-in UI editor

ER diagrams help you better understand and manage your data architecture by showing how your database tables relate to each other.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/3m2xHpIsYuM',
      },
      {
        title:
          'Establishing Smooth Data Governance with Automated Glossary Approval Workflows (Collate)',
        description: `Organizations often struggle with data governance due to rigid, pre-defined manual workflows. OpenMetadata 1.6 introduces a new, automated data governance framework designed to be customized to each organization's needs.

In Collate 1.6, the Glossary Approval Workflow has been migrated to this new framework. Now, you can create custom approval processes with specific conditions and rules and easily visualize them through intuitive workflow diagrams. You can also create smart approval processes for glossary terms with real-time state changes and task creation to save time and streamline work. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/yKJNWUb_ucA',
      },
      {
        title:
          'Data Certification Workflows for Automated Bronze, Silver, & Gold Data Standardization (Collate)',
        description: `Collate 1.6 also leverages the new data governance framework for a new Data Certification Workflow, allowing you to define your organization's rules to certify your data as Bronze, Silver, or Gold. Certified assets are a great way to help users discover the right data and inform them which data has been properly curated.

Our vision is to expand our governance framework to allow our users to create their own Custom Governance workflows. We want to enable data teams to implement and automate data governance processes that perfectly fit your organization, promoting data quality and compliance.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/hqxtn6uAvt4',
      },
      {
        title:
          'Maintaining a Healthy Data Platform with Observability Dashboards (Collate)',
        description: `Monitoring data quality and incident management across platforms can be challenging. OpenMetadata has been a pillar for data quality implementations, with its ability to create tests from the UI, native observability alerts, and Incident Manager. It offers data quality insights on a per-table level. .

In Collate 1.6, we’re introducing platform-wide observability dashboards that allow you to track overall data quality coverage trends and analyze incident response performance across your entire data estate. Quickly identify root causes through enhanced asset and lineage views and enable proactive data quality management across your entire data ecosystem.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/DQ-abGXOsHE',
      },
      {
        title: 'Elevating Metric Management with Dedicated Metric Entities',
        description: `Metrics are essential for data-driven organizations, but OpenMetadata previously lacked dedicated metric management, forcing users to use glossary terms as a workaround. The new "Metric" entity in OpenMetadata 1.6 provides a purpose-built solution to:.

1. Document detailed metric calculations and descriptions

2. Record calculation formulas and implementation code (Python, Java, SQL, LaTeX)

3. Visualize metric lineage from source data to insights

This new addition helps teams better manage, understand, and calculate their business KPIs, for improved data literacy and consistency across data teams. `,
        isImage: false,
        path: 'https://www.youtube.com/embed/Nf97_oWNAmM',
      },
      {
        title: 'Reinforcing Data Security with Search RBAC',
        description: `OpenMetadata's Roles and Policies enable granular permission control, ensuring appropriate access to metadata across different domains and teams. Some data teams may wish to enable data discovery to search for other tables while still enforcing controls with access requests. Other data teams in more restrictive environments may also wish to control the search experience.

OpenMetadata 1.6 extends Role-Based Access Control (RBAC) to search functionality, allowing administrators to tailor user search experience. This provides personalized search results, with users only seeing assets they have permission to access, as well as stronger data governance by ensuring users only interact with data within their defined roles and responsibilities.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/03ke9uv0PG0',
      },
      {
        title: 'Streamlining Data Management with Additional Enhancements',
        description: `Release 1.6 comes with several other notable improvements:

- **Asynchronous Export APIs** : Enjoy increased efficiency when exporting and importing large datasets with new asynchronous APIs.

- **Faster Search Re-indexing**:  Experience significantly improved performance in search re-indexing, making data discovery even smoother.

- **Improved Data Insights Custom Dashboards UI (Collate)**: To make it even easier to write your own insights dashboards in Collate.

- **Slack Integration (Collate)**: Collate is releasing a new Application that lets your users find and share assets directly within your Slack workspace!

- **Alert Debuggability**: Allowing users to test the destinations and see whenever the alert was triggered.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/7pUF9ZK2iK4',
      },
      {
        title: 'Expanded Connector Ecosystem and Diversity',
        description: `OpenMetadata’s ingestion framework contains 80+ native connectors. These connectors are the foundation of the platform and bring in all the metadata your team needs: technical metadata, lineage, usage, profiling, etc.

We bring new connectors in each release, continuously expanding our coverage. This time, release 1.6 comes with seven new connectors:

1. **OpenAPI**: Extract rich metadata from OpenAPI specifications, including endpoints and schemas.

2. **Sigma**: Bringing in your BI dashboard information.

3. **Exasol**: Gain insights into your Exasol database, now supported thanks to Nicola Coretti’s OSS contribution!

And in Collate, we are bringing four ETL, dashboarding and ML tools: **Matillion, Azure Data Factory, Stitch, PowerBI Server** and **Vertex AI!**`,
        isImage: false,
        path: '',
      },
    ] as CarousalData[],
    changeLogs: {
      ['Backward Incompatible Changes']: `

**Ingestion Workflow Status:**

We are updating how we compute the success percentage. Previously, we took into account for partial success the results of the Source (e.g., the tables we were able to properly retrieve from Snowflake, Redshift, etc.). This means that we had an error threshold in there were if up to 90% of the tables were successfully ingested, we would still consider the workflow as successful. However, any errors when sending the information to OpenMetadata would be considered as a failure.
Now, we're changing this behavior to consider the success rate of all the steps involved in the workflow. The UI will then show more Partial Success statuses rather than Failed, properly reflecting the real state of the workflow.

**Profiler & Auto Classification Workflow:**

We are creating a new Auto Classification workflow that will take care of managing the sample data and PII classification, which was previously done by the Profiler workflow. This change will allow us to have a more modular and scalable system.
The Profiler workflow will now only focus on the profiling part of the data, while the Auto Classification will take care of the rest.

This means that we are removing these properties from the DatabaseServiceProfilerPipeline schema:

-   generateSampleData
-   processPiiSensitive
-   confidence which will be moved to the new
-   Adding Glossary Term view is improved. Now we show glossary terms hierarchically enabling a better understanding of how the terms are setup while adding it to a table or dashboard.
-   DatabaseServiceAutoClassificationPipeline schema.

What you will need to do:

-   If you are using the EXTERNAL ingestion for the profiler (YAML configuration), you will need to update your configuration, removing these properties as well.
-   If you still want to use the Auto PII Classification and sampling features, you can create the new workflow from the UI.
`,

      ['RBAC Policy Updates for EditTags']: `We have given more granularity to the EditTags policy. Previously, it was a single policy that allowed the user to manage any kind of tagging to the assets, including adding tags, glossary terms, and Tiers.

Now, we have split this policy to give further control on which kind of tagging the user can manage. The EditTags policy has been
split into:

-   **EditTags**: to add tags.
-   **EditGlossaryTerms**: to add Glossary Terms.
-   **EditTier**: to add Tier tags.`,

      [`Metadata Actions for ML Tagging - Deprecation Notice ${CollateIconWithLinkMD}`]: `
Since we are introducing the Auto Classification workflow, we are going to remove in 1.7 the ML Tagging action from the Metadata Actions. That feature will be covered already by the Auto Classification workflow, which even brings more flexibility allow the on-the-fly usage of the sample data for classification purposes without having to store it in the database.`,

      [`Service Spec for the Ingestion Framework`]: `This impacts users who maintain their own connectors for the ingestion framework that are NOT part of the OpenMetadata python library (openmetadata-ingestion). Introducing the "connector specifcication class (ServiceSpec)". The ServiceSpec class serves as the entrypoint for the connector and holds the references for the classes that will be used to ingest and process the metadata from the source. You can see postgres for an implementation example.`,
    },
  },
  {
    id: 58,
    version: 'v1.6.2',
    description: 'Released on 10th January 2025.',
    features: [],
    changeLogs: {
      Improvements: `- **Fix**: Test case getting removed from logical test suite after editing the test case.
- **Fix**: Edit Lineage Operation not working with isOwner() condition
- **Fix**: EditLineage permission not allowing users to edit the lineage.
- **Fix**: ViewAll permission not working with matchAnyTag() and isOwner() conditions
- **Fix**: Vulnerability security on 1.5.6 version package com.google.protobuf_protobuf-java.
- **Fix**: DBT Data ingestion not working.
- **Fix**: Table owners not shown properly after a dbt ingestion and re-indexing.
- **Fix**: Glossary Listing Limits to 50 without scrolling to next page.
- **Fix**: Mask encrypted password for email.
- **Fix**: Profiler failing on ingesting data type for postgres.
- **Fix**: Column lineage ingestion failed to parse column due to subquery raw_name AttributeError.
- **Fix**: Data Insight Tier Filter does not work.
- **Fix**: Add depth support for storage connector.
- **Fix**: Replace the description editor with a new block editor.
- **Fix**: Redshift Metadata ingestion failing for Stored Procedure.
- **Fix**: Lineage view not showing all the nodes in case of circular lineage.
- **Fix**: Deleting Data Product should delete the data asset relationships.
- **Fix**: styling (color, icon) is lost if a glossaryTerm is updated via the bulk upload.
- **Fix**: Unable to see complete column type info for long column type.
- **Fix**: ApiEndpoint reindexing failure.
- **Fix**: Auto Classification Ingestion - AttributeError: 'DataType' object has no attribute 'dialect_impl'.
- **Fix**: Adding the profiler for doris failing to execute.
- **Fix**: Unable to remove existing values from custom property (enum data type).
- **Improvement**: Ability to sort the DI charts based on date or term.
- **Improvement**: Support test connection api cancellation on click of cancel.
- **Improvement**: Highlight the search term for schema table on table details page.
- **Improvement**: Add Algorithm option for authentication token validation in yaml.
- **Improvement**: Make all Test Suites executable.
- **Improvement**: Activity feed pagination.
- **Fix**: Custom DI description getting added with HTML p tag. ${CollateIconWithLinkMD}
- **Fix**: Knowledge Page hierarchy state doesn't persist on refresh. ${CollateIconWithLinkMD}
- **Fix**: Reindex Page Entitiy is Missing on Collate. ${CollateIconWithLinkMD}
- **Fix**: Avoid pluralizing for custom charts. ${CollateIconWithLinkMD}
- **Improvement**: Add the missing filters for different assets in the Automator(Ex. Database filter for Database Schema asset). ${CollateIconWithLinkMD}
- **Improvement**: Add Glossary Term and Metric as assets for Automation. ${CollateIconWithLinkMD}
`,
    },
  },
  {
    id: 59,
    version: 'v1.6.3',
    description: 'Released on 29th January 2025.',
    features: [],
    changeLogs: {
      Improvements: `- **Fix**: Adds percona server for postgresql support.
- **Fix**: Inherited Ownership for Data Products.
- **Fix**: Favicon not being updated in the browser tab.
- **Fix**: Fix Search Index for ER Model.
- **Fix**: dbt ingestion picks up wrong service to patch metadata.
- **Fix**: Wrong team count displayed on team tab.
- **Fix**: Tracing highlighter in lineage after edge clicked.
- **Fix**: Api should not called after time out in Test connection.
- **Fix**: Get only non-deleted entities in export.
- **Fix**: The permissions call made for search service.
- **Fix**: Kafkaconnect validation errors.
- **Fix**: DI Filter not getting applied.
- **Fix**: Redash Get Dashboards flow.
- **Fix**: Description not rendered in Glossary Modal while edit.
- **Fix**: The persona JSON schema is named Team.
- **Fix**: Redirection issue on IDP initiated calls.
- **Fix**: Async export csv not happening in lineage.
- **Fix**: Description renderer having tags in glossary,team and user import.
- **Fix**: RichTextEditor output in case on no data save.
- **Fix**: s3 storage parquet structureFormat ingestion.
- **Fix**: Data Insights index mapping.
- **Fix**: Edit description permission for domain owner.
- **Fix**: Model dump dict key names.
- **Fix**: Broken looker lineage.
- **Fix**: Refresh call concurrency for multiple browser tabs.
- **Fix**: Infinite loading for refresh attempted on app visit.
- **Fix**: Duplicate table constraints.
- **Fix**: Updated MSSQL queries causing arithmetic overflow error.
- **Fix**: PowerBI tables, datamodel metadata missing.
- **Fix**: Wrong dataset and project id in filter of system metric query.
- **Fix**: Data Insight fix custom property filter.
- **Fix**: Entity Hierarchy Schema.
- **Fix**: Salesforce column description with toggle api.
- **Fix**: Update glossary term table upon new term added.
- **Fix**: Remove unwanted spacing around the list in block editor.
- **Fix**: Postgres parse json schema.
- **Fix**: Optimize multithreading for lineage.
- **Fix**: Fetch Stored Procedures from account usage .
- **Fix**: Add MaterializedView & DynamicTable for lineage computation.
- **Fix**: MariaDB Lineage Dialect Issue.
- **Fix**: DQ Dashboard: update order of the pie chart. ${CollateIconWithLinkMD}
- **Fix**: Lineage Propagation when Entity doesn't have a given field. ${CollateIconWithLinkMD}
- **Minor**: Optimize Snowflake SP Query.
- **Minor**: Hide description tooltip for tag edit mode.
- **Minor**: BigQuery Improvement, Hive Partitioned Tables, Nonetype issue resolved
- **Minor**: Typo for datetime attribute.
- **Minor**: Get missing dataProducts and pipeline properties in /customProperties api.
- **Minor**: Improve cron expression validations.
- **Minor**: Change log localization improvement.
- **Minor**: Async test case result deletion.
- **Minor**: Retention period 'Cancel' international display issue.
- **Minor**: Added limits configuration in telemetry payload. ${CollateIconWithLinkMD}
- **Improvement**: Logout user on unsuccessful refresh attempt.
- **Improvement**: Support for Domain hierarchy listing.
- **Improvement**: Avoid usage of CONCAT in WHERE clause.
- **Improvement**: Glossary column width sizes for the resizable columns.
- **Improvement**: Move Recreate Out of executors.
- **Improvement**: Supported the task filter on landing page feed widget.
- **Improvement**: Implement Data Quality Dashboards (Incident Manager + Data Quality).
- **Improvement**: Added loading state, and manage error notification in TestSuite.
- **Improvement**: Enhance Kafka SSL configuration support with consumerConfigSSL.
- **Improvement**: Add prometheus counter for search and database.
- **Improvement**: Retention Application : Delete change_events, activity threads, versions based on admin retention policies.
- **Improvement**: Show displayName for custom dashboards. ${CollateIconWithLinkMD}
- **Improvement**: Support rename for custom dashboard and charts. ${CollateIconWithLinkMD}
- **Improvement**: Improve Onboarding Application. ${CollateIconWithLinkMD}
`,
    },
  },
  {
    id: 60,
    version: 'v1.6.4',
    description: 'Released on 19th February 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   **Improvement**: Trino Add missing import.
-   **Improvement**: Optimise Pipeline Lineage Extraction.
-   **Improvement**: Powerbi fetch workspaces failure handle.
-   **Fix**: Powerbi test connection sucess with bad credentials.
-   **Fix**: Remove description check for columnDescriptionStatus.
-   **Fix**: Markdown editor fix.
-   **Fix**: Postgres usage not terminating with bad connection.
-   **Fix**: Fix followers for Data Insights index.
-   **Fix**: Add support for temp table lineage.
-   **Fix**: Exclude deleted Stored Procedure Snowflake.
-   **Fix**: Fix databricks schema not found.
-   **Fix**: API service schema fields of object type not listed.
-   **Fix**: Multiple Tier selection not resulting correct DQ dashboard view.
-   **Fix**: Not able to edit sql query from test case details page.
-   **Fix**: Implement the right SQA Sampler for UnityCatalog.
-   **Fix**: Fix dbt Test case Timestamp issue.
-   **Fix**: Delete pipelines from logical suites at deletion.
-   **Fix**: Table Update Sys Metric shows wrong value.
-   **Fix**: Fix unity catalog lineage - handle errors.
-   **Improvement**: Validate basic suites do have basicEntityRef.
-   **Improvement**: Add support for cluster key information - bigquery.
-   **Improvement**: Automator - Remove tags by label type.
-   **Improvement**: Show sub domain assets to top level.
-   **Improvement**: Sort Enum type Custom Property Values.
-   **Improvement**: Modify the appeariance of self connecting edge lineage.
-   **Improvement**: Global search should persist quick filter in explore.
-   **Improvement**: Show sourceUrl if present.
-   **Improvement**: Modify the lineage alignment algorithm to tree view.


`,
    },
  },
  {
    id: 61,
    version: 'v1.6.5',
    description: 'Released on 27th February 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   Fix hyperlink encoding for alerts and notifications
-   Fix failed tests sample data exception management
-   Fix MySQL and MariaDB window function computation when no database is added in the connection
-   Add support for tags and glossary terms in Domains and Data Products
-   Fix consolidation issues on incremental changes
-   Fix snowflake lineage Key Error
-   Fix iframe SSO setup
-   Support pagination for container children`,
    },
  },
  {
    id: 62,
    version: 'v1.6.6',
    description: 'Released on 14th March 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   Added loggedInAPI to show more specific error messages instead of generic ones
-   Added support for \`/logout\` path to perform logout from API redirect
-   Added displayName field in the \`createCustomProperty\` schema
-   Improved search relevancy for plural/singular words and partial matches
-   Introduced "clear sample" option in entity config to support explicit null
-   Made domain a required field for Data Product creation
-   Enabled showdown rendering options`,

      Fixes: `-   Fixed Snowflake ARRAY column ingestion issues
-   Fixed Sigma workbook ingestion
-   Fixed tomcat-jdbc dependency
-   Fixed schema URL construction
-   Fixed Redshift view logging for no schema binding
-   Fixed OpenMetadata Operations
-   Added support for datatype=array without type consistency
-   Added result_maker check for query share URL in Looker
-   Supported request schema field for OpenAPI lineage when response field is absent
-   Fixed tour page clicking issues
-   Fixed duplicate activity feed providers
-   Fixed search query for non-admin pages
-   Fixed other columns visibility when testSuite name is large
-   Fixed task description viewer for diff creation
-   Fixed inherited owner not updating in Data Product list
-   Fixed user update roles
-   Fixed table constraint error
-   Fixed manual constraints deletion
-   Fixed deletion of entities
-   Fixed entity relation live indexing
-   Fixed service creation error display
-   Improved memory handling in temp table lineage
-   Enhanced Column Name Scanner
-   Improved pipeline service client exception handling
-   Updated Tableau documentation in Connectors
-   Optimized pipeline service client initialization
-   Implemented Incremental Lineage Processing
-   Don't overwrite query to execute
-   Fixed external app logs
-   Fixed incremental lineage processing when processedLineage is null`,
    },
  },
  {
    id: 63,
    version: 'v1.6.7',
    description: 'Released on 28th March 2025.',
    features: [],
    changeLogs: {
      Improvements: `-   Lineage Improvements
-   Added Tableau Custom SQL lineage support
-   Added column count validation when creating table-type custom property
-   Transformed Reserved keywords like quotes to OM compatible
-   Added missing timestamp indexes for time series tables
-   Enhancing FQN Handling: Support for Quoted Identifiers`,

      Fixes: `-   Fixed potential Okta login issues by clearing state to avoid login errors
-   Fixed MariaDB profiling with Time datatype
-   Fixed handling of Sample Data with non-utf8 characters
-   Fixed test connection showing timeout after successful connection
-   Fixed DBT logs and improved error handling
-   Fixed Test Suite 'NoneType' object has no attribute 'id' handling
-   Fixed delete entity relation live indexing
-   Fixed Data Insights Data Stream deletion on OpenSearch
-   Fixed soft delete and restore functionality
-   Corrected childrenCount for Organizations in Teams
-   Fixed custom dashboard issue with term type of data
-   Lower training window for Collate Anomaly detection model ${CollateIconWithLinkMD}`,
    },
  },
  {
    id: 64,
    version: 'v1.6.8',
    description: 'Released on 8th April 2025.',
    features: [],
    changeLogs: {
      Improvements: `-  Added support for Wherescape connector.${CollateIconWithLinkMD}
      -  PowerBI owners ingestion for assets, improved filter query performance.
      -  REST connector enhancements.
      -  Implement column validation in lineage patch api.
      `,
      Fixes: `-  Fixed tableau ingestion for null upstream table queries.
      -  Fixed public schema lieage for postgres.
      -  Fixed PowerBI filter query.
      -  Fixed IncidentManager date filtering and update table column title.
      -  Fixed dbt cloud latest run execution.
      -  Fixed Unpinned google-cloud-secret-manager version in ingestion dependencies.
      -  Fixed update query to fix domain asset update.
      -  Fixed DQ for local webserver.${CollateIconWithLinkMD}
      -  Fixed placeholder issue for empty metrics.${CollateIconWithLinkMD}
      `,
    },
  },
  {
    id: 65,
    version: 'v1.6.9',
    description: 'Released on 17th April 2025.',
    features: [],
    changeLogs: {
      Fixes: `-  Made Fields immutable for Applications.
      `,
    },
  },
  {
    id: 66,
    version: 'v1.6.10',
    description: 'Released on 23rd April 2025.',
    features: [],
    changeLogs: {
      Fixes: `-  Use Subset of Permissions for add delete Users in teams.
      `,
    },
  },
  {
    id: 67,
    version: 'v1.6.11',
    description: 'Released on 28th April 2025.',
    features: [],
    changeLogs: {
      Fixes: `-  Fixed isOwner permission issue for domains and dataProducts.
      `,
    },
  },
  {
    id: 68,
    version: 'v1.7.0',
    description: 'Released on 15th April 2025.',
    features: [
      {
        title: `Automate Metadata Onboarding Instantly with OpenMetadata AutoPilot`,
        description: `Data teams often face manual, repetitive tasks onboarding new services—configuring workflows individually for schemas, lineage, usage, and profiling. This slows down onboarding and can cause inconsistent metadata coverage.

OpenMetadata’s AutoPilot makes onboarding effortless:

•	**Automated Workflows:** Automatically triggers metadata extraction for schemas, lineage, usage, and profiling whenever a new service is added. No manual setup required.
•	**Optimized Filtering:** Includes default filters for relevant metadata, with the flexibility to add custom filters, ensuring consistency and efficiency.
•	**Immediate Insights:** Provides real-time KPIs on asset distribution, metadata coverage (descriptions, ownership), tiering, and PII tagging to proactively improve data governance.
	`,
        isImage: false,
        path: 'https://www.youtube.com/embed/lo4SrBAmTZM',
      },
      {
        title: `Automate Documentation, Classification, and Data Quality with Collate AI Agents`,
        isCollate: true,
        description: `Collate is enhancing AutoPilot by integrating powerful AI Agents that automate critical metadata tasks—saving your team time and increasing metadata coverage instantly.

• Automated Tiering: The Tier Agent analyzes usage patterns and lineage to automatically identify the business-critical data assets within your organization.
• Intelligent Documentation: The Documentation Agent automatically generates accurate descriptions of your data assets and powers a seamless Text2SQL chat experience.
• Data Quality Automation: The Data Quality Agent intelligently creates Data Quality tests based on data constraints and learns from existing tests across similar datasets.

With Collate AI Agents in AutoPilot, it’s like adding expert team members who streamline metadata management—accelerating onboarding, improving governance, and freeing your team to focus on higher-value tasks.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/PKvKWZ8vseU',
      },
      {
        title:
          'Customize Your Data Discovery with Enhanced Search Relevancy Settings',
        description: `As your data platform expands, quickly finding the most relevant data assets becomes essential. OpenMetadata already boosts search results based on business-criticality (Tiers) and usage patterns—but your organization’s preferences might vary.

With the new Search Relevancy Settings, OpenMetadata gives you complete control to tailor your discovery experience by:
• Fine-tuning searchable fields such as asset names, descriptions, or column details.
• Adjusting result boosting based on default properties like Tiers and usage, or adding custom tags to further enhance relevancy.
• Applying customized ranking across all data assets or specific asset types like Tables, Dashboards, or Topics.

Ensure users always discover the right data, quickly and intuitively, by customizing your search experience with OpenMetadata’s enhanced relevancy settings.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/9Uy95t11hs0',
      },
      {
        title: `Navigate Your Data Ecosystem with Hierarchical Lineage`,
        description: `OpenMetadata’s enhanced Lineage UI in Release 1.7 introduces Hierarchical Lineage Layers,

enabling teams to intuitively explore data lineage from a high-level overview down to granular details:
•	Service Layer provides visibility into data flows between different platforms or services.
•	Domain Layer clearly illustrates how data traverses across Data Mesh domains.
•	Data Product Layer shows lineage across specific data products, aligning closely with business definitions.

Alongside these layers, column-level lineage remains easily accessible, helping teams precisely understand data transformations and impacts, simplifying root-cause analysis and governance decisions.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/5iiN2gtJzwo',
      },
      {
        title: 'Simplify the User Experience with Persona-Based Customizations',
        description: `OpenMetadata provides detailed information on your data assets—covering schema, lineage, data quality, and observability. But different user personas have different needs and workflows, and one size doesn’t fit all.

With Release 1.7, you can now fully personalize OpenMetadata’s user experience based on defined User Personas, making the platform simpler and more intuitive:
•	Navigation Panel Customization: Tailor the navigation panel by adding, removing, or sorting elements to match the workflow of each persona.
•	Data Assets & Governance Entities: Reorganize, add, or remove tabs and customize widget layouts—highlighting relevant custom properties, descriptions, or key insights specific to each persona.

Persona-based customization ensures each user sees only what’s relevant and important to their role, streamlining workflows, improving usability, and enhancing adoption across your organization.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/Cf-dSJLRQcc',
      },
      {
        title: 'Discover the Right Data Even Faster with an Enhanced UX',
        description: `OpenMetadata is already known for its intuitive UI and simplified user experience. In Release 1.7, we’ve elevated the UX further, making it even easier for diverse user personas to quickly find and act on the data they need.

Key UX improvements include:
•	Streamlined Navigation: Simplified navigation panels to quickly guide users through key actions.
•	Clearer Asset Information: Improved placement and labeling of critical information on data asset pages, ensuring immediate understanding.
•	Enhanced User Profiles: Restructured user pages for better visibility into profile details and more intuitive management of open tasks.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/r5CMDA4Fcsw',
      },
      {
        title:
          'Automatically Propagate Collate Metadata into Your Data Platforms',
        isCollate: true,
        description: `Collate already simplifies capturing and managing metadata—tags, descriptions, and ownership—across your entire data ecosystem. But making sure this enriched metadata reaches back into your source systems is equally crucial.

With the new Reverse Metadata feature, you can automatically push centralized metadata from Collate directly back into your databases (MySQL, Postgres), warehouses (Snowflake, BigQuery), and dashboards (e.g., Power BI). Simply select which assets should synchronize, and your source systems will instantly receive metadata updates in real time.

This seamless, two-way metadata synchronization enables powerful governance use-cases—such as automating data masking policies in Snowflake based on centrally managed tags—and turns Collate into a single source of truth at the heart of your end-to-end automated governance strategy.`,
        isImage: false,
        path: 'https://www.youtube.com/embed/EWYDfhCgW8k',
      },
    ] as CarousalData[],
    changeLogs: {
      ['Breaking changes']: `### Removing Support for Python 3.8

Python 3.8 was [officially EOL on 2024-10-07](https://devguide.python.org/versions/). Some of our dependencies have already started removing support for higher versions, and we are following suit to ensure we are using the latest and most stable versions of our dependencies.

This means that for Release 1.7, the supported Python versions for the Ingestion Framework are 3.9, 3.10, and 3.11.\
We were already shipping our Docker images with Python 3.10, so this change should not affect you if you are using our Docker images. However, if you installed the openmetadata-ingestion package directly, please make sure to update your Python version to 3.9 or higher.`,
      ['Expanded Connector Ecosystem and Diversity']: `OpenMetadata's ingestion framework contains 90+ native connectors. These connectors are the foundation of the platform and bring in all the metadata your team needs: technical metadata, lineage, usage, profiling, etc.

We bring new connectors in each release, continuously expanding our coverage. This time, Release 1.7 comes with four new connectors:
• **Opensearch**: Bringing your index metadata into OpenMetadata.
• **Cassandra**: Ingesting from the NoSQL Distributed Database.
• **Cockroach DB**: The cloud native distributed SQL Database.

And in Collate, we are bringing a new Pipeline connector: **Wherescape**.`,
    },
  },
  {
    id: 69,
    version: 'v1.7.1',
    description: 'Released on 22nd May 2025.',
    features: [],
    changeLogs: {
      Improvements: `- Login page UI.
- DQ failure lineage tracing.
- Add Domain selection while creating tags.
- Add support for Korean language.
- Support edit display name for dashboard Data model.
- Configurable account usage for incremental metadata extraction.
- Add athena schema comment support.
- Support dynamic height for detail page widgets.
- Add support for following databases, schemas and services.
- Allow editing of sql function in column level lineage.
- Support chart export in cost analysis.
- Add domain-level permissions while creating/updating dataProduct.
- Add support to add and edit Data Product from entity page.
- Add bulk edit action for glossary listing page.
- PDF export quality.${CollateIconWithLinkMD}
- Support un-nesting to parent level knowledge article.${CollateIconWithLinkMD}
- Support brush for zoom support within charts.${CollateIconWithLinkMD}
      `,
      Fixes: `- Severity on incident POST creation.
- Service insights PDF export.
- Can't run table diffs on snowflake when using private key authentication.
- Self signup login error not showing.
- Service connection config not getting updated with multiple project ids after ingestion .
- Data assets order in explore left panel.
- Added display name and description in Testcase Alert emails.
- PostgreSQL schemas getting filtered out.
- Make prompt=login as optional.
- Apps allowing submission of negative numbers for some config fields.
- Error Connecting S3 container to pipeline or tables in lineage edit mode.
- Mentions on task should trigger @mention alert.
- Postgres Duplicate table constraint error when re-ingesting.
- Unsupported Pipeline entity for lineage error.
- Issue with refresh for loggedInUser return 401.
- Render settings menu based on permissions.
- Data products not visible when redirecting from assets listing to entity page.
- Make certification always visible.
- Dots are misaligned / unclear in multi-metric view of Test Case Metrics.
- Snowflake Tags Not Reattached or Re-ingested After Initial Ingestion.
- Remove data products associated with the old domain when an entity's domain is updated.
- Multiple image insertion issue and ensure proper inline error messaging for Rich Text Editor.
- Handle udf definition fetch exceptions.
- parquet endpoint null case error.
- Deleted user page shows a spinner instead of "User not found".
- Enum cleanup not triggering when all enum keys are removed in custom property.
- Inconsistent behavior when reassigning asset to a different domain via bulkAsset API.
- Airbyte pipeline lineage extraction.
- Add include field for list incident API.
- Metadata ingestion errors from Azure Data Lake.
- Support Ingesting Multiple Owners for dbt Models from manifest.json.
- Error ingesting using Datalake adls connector.
- PostgreSQL Sample Data Err- FATAL: too many connections for role "role_name".
- Testcase "Column values to be uniqu- oracledb error (ORA-00937).
- Alert Triggering on Both Failure and Success of the Test Case even if configured for failure only.
- PBI lineage when source parameters are used and lineage needs to be created from source expression.
- Comments not reflecting after ingestion for DB columns in Vertica.
- Custom theme styling issues.
- Entity right panel collapsing issue.
- Feeds count not showing up in PipelineDetails page.
- Reverse metadata workflow exits with 1 when test connection fails.${CollateIconWithLinkMD}
- Knowledge center card in entity page not containing data.${CollateIconWithLinkMD}`,
    },
  },
  {
    id: 70,
    version: 'v1.7.2',
    description: 'Released on 10th June 2025.',
    features: [],
    changeLogs: {
      Improvements: `-  Make trino query table configurable.
-  Pendo Add Company Name Details.   
-  Add Databricks Sampler and refactor Unity Catalog Sampler.
-  Added Looker column lineage between views and tables.
-  Added Looker column lineage between explores and views.
-  Add  dbt tags Filter.
-  Add a tool to openmetadata-ops.sh to delete orphaned relations.
-  Add lineage dialect for Exasol, Trino and Vertica.
-  Upgrade google-cloud-secret-manager python requirement version.
-  Add data insights migrations to remove stale objects.
-  Add Turkish language.
-  Add method to filter ingestion pipeline based on metadata
-  Improve renderning time for profiler chart for large amount of data.
-  Add logic to handle WorkflowContext on Ingestion.
-  Pendo Integration key in api response.
-  SSIS Connector.
-  Improve pdf export image file and supported dynamic spacing.
-  Reverse Metadata Extensions.`,
      Fixes: `- Explore tabs with elipsis to render label and count properly.
- Add mention of why snowflake owners are not supported.
- TooManyNestedClauses: Query contains too many nested clauses.
- Bigquery import issue.
- Loading issue for react-awesome-query.
- Japanese localization: update "view-in-service-type" translation from "{{serviceType}}에서 보기" to "{{serviceType}}で表示".
- Fix jakarta to javax
- SearchIndexing: Limit of total fields [1000] has been exceeded.
- db2 custom driver installation.
- Domain not getting removed through import.
- Freshness test timestamp display to show correct time values.
- Update the file upload option input for service config.      
- Remove the type not wanted in pdfLayout config.
- Profile config plus icon misaligned.
- Lineage upstream having additional nodes.
- Tableau Improvements.
- Tableau Validation Errors.
- Looker cll parsing issue. 
- Looker CLL errors.
- Domain truncate issue and consistent Domain UX.
- Issue related to SQL query viewer.
- Profile redirection issue for displayname.
- Entity header truncate issue.
- Select popup sticky for scrollable container.
- Overflow for frequently joined table widget.
- Persona switching not updating if customization not present.
- Schema / tags/ api collection switch does not update content in UI.
- Copy-Paste from Excel triggers file upload instead of pasting content.
- Add data insights migrations to remove stale objects.
- Added displayName to add Asset Selection Model.
- Background color for text highlight in tables of explore cards.
- Glossary permission error.
- Fix missing pydantic_fields exceptions.
- Flickering and tooltip issue in lineage node columns.
- Row sampling error.
- Tier tag not updating in search filters.
- Add support for multiple owners for dbt models.
- Remove unused import of getBasePath from RouterUtils.ts.
- Tags dropdown overlapping if multiple open at a time.
- Filter Ingestion Pipelines by provider.
- Automation Workflows should not be updated by the SM & cleanup migration.
- Fix bot being used in pipelines and workflows.
- Remove Tier filters from AI agents in AutoPilot.
- Lineage child node column name not taking remaining space in card and showMoreButton.
- Handle logout gracefully.
- Databricks Schema Description.
- Dashboard data model name column should not be link.
- Pagination limit for dashboards.
- Add agents dropdown not showing auto-classification agent option.
- Filter announcment widget from customisation.
- Updated snowflake test based on new configs.
- PII DateTime False Positives.
- Profile Picture display issues.
- Persona customization widgets style issues.
- Update Lightdash connector.
- Doris ingestion failed.
- Query builder widget any and not operations.
- Revert search order and minor styles changes.
- Bump indices.query.bool.max_clause_count=4096.
- Make presidio_analyzer a lazy import in the PII processor.
- PBI dataset expressions empty value fix.
- Fix limits & logging.
- Import failing on database service due to double encoding.
- Auto Tier w/ followers serialization. 
- Clean description from WAII.
- Review activity handling.
- Fix setIdleTimeout with lower jetty version.
- Fixed the new tags component not showing in the automator form. 
- Remove SearchSuggest.
`,
    },
  },
  {
    id: 71,
    version: 'v1.7.3',
    description: 'Released on 13th June 2025.',
    features: [],
    changeLogs: {
      Improvements: `- Add missing ngram fields for displayName and name in jp/zh indexes.
- Improve UC owner ingestion.
- Add missing Data space type in qlikcloud.
- Added Microstrategy Lineage`,
      Fixes: `- Close emoji feed editor on outside click.
- Close profile dropdown on redirection to user profile page.
- Lineage expand collapse operation on nodes.
- Hashlist in view blocks leftsidebar.
- Test Cases Not Returned When Service Name Contains Spaces.
- Update Reset Link Template.
- Unable to connect to Opensearch using AWS Credentials.
- Tag search based on displayName.
- Fix Hybrid Websocket Timeout. ${CollateIconWithLinkMD}
- Fix automator for empty description entities & children. ${CollateIconWithLinkMD}
`,
    },
  },
  {
    id: 72,
    version: 'v1.7.4',
    description: 'Released on 17th June 2025.',
    features: [],
    changeLogs: {
      Fixes: `- Lineage export image cropping issue.
- Advanced search 'Deleted' filter not working.
`,
    },
  },
  {
    id: 73,
    version: 'v1.7.5',
    description: 'Released on 20th June 2025.',
    features: [],
    changeLogs: {
      Fixes: `- Lineage expand collapse nodes.
- Default boost score and improve fqn parsing.
- OpenSearch by default limits the number of characters, if the field is very large then the limit gets exceeded. 
- Handled spaces in database, schema, table, and column names across all connectors for reverse metadata. ${CollateIconWithLinkMD}
`,
    },
  },
  {
    id: 74,
    version: 'v1.8.0',
    description: 'Released on 22nd June 2025.',
    features: [
      {
        title: `🚀 OpenMetadata MCP Server — Generative-AI-Ready Metadata Providing Rich Data Context
`,
        description: `OpenMetadata 1.8 debuts an enterprise-grade MCP server built natively on top of our unified knowledge graph. This new service exposes a single, high-performance API layer that lets any Large Language Model—or any downstream application—pull rich, policy-aware context about your data in real time.

MCP Server:

•	**One graph, One endpoint:** The MCP server surfaces every entity, relationship, data quality, lineage and governance  you’ve already enriched in OpenMetadata.
•	**LLM-friendly responses:** JSON schemas are optimized for semantic search and RAG workflows, so your chatbots and copilots can ground answers in trustworthy, up-to-date metadata.
•	**Enterprise-ready controls:** Provides real-time KPIs on asset distribution, metadata coverage (descriptions, ownership), tiering, and PII tagging to proactively improve data governance.
•   **Zero-friction adoption:** It ships with OpenMetadata—just enable the service, grab an API key, and start querying from Claude, Cursor, ChatGPT etc..

With MCP, every data consumer—from analysts in a BI tool to autonomous agents writing SQL—can instantly understand tables, lineage, quality, and ownership without leaving their workflow.
	`,
        isImage: false,
        path: 'https://www.youtube.com/embed/m96F-7gXvfo',
      },
      {
        title: `SCIM Provisioning for Okta & Azure AD — Hands-free User & Group Management`,
        isCollate: true,
        description: `Collate 1.8 extends our SSO portfolio with native SCIM 2.0 support, starting with Okta and Azure Active Directory. Enterprises can now manage the full user-lifecycle directly from their Identity Provider—no more CSV uploads or manual role assignments

• **Automated onboarding & off-boarding:** The Tier Agent analyzes usage patterns and lineage to automatically identify the business-critical data assets within your organization.
• **Consistent governance:** The Documentation Agent automatically generates accurate descriptions of your data assets and powers a seamless Text2SQL chat experience.
• **Standards-based interoperability:**  Built on the SCIM specification so future IdPs (JumpCloud, OneLogin, etc.) can be added with minimal effort.
Coupled with existing SAML/OIDC SSO, SCIM rounds out a turn-key identity stack—letting security teams sleep easy while data users get frictionless access.`,
        isImage: false,
      },
    ] as CarousalData[],
    changeLogs: {
      ['Breaking changes']: `

• **Java 21**: OpenMetadata Server upgraded to use Java 21
• **CreateTestCase Model**: testSuite field from createTestCase models has been removed. 
• **DropWizard 4.x**: OpenMetadata Server upgraded to use  latest DropWizard 4.x framework for serving APIs.`,
      ['Improvements']: `
- Large column pagination to improve page loading in Tables and Dashboard Data Model
- Ownership functionality for Classification
- Support Certifications for Data assets
- Export PDF for custom dashboards improvements ${CollateIconWithLinkMD}
- Support for running application under sub path (#1558)`,
      ['Fixes']: `- Explore page deleted filter, shows Knowledge page articles
- Add support for trino reverse metadata (#1707)
- Automator for empty description entities & children (#1714)
- List all incidents column & tables (#1691)
- Review activity handling (#1654)
- Clean description from WAII (#1652)
- Auto Tier w/ followers serialization (#1649)
- Import failing on database service due to double encoding (#1642)
- Handled spaces in database, schema, table, and column names across all connectors for reverse metadata 
- Collate AI Doc to check description root (#1599)
- Toggle Ingestion Runner postgres SQL (#1596)
- Permission placeholders for knowledge center (#1585)
- Clean fqn or search or hash params from Pendo location (#1569)
- Data asset widget add UI / UX improvement (#1579)
- Styles for add automator form (#1578)
- Fix app config handling (#1572)
- Knowledge center card in entity page not containing data (#1564)
- Improve handling of app resource init for preview apps (#1521)
- Tree dropdown for glossary terms inside quick link form (#1561)
- Stitch Validation Error (#1553)
- Trigger argo workflows with ad-hoc config (#1345)
- Query card styles for query page (#1518)
- Port raiseOnError to Collate (#1509)
- Handle logging and exception handling for hybrid (#1514)`,
    },
  },
];
