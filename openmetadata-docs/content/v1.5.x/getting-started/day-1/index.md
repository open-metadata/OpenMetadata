---
title: Day 1
slug: /getting-started/day-1
collate: true
---

# Getting Started: Day 1

Let’s get started with your Collate service in five steps:
1. Set up a data connector
2. Ingest metadata
3. Invite users
4. Add roles
5. Create teams and add users

## Requirements

You should receive your initial Collate credentials from Collate support, or from your existing Collate admin. 
For any questions, please contact support@getcollate.io The following steps will provide initial set up information,
with links to more detailed documentation.

## Step 1: Set up a Data Connector

Once you’re able to login to your Collate instance, set up a data connector to start bringing metadata into Collate. 
There are [80+ turnkey connectors](/connectors) to various services: data warehouses, data lakes, databases, dashboards,
messaging services, pipelines, ML models, storage services, and other Metadata Services.
Connections to [custom data sources](/connectors/custom-connectors) can also be created via API.

There's two options on how to set up a data connector:
1. **Run the connector in Collate SaaS**: In this scenario, you'll get an IP when you add the service. You need to give
  access to this IP in your data sources.
2. **Run the connector in your infrastructure or laptop**: In this case, Collate won't be accessing the data, but rather
  you'd control where and how the process is executed and Collate will only receive the output of the metadata extraction.
  This is an interesting option for sources lying behind private networks or when external SaaS services are not allowed to
  connect to your data sources. You can read more about how to extract metadata in these cases [here](/getting-started/day-1/hybrid-saas).

You can easily set up a database service in minutes to run the metadata extraction directly from Collate SaaS:
- Navigate to **Settings > Services > Databases**.
- Click on **Add New Service**.
- Select the database type you want. Enter the information, like name and description, to identify the database.
- Enter the Connection Details. You can view the documentation available in the side panel.
- Test the connection to verify the connection status.

## Step 2: Ingest Metadata

Once the connector has been added, set up a [metadata ingestion pipeline](/how-to-guides/admin-guide/how-to-ingest-metadata) 
to bring in the metadata into Collate at a regular schedule.

- Go to **Settings > Services > Databases** and click on the service you have added.
- Navigate to the Ingestion tab to **Add Metadata Ingestion**.
- Make any necessary configuration changes or filters for the ingestion, with documentation available in the side panel.
- Schedule the pipeline to ingest metadata regularly.
- Once scheduled, you can also set up additional ingestion pipelines to bring in lineage, profiler, or dbt information.
- Once the metadata ingestion has been completed, you can see the available data assets under **Explore** in the main menu.
- You can repeat these steps to ingest metadata from other data sources.

## Step 3: Invite Users

Once the metadata is ingested into the platform, you can [invite users](/how-to-guides/admin-guide/teams-and-users/invite-users) 
to collaborate on the data and assign different roles.

- Navigate to **Settings > Team & User Management > Users**.
- Click on **Add User**, and enter their email and other details to provide access to the platform.
- You can organize users into different Teams, as well as assign them to different Roles.
- Users will inherit the access defined for their assigned Teams and Roles.
- Admin access can also be granted. Admins will have access to all settings and can invite other users.
- New users will receive an email invitation to set up their account.

## Step 4: Add Roles and Policies

Add well-defined roles based on the user’s job description, such as Data Scientist or Data Steward. 
Each role can be associated with certain policies, such as the Data Consumer Policy. These policies further comprise 
fine-grained Rules to define access.

- Navigate to **Settings > Access Control** to define the Rules, Policies, and Roles.
- Refer to [this use case guide](/how-to-guides/admin-guide/roles-policies/use-cases) to understand the configuration for different circumstances.
- Start by creating a Policy. Define the rules for the policy.
- Then, create a Role and apply the related policies.
- Navigate to **Settings > Team & User Management** to assign roles to users or teams.

For more detailed instructions, refer to the [Advanced Guide for Roles and Policies](/how-to-guides/admin-guide/roles-policies).

## Step 5: Create Teams and Assign Users

Now that you have users added and roles defined, grant users access to the data assets they need. The easiest way to 
manage this at scale is to create teams with the appropriate permissions, and to invite users to their assigned teams.

- Collate supports a hierarchical team structure with [multiple team types](/how-to-guides/admin-guide/teams-and-users/team-structure-openmetadata).
- The root team-type Organization supports other child teams and users within it.
- Business Units, Divisions, Departments, and Groups are the other team types in the hierarchy.
- Note: Only the team-type Organization and Groups can have users. Only the team-type Groups can own data assets.

Planning the [team hierarchy](/how-to-guides/admin-guide/teams-and-users/team-structure-openmetadata) can help save time 
later, when creating the teams structure in **Settings > Team and User Management > Teams**. Continue to invite additional 
users to onboard them to Collate, with their assigned teams and roles.

## Next Steps

You now have data sources loaded into Collate, and team structure set up. Continue to add more data sources to gain a
more complete view of your data estate, and invite users to foster broader collaboration. You can check out 
the [advanced guide to roles and policies](/how-to-guides/admin-guide/roles-policies) to fine-tune role or team access to data.

From here, you can further your understanding and management of your data with Collate:

- Trace your data flow with [column-level lineage](/how-to-guides/data-lineage) graphs to understand where your data comes from, how it is used, and how it is managed.
- Build [no-code data quality tests](how-to-guides/data-quality-observability/quality/tab) to ensure its technical and 
  business quality, and set up an [alert](/how-to-guides/data-quality-observability/observability) for any test case failures to be quickly notified of critical data issues.
- Write [Knowledge Center](/how-to-guides/data-collaboration/knowledge-center) articles associated with data assets to document key information for your team, such as technical details, business context, and best practices.
- Review the different [Data Insights Reports](/how-to-guides/data-insights/report) on Data Assets, App Analytics, KPIs, and [Cost Analysis](/how-to-guides/data-insights/cost-analysis) to understand the health, utilization, and costs of your data estate.
- Build no-code workflows with [Metadata Automations](https://www.youtube.com/watch?v=ug08aLUyTyE&ab_channel=OpenMetadata) to add attributes like owners, tiers, domains, descriptions, glossary terms, and more to data assets, as well as propagate them using column-level lineage for more automated data management.

You can also review additional [How-To Guides](/how-to-guides) on popular topics like data discovery, data quality, and data governance. 
