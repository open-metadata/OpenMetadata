# 1.2.0 Release 🎉

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.2.0!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.2.0-release).

## Domains and Data Products
- Added support for Domains and Data Products.
- Assets can be added to a Domain, and users can scope their discovery experience to one Domain.
- Assets can also be added as Data Products in a Domain.

## Search Index
- Elasticsearch or Opensearch connectors can now bring in the search index metadata into OpenMetadata.
- The connector will populate the index’s mapping, settings, and sample data.

## Stored Procedures
- Added support for Stored Procedures.
- Snowflake, Redshift, and BigQuery connectors are updated to bring stored procedure metadata into OpenMetadata.
- The metadata workflow will bring the Stored Procedures and parse their executions to extract lineage information.

## Glossary Approval Workflow & Glossary Styling
- Introduced a glossary approval workflow. An approval workflow is created if Reviewers are added to a glossary.
- A task is added for reviewers to approve or reject the glossary term. The terms will show up in Draft status.
- Only the reviewers can approve or reject the term.
- Conversations are supported to discuss further about the terms.
- If no reviewer is added, then the glossary terms are approved by default.
- Introduced styling for glossary terms. Now you can add icons and color code the glossary terms for easy identification.
- Color coding helps to visually differentiate and identify the data assets, when glossary terms are added to them.

## OpenMetadata Browser Extension
- Updated the Chrome browser extension for OpenMetadata with the new UI.
- Added support for Databases, Database Schemas, Tables, Dashboards, Charts,  Pipelines, and Topics.

## Build Automation Applications

{%  youtube videoId="pUS9-RevqsU" start="0:00" end="0:57" width="560px" height="315px" /%}

- Added Applications into OpenMetadata, giving users a unique view of processes that can be scheduled and run in the platform.
- Search Indexing and Data Insights Report have been converted into Applications.
- UI displays all the available applications, which Admins can add or schedule.
- We will continue to add new Applications in upcoming releases.

## Lineage
- Performance improvements made for lineage based on the new release of SQLfluff.
- Added support for `UPDATE … FROM Snowflake` queries
- Added column-level lineage support for `SELECT *` queries

## Connectors
- Greenplum connector is now supported.
- Couchbase connector is now supported.
- Azure Data Lake Storage is now supported. (Collate)

## Customizable Landing Page

{%  youtube videoId="Y-5cPQgzNdo" start="0:00" end="2:08" width="560px" height="315px" /%}

- Admins can create Personas to group individuals in their company, such as Data Engineers, Data Stewards, or Data Scientists.
- Admins can customize the landing page for each Persona with a set of supported widgets: Activity Feed, Announcements, Knowledge Center, etc.
- We will add support for more widgets in upcoming releases.

## Knowledge Center (Collate)

{%  youtube videoId="DfOgeZ9f7no" start="0:00" end="3:04" width="560px" height="315px" /%}

- Backend APIs support creating, editing, and listing knowledge articles (with external links).
- Knowledge articles and links can be associated with a Domain, Team, or an Entity.
- UI support to build a Knowledge Center and expand the documentation of your company.

## Cost Analysis Report (Collate)

{%  youtube videoId="KI58oBHxTOU" start="0:00" end="0:33" width="560px" height="315px" /%}

- The Usage Workflow will now also track how tables are Accessed and Updated.
- This information will be used in the Data Insights workflow to show the evolution of your used and unused assets and compare them by size.
- Support has been added for Snowflake, and we will continue to add more sources in upcoming releases.
