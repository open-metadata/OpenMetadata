# Prerequisites

Everytime that you plan on upgrading OpenMetadata to a newer version, make sure to go over all these steps:

### Backup your Metadata

Before upgrading your OpenMetadata version we strongly recommend backing up the metadata.

The source of truth is stored in the underlying database (MySQL and Postgres supported). During each version upgrade there
is a database migration process that needs to run. It will directly attack your database and update the shape of the
data to the newest OpenMetadata release.

It is important that we backup the data because if we face any unexpected issues during the upgrade process, 
you will be able to get back to the previous version without any loss.

{% note %}

You can learn more about how the migration process works [here](/deployment/upgrade/how-does-it-work).

**During the upgrade, please note that the backup is only for safety and should not be used to restore data to a higher version**.

{% /note %}

Since version 1.4.0, **OpenMetadata encourages using the builtin-tools for creating logical backups of the metadata**:

- [mysqldump](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html) for MySQL
- [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) for Postgres

For PROD deployment we recommend users to rely on cloud services for their databases, be it [AWS RDS](https://docs.aws.amazon.com/rds/),
[Azure SQL](https://azure.microsoft.com/en-in/products/azure-sql/database) or [GCP Cloud SQL](https://cloud.google.com/sql/).

If you're a user of these services, you can leverage their backup capabilities directly:
- [Creating a DB snapshot in AWS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateSnapshot.html)
- [Backup and restore in Azure MySQL](https://learn.microsoft.com/en-us/azure/mysql/single-server/concepts-backup)
- [About GCP Cloud SQL backup](https://cloud.google.com/sql/docs/mysql/backup-recovery/backups)

You can refer to the following guide to get more details about the backup and restore:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    icon="luggage"
    bold="Backup Metadata"
    href="/deployment/backup-restore-metadata" %}
      Learn how to back up MySQL or Postgres data.
  {% /inlineCallout %}
{% /inlineCalloutContainer %}

## Understanding the "Running" State in OpenMetadata

In OpenMetadata, the **"Running"** state indicates that the OpenMetadata server has received a response from Airflow confirming that a workflow is in progress. However, if Airflow unexpectedly stops or crashes before it can send a failure status update through the **Failure Callback**, OpenMetadata remains unaware of the workflow’s actual state. As a result, the workflow may appear to be stuck in **"Running"** even though it is no longer executing.  

This situation can also occur during an OpenMetadata upgrade. If an ingestion pipeline was running at the time of the upgrade and the process caused Airflow to shut down, OpenMetadata would not receive any further updates from Airflow. Consequently, the pipeline status remains **"Running"** indefinitely.

{% image
  src="/images/v1.7/deployment/upgrade/running-state-in-openmetadata.png"
  alt="Running State in OpenMetadata"
  caption="Running State in OpenMetadata" /%}

### Expected Steps to Resolve
To resolve this issue:  
- Ensure that Airflow is restarted properly after an unexpected shutdown.  
- Manually update the pipeline status if necessary.  
- Check Airflow logs to verify if the DAG execution was interrupted.

### Update `sort_buffer_size` (MySQL) or `work_mem` (Postgres)

Before running the migrations, it is important to update these parameters to ensure there are no runtime errors.
A safe value would be setting them to 20MB.

**If using MySQL**

You can update it via SQL (note that it will reset after the server restarts):

```sql
SET GLOBAL sort_buffer_size = 20971520
```

To make the configuration persistent, you'd need to navigate to your MySQL Server install directory and update the
`my.ini` or `my.cnf` [files](https://dev.mysql.com/doc/refman/8.0/en/option-files.html) with `sort_buffer_size = 20971520`.

If using RDS, you will need to update your instance's [Parameter Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html)
to include the above change.

**If using Postgres**

You can update it via SQL (not that it will reset after the server restarts):

```sql
SET work_mem = '20MB';
```

To make the configuration persistent, you'll need to update the `postgresql.conf` [file](https://www.postgresql.org/docs/9.3/config-setting.html)
with `work_mem = 20MB`.

If using RDS, you will need to update your instance's [Parameter Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html)
to include the above change.

Note that this value would depend on the size of your `query_entity` table. If you still see `Out of Sort Memory Error`s
during the migration after bumping this value, you can increase them further.

After the migration is finished, you can revert this changes.

# Backward Incompatible Changes

## 1.7.0

### Removing support for Python 3.8

Python 3.8 was [officially EOL on 2024-10-07](https://devguide.python.org/versions/). Some of our dependencies have already
started removing support for higher versions, and are following suit to ensure we are using the latest and most stable
versions of our dependencies.

This means that for Release 1.7, the supported Python versions for the Ingestion Framework are 3.9, 3.10 and 3.11.

We were already shipping our Docker images with Python 3.10, so this change should not affect you if you are using our Docker images.
However, if you installed the `openmetadata-ingestion` package directly, please make sure to update your Python version to 3.9 or higher.

### Putting your Metadata Ingestion on AutoPilot

{%  youtube videoId="lo4SrBAmTZM" start="0:00" end="2:06" width="800px" height="450px" /%}

OpenMetadata provides workflows out of the box to extract different types of metadata from your data services such as schemas, lineage, usage and profiling. To accelerate the onboarding of new services, we have created the new AutoPilot Application, which will automatically deploy and trigger all these Metadata Agents when a new service is created!

As part of the new flow, we’ve also improved how you define filters for your service: We’re adding default filters to ensure you are only ingesting relevant metadata and giving you the autonomy to add other default filters that can be applied to any other workflow. This helps you move faster and ensure consistency.

Additionally, the new Service Insights page provides immediate KPIs on your data, based on your data assets distribution, and coverage on key metrics such as descriptions, ownership, tiering and PII.

With OpenMetadata AutoPilot, you can get all of your metadata with just one click!

### Accelerating Onboarding New Services with AI Agents

{%  youtube videoId="mn4edHpHZWo" start="0:00" end="1:45" width="800px" height="450px" /%}

At Collate, we’re taking the AutoPilot experience one step further by adding AI Agents to the mix. Based on the information extracted from the Metadata Agents, Collate AI Agents will automatically generate tiers, descriptions, and Data Quality tests:

- The Tier Agent analyzes your table usage and lineage to determine the business criticality of each asset in your organization.
- The Documentation Agent automatically generates descriptions based on the shape of your data, as well as enabling a Text2SQL chat experience.
- The Data Quality Agent validates tables’ constraints to intelligently create Data Quality Tests, in addition to learning from what tests are already present in similar tables.

Collate also brings **enhanced Service Insights** helping you:

- Track how much metadata has been automatically generated by Collate AI.
- Identify your Service distribution of PII and Tiers.
- Analyze what are your most used data assets.
- As well as a new view for your most expensive queries for Snowflake and BigQuery, which you can then have Collate AI optimize for you!
- And understand the Data Quality health and coverage of your Service.

Collate AI Agents in AutoPilot are like having additional team members, helping you evaluate your metadata management to the next level while saving you time and resources.

### Boosting your Discovery thanks to Search Relevancy Settings

{%  youtube videoId="9Uy95t11hs0" start="0:00" end="1:56" width="800px" height="450px" /%}

As Data Platforms grow, ensuring that the right piece of data appears first for your search results can help reduce time to action for your users. OpenMetadata was already boosting results based on Tiers - business criticality - and usage. However, different organizations might have different ranking needs based on other properties.

We are introducing Search Relevancy Settings to help you **customize the discovery** experience for your users, giving you complete control over:

- Choosing which fields of the asset you want to match during the search, such as names, descriptions, or columns.
- Changing the default boosting on Tiers and uage, or add other tags you want to boost higher.
- Specifying the above to all or specific asset types, such as Tables, Dashboards, or Topics.

Thanks to the new Search Relevancy customization, you can ensure your users will always find the right data!

### Understanding Data Better with New Lineage Layers

{%  youtube videoId="5iiN2gtJzwo" start="0:00" end="1:13" width="800px" height="450px" /%}

OpenMetadata continues to make improvements to the lineage, both in how we capture and parse queries, as well as how users can explore and utilize lineage information.

In Release 1.7, we’re adding exciting additions to the Lineage UI, including:

- An enhanced toolbar,
- A minimap to better explore large lineage,
- And new lineage layers!

The existing Column and Observability Layers already help you understand how your data moves, as well as analyze both the root cause and impact of Data Quality issues.

Now, we’re adding a **Service Layer**, giving you a comprehensive view of how data flows from service to service. We’re also introducing a Domain Layer, which will help you better visualize the shape of your Data Mesh, along with the Data Product Layer.

Lineage is a key element for understanding your data, and OpenMetadata enhances this further by providing even more perspectives to it.

### Catering to All your Users Needs with Persona Customizations

{%  youtube videoId="Cf-dSJLRQcc" start="0:00" end="2:32" width="800px" height="450px" /%}

OpenMetadata has detailed information about your data assets, including their schema, lineage, data quality, and observability. Now, we’ve focused on making sure different users can concentrate on the specific information most important for them!

In previous releases, we allowed the customization of the Landing Page based on your User Personas. Release 1.7 expands these capabilities to the left **navigation panel, governance entities**, and **data assets**.

- Add, remove, and sort the elements of the navigation panel,
- And for governance entities and data assets, reorganize the existing tabs, add new tabs, or remove them! You can then add and size widgets to better showcase Custom Properties, have larger spaces for descriptions, and more!

UI Customizations are a flexible and powerful approach that will let you tailor the experience for each of your users, improving the experience of managing all of your processes within OpenMetadata.

### Finding the Right Data Faster with the New UX

{%  youtube videoId="r5CMDA4Fcsw" start="0:00" end="1:24" width="800px" height="450px" /%}

With Release 1.7, we’ve invested in our core design principles with improvements to the User Experience, particularly for addressing the needs of the diverse Personas that rely on OpenMetadata daily.

These changes include:
- Streamlining the navigation panels, 
- Improving the placement and labeling of key information in the asset pages,
- And restructuring the information on user pages, highlighting profile information, and improving how users can navigate and manage their open tasks.

Combined with the improvements around Search Relevancy, Customizable UI for Personas, and the AutoPilot Application, this release accelerates the onboarding of both Services and users, in addition to making it easier for users to find the right data faster and act upon it.

### Activating your Metadata in Collate with Reverse Metadata

{%  youtube videoId="3RVTwfbgvLQ" start="0:00" end="2:16" width="800px" height="450px" /%}

Thanks to Collate’s collaboration and automation features, it’s simple to add tags, descriptions, and owners to all your assets. But how can we ensure this metadata is seen and used by the source systems as well?

Reverse Metadata is a new application that will allow you to send descriptions, tags, and owners collected in Collate back into the source! You can configure which assets you want to listen for changes, and updates will be **propagated in real time!**

Pairing this feature with source systems capabilities, such as Snowflake handling Masking Policies based on tags, it’s a powerful approach to centralize policy management directly in Collate.

Moreover, linking this application to other features such as Metadata Automations or Auto Classification workflows, Collate becomes a key pillar in your **end-to-end automated governance strategy**.

### Expanded Connector Ecosystem and Diversity

OpenMetadata’s ingestion framework contains 90+ native connectors. These connectors are the foundation of the platform and bring in all the metadata your team needs: technical metadata, lineage, usage, profiling, etc.

We bring new connectors in each release, continuously expanding our coverage. This time, Release 1.7 comes with four new connectors:

- **Opensearch:** Bringing your index metadata into OpenMetadata.
- **Cassandra:** Ingesting from the NoSQL Distributed Database.
- **Cockroach DB:** The cloud native distributed SQL Database.

And in Collate, we are bringing a new Pipeline connector: **Wherescape**.
