---
title: Day 1 Getting Started | OpenMetadata Day 1 Guide
slug: /quick-start/getting-started/day-1
---

# Getting Started: Day 1

Get started with your OpenMetadata service in a few simple steps:

1. **Set up a Data Connector**: Connect your data sources to begin collecting metadata.
2. **Ingest Metadata**: Run the metadata ingestion process to gather and push data insights.
3. **Invite Users**: Add team members to collaborate and manage metadata together.
4. **Explore the Features**: Dive into OpenMetadata's extensive feature set to unlock the full potential of your data.

**Ready to begin? Let's get started!**

## Step 1: Set up a Data Connector

Once you have logged into your OpenMetadata instance, set up a data connector to start ingesting metadata. OpenMetadata provides [90+ turnkey connectors](/connectors) for a wide range of services, including:

- Databases
- Dashboards
- Messaging services
- Pipelines
- ML models
- Storage services
- Other metadata services

For [custom data sources](/connectors/custom-connectors), metadata ingestion can also be set up via API.

There's two options on how to set up a data connector:
1. **Run the connector in OpenMetadata**: In this scenario, an IP will be provided when you add the service. You must allow access to this IP in your data sources.
  
{% tilesContainer %}
{% tile
  title="Run the connector in OpenMetadata"
  description="Guide to start ingesting metadata seamlessly from your data sources."
  link="/quick-start/getting-started/day-1/database-service-setup"
  icon="discovery"
/%}
{% /tilesContainer %}

2. **Run the connector in your infrastructure or on a local machine:**: This hybrid model allows organizations to run metadata ingestion components within their own infrastructure. This ensures that OpenMetadata's managed service doesn't need direct access to the underlying data. Only metadata is collected locally and securely transmitted to the platform, maintaining data privacy and security.

## Step 2: Ingest Metadata

Once the connector is set up, configure a [metadata ingestion pipeline](/how-to-guides/admin-guide/how-to-ingest-metadata) 
to import metadata into OpenMetadata on a regular schedule.

- Navigate to **Settings > Services > Databases** and select the service you added.

{% image
  src="/images/v1.9/getting-started/add-ingestion0.png"
  alt="Ingestion Navigation"
  caption="Ingestion Navigation" /%}

- Go to the **Agents** tab and click **Add Metadata Agent**.

{% image
  src="/images/v1.9/getting-started/add-ingestion.png"
  alt="Adding Ingestion"
  caption="Adding Ingestion" /%}

- Configure any required settings or filters for the ingestion process. Documentation is available in the side panel for reference.

{% image
  src="/images/v1.9/getting-started/ingestion-config.png"
  alt="Configure Ingestion"
  caption="Configure Ingestion" /%}

- Schedule the pipeline to ingest metadata at regular intervals.

{% image
  src="/images/v1.9/getting-started/schedule-ingesgtion.png"
  alt="Schedule Ingestion"
  caption="Schedule Ingestion" /%}

- In addition to metadata ingestion, you can set up pipelines for lineage, profiler data, or dbt information.
- Once the metadata ingestion is completed, the ingested data assets can be viewed under the **Explore** section in the main menu.

{% image
  src="/images/v1.9/getting-started/explore-tab.png"
  alt="Ingested Data"
  caption="Ingested Data under Explore Tab" /%}

- You can repeat these steps to ingest metadata from other data sources as needed.

## Step 3: Invite Users After Setting Up SMTP

### SMTP Configuration

To invite users you will need to ensure that you have an SMTP server available. With the information for your SMTP server you can configure OpenMetadata to send email alerts by updating the details from the UI.

To update the details from the UI, navigate to Settings > Preferences > Email

{% image
src="/images/v1.9/how-to-guides/admin-guide/email.png"
alt="Email Configuration"
caption="Email Configuration"
/%}

{% note %}

If you encounter issues connecting to the SMTP server, ensure that the correct Certificate Authority (CA) is configured to trust the SMTP host. Additionally, use the DNS hostname instead of the IP address in the SMTP server endpoint configuration to avoid certificate validation errors.

{% /note %}

### Inviting Users

After metadata has been ingested into OpenMetadata, you can [invite users](/how-to-guides/admin-guide/teams-and-users/invite-users) to collaborate on the data and assign different roles.

- Go to **Settings > Team & User Management > Users**.

{% image
  src="/images/v1.9/getting-started/users.png"
  alt="Users Navigation"
  caption="Users Navigation" /%}

- Click **Add User**, then enter their email and other required details to grant access to the platform.

{% image
  src="/images/v1.9/getting-started/add-users.png"
  alt="Adding New User"
  height="750px"
  caption="Adding New User" /%}

- Organize users into different Teams, and assign them specific Roles.
- Users inherit access permissions from their assigned teams and roles.
- Admin access can be granted to users who need full access to all settings, including the ability to invite new users.

{% image
  src="/images/v1.9/getting-started/update-user.png"
  alt="Users Profile"
  caption="Users Profile" /%}

- New users will receive an email invitation to set up their accounts.

## Step 4: Explore Features of OpenMetadata

OpenMetadata offers a comprehensive platform for data teams to:
- Break down data silos
- Securely share data assets across various sources
- Foster collaboration around trusted data
- Establish a documentation-first data culture within your organization

Explore these features and unlock the full potential of your data using OpenMetadata.

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
