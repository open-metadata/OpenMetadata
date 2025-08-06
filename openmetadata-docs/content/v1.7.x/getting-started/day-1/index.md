---
title: Day 1 Setup Guide | Connect, Ingest & Collaborate in Collate
description: Start your Collate journey by connecting data sources, ingesting metadata, inviting users, and exploring key features. Everything you need for Day 1.
slug: /getting-started/day-1
collate: true
---

# Getting Started: Day 1

Get started with your Collate service in just few simple steps:

1. **Set up a Data Connector**: Connect your data sources to begin collecting metadata.
2. **Ingest Metadata**: Run the metadata ingestion to gather and push data insights.
3. **Invite Users**: Add team members to collaborate and manage metadata together.
4. **Explore the Features**: Dive into Collate's rich feature set to unlock the full potential of your data.

**Ready to begin? Let's get started!**

## Requirements

You should receive your initial Collate credentials from Collate support, or from your existing Collate admin. 
For any questions, please contact support@getcollate.io The following steps will provide initial set up information,
with links to more detailed documentation.

## Step 1: Set up a Data Connector

Once you’re able to login to your Collate instance, set up a data connector to start bringing metadata into Collate. 
There are [90+ turnkey connectors](/connectors) to various services: data warehouses, data lakes, databases, dashboards,
messaging services, pipelines, ML models, storage services, and other Metadata Services.
Connections to [custom data sources](/connectors/custom-connectors) can also be created via API.

There's two options on how to set up a data connector:
1. **Run the connector in Collate SaaS**: In this scenario, you'll get an IP when you add the service. You need to give
  access to this IP in your data sources.
  
{% tilesContainer %}
{% tile
  title="Run the connector in Collate SaaS"
  description="Guide to start ingesting metadata seamlessly from your data sources."
  link="/getting-started/day-1/collate-saas"
  icon="discovery"
/%}
{% /tilesContainer %}

2. **Run the connector in your infrastructure or laptop**: The hybrid model offers organizations the flexibility to run metadata ingestion components within their own infrastructure. This approach ensures that Collate's managed service doesn't require direct access to the underlying data. Instead, only the metadata is collected locally and securely transmitted to our SaaS platform, maintaining data privacy and security while still enabling robust metadata management. You can read more about how to extract metadata in these cases [here](/getting-started/day-1/hybrid-saas).

## Step 2: Ingest Metadata

Once the connector has been added, set up a [metadata ingestion pipeline](/how-to-guides/admin-guide/how-to-ingest-metadata) 
to bring in the metadata into Collate at a regular schedule.

- Go to **Settings > Services > Databases** and click on the service you have added. Navigate to the Ingestion tab to **Add Metadata Ingestion**.

{% image
  src="/images/v1.7/getting-started/add-ingestion.png"
  alt="Adding Ingestion"
  caption="Adding Ingestion" /%}

- Make any necessary configuration changes or filters for the ingestion, with documentation available in the side panel.

{% image
  src="/images/v1.7/getting-started/ingestion-config.png"
  alt="Configure Ingestion"
  caption="Configure Ingestion" /%}

- Schedule the pipeline to ingest metadata regularly.

{% image
  src="/images/v1.7/getting-started/schedule-ingesgtion.png"
  alt="Schedule Ingestion"
  caption="Schedule Ingestion" /%}

- Once scheduled, you can also set up additional ingestion pipelines to bring in lineage, profiler, or dbt information.
- Once the metadata ingestion has been completed, you can see the available data assets under **Explore** in the main menu.

{% image
  src="/images/v1.7/getting-started/explore-tab.png"
  alt="Ingested Data"
  caption="Ingested Data under Explore Tab" /%}

- You can repeat these steps to ingest metadata from other data sources.

## Step 3: Invite Users

Once the metadata is ingested into the platform, you can [invite users](/how-to-guides/admin-guide/teams-and-users/invite-users) 
to collaborate on the data and assign different roles.

- Navigate to **Settings > Team & User Management > Users**.

{% image
  src="/images/v1.7/getting-started/users.png"
  alt="Users Navigation"
  caption="Users Navigation" /%}

- Click on **Add User**, and enter their email and other details to provide access to the platform.

{% image
  src="/images/v1.7/getting-started/add-users.png"
  alt="Adding New User"
  height="750px"
  caption="Adding New User" /%}

- You can organize users into different Teams, as well as assign them to different Roles.
- Users will inherit the access defined for their assigned Teams and Roles.
- Admin access can also be granted. Admins will have access to all settings and can invite other users.

{% image
  src="/images/v1.7/getting-started/update-user.png"
  alt="Users Profile"
  caption="Users Profile" /%}

- New users will receive an email invitation to set up their account.

## Step 4: Explore Features of OpenMetadata

OpenMetadata provides a comprehensive solution for data teams to break down silos, securely share data assets across various sources, foster collaboration around trusted data, and establish a documentation-first data culture within the organization.

{% tilesContainer %}
{% tile
    title="Data Discovery"
    description="Discover the right data assets to make timely business decisions."
    link="/how-to-guides/data-discovery"
    icon="discovery"
/%}
{% tile
    title="Data Collaboration"
    description="Foster data team collaboration to enhance data understanding."
    link="/how-to-guides/data-collaboration"
    icon="collaboration"
/%}
{% tile
    title="Data Quality & Observability"
    description="Trust your data with quality tests & monitor the health of your data systems."
    link="/how-to-guides/data-quality-observability"
    icon="observability"
/%}
{% tile
    title="Data Lineage"
    description="Trace the path of data across tables, pipelines, and dashboards."
    link="/how-to-guides/data-lineage"
    icon="lineage"
/%}
{% tile
    title="Data Insights"
    description="Define KPIs and set goals to proactively hone the data culture of your company."
    link="/how-to-guides/data-insights"
    icon="discovery"
/%}
{% tile
    title="Data Governance"
    description="Enhance your data platform governance using OpenMetadata."
    link="/how-to-guides/data-governance"
    icon="governance"
/%}
{% /tilesContainer %}

## Deep Dive into OpenMetadata: Guides for Admins and Data Users 

{% tilesContainer %}
{% tile
    title="Admin Guide"
    description="Admin users can get started with OpenMetadata with just three quick and easy steps & know-it-all with the advanced guides."
    link="/how-to-guides/admin-guide"
    icon="administration"
/%}
{% tile
    title="Guide for Data Users"
    description="Get to know the basics of OpenMetadata and about the data assets that you can explore in the all-in-one platform."
    link="/how-to-guides/guide-for-data-users"
    icon="steward"
/%}
{% /tilesContainer %}

From here, you can further your understanding and management of your data with Collate:

 - You can check out the [advanced guide to roles and policies](/how-to-guides/admin-guide/roles-policies) to fine-tune role or team access to data.

- Trace your data flow with [column-level lineage](/how-to-guides/data-lineage) graphs to understand where your data comes from, how it is used, and how it is managed.
- Build [no-code data quality tests](how-to-guides/data-quality-observability/quality/tab) to ensure its technical and 
  business quality, and set up an [alert](/how-to-guides/data-quality-observability/observability) for any test case failures to be quickly notified of critical data issues.
- Write [Knowledge Center](/how-to-guides/data-collaboration/knowledge-center) articles associated with data assets to document key information for your team, such as technical details, business context, and best practices.
- Review the different [Data Insights Reports](/how-to-guides/data-insights/report) on Data Assets, App Analytics, KPIs, and [Cost Analysis](/how-to-guides/data-insights/cost-analysis) to understand the health, utilization, and costs of your data estate.
- Build no-code workflows with [Metadata Automations](https://www.youtube.com/watch?v=ug08aLUyTyE&ab_channel=OpenMetadata) to add attributes like owners, tiers, domains, descriptions, glossary terms, and more to data assets, as well as propagate them using column-level lineage for more automated data management.