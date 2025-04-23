# 1.7.0 Release 🎉

{% note noteType="Tip" %}
**Apr 18th, 2025**
{% /note %}

{% inlineCalloutContainer %}
{% inlineCallout
color="violet-70"
icon="celebration"
bold="Upgrade OpenMetadata"
href="/deployment/upgrade" %}
Learn how to upgrade your OpenMetadata instance to 1.7.0!
{% /inlineCallout %}
{% /inlineCalloutContainer %}

You can find the GitHub release [here](https://github.com/open-metadata/OpenMetadata/releases/tag/1.7.0-release).

The latest Release 1.7 of OpenMetadata and Collate delivers new features to accelerate the onboarding of both data services and users, taking discovery, automations, and customizations one step further.

# What's Changed

## Breaking Changes

### Removing support for Python 3.8

Python 3.8 was [officially EOL on 2024-10-07](https://devguide.python.org/versions/). Some of our dependencies have already
started removing support for higher versions, and are following suit to ensure we are using the latest and most stable
versions of our dependencies.

This means that for Release 1.7, the supported Python versions for the Ingestion Framework are 3.9, 3.10 and 3.11.

We were already shipping our Docker images with Python 3.10, so this change should not affect you if you are using our Docker images.
However, if you installed the `openmetadata-ingestion` package directly, please make sure to update your Python version to 3.9 or higher.

# What's New

### Automate Metadata Onboarding Instantly with OpenMetadata AutoPilot

Data teams often face manual, repetitive tasks onboarding new services—configuring workflows individually for schemas, lineage, usage, and profiling. This slows down onboarding and can cause inconsistent metadata coverage.

**OpenMetadata’s AutoPilot makes onboarding effortless:**

- **Automated Workflows:** Automatically triggers metadata extraction for schemas, lineage, usage, and profiling whenever a new service is added. No manual setup required.
- **Optimized Filtering:** Includes default filters for relevant metadata, with the flexibility to add custom filters, ensuring consistency and efficiency.
- **Immediate Insights:** Provides real-time KPIs on asset distribution, metadata coverage (descriptions, ownership), tiering, and PII tagging to proactively improve data governance.

### Automate Documentation, Classification, and Data Quality with Collate AI Agents (Collate)

Collate is enhancing AutoPilot by integrating powerful AI Agents that automate critical metadata tasks—saving your team time and increasing metadata coverage instantly.

- **Automated Tiering:** The Tier Agent analyzes usage patterns and lineage to automatically identify the business-critical data assets within your organization.
- **Intelligent Documentation:** The Documentation Agent automatically generates accurate descriptions of your data assets and powers a seamless Text2SQL chat experience.
- **Data Quality Automation:** The Data Quality Agent intelligently creates Data Quality tests based on data constraints and learns from existing tests across similar datasets.

With Collate AI Agents in AutoPilot, it’s like adding expert team members who streamline metadata management—accelerating onboarding, improving governance, and freeing your team to focus on higher-value tasks.

### Customize Your Data Discovery with Enhanced Search Relevancy Settings

As your data platform expands, quickly finding the most relevant data assets becomes essential. OpenMetadata already boosts search results based on business-criticality (Tiers) and usage patterns—but your organization’s preferences might vary.

**With the new Search Relevancy Settings, OpenMetadata gives you complete control to tailor your discovery experience by:**

- Fine-tuning searchable fields such as asset names, descriptions, or column details.
- Adjusting result boosting based on default properties like Tiers and usage, or adding custom tags to further enhance relevancy.
- Applying customized ranking across all data assets or specific asset types like Tables, Dashboards, or Topics.

Ensure users always discover the right data, quickly and intuitively, by customizing your search experience with OpenMetadata’s enhanced relevancy settings.

### Navigate Your Data Ecosystem with Hierarchical Lineage

OpenMetadata’s enhanced Lineage UI in Release 1.7 introduces **Hierarchical Lineage Layers**, enabling teams to intuitively explore data lineage from a high-level overview down to granular details:

- **Service Layer:** Provides visibility into data flows between different platforms or services.
- **Domain Layer:** Clearly illustrates how data traverses across Data Mesh domains.
- **Data Product Layer:** Shows lineage across specific data products, aligning closely with business definitions.

Alongside these layers, **column-level lineage** remains easily accessible, helping teams precisely understand data transformations and impacts—simplifying root-cause analysis and governance decisions.

### Simplify the User Experience with Persona-Based Customizations

OpenMetadata provides detailed information on your data assets—covering schema, lineage, data quality, and observability. But different user personas have different needs and workflows, and one size doesn’t fit all.

**With Release 1.7, you can now fully personalize OpenMetadata’s user experience based on defined User Personas:**

- **Navigation Panel Customization:** Tailor the navigation panel by adding, removing, or sorting elements to match the workflow of each persona.
- **Data Assets & Governance Entities:** Reorganize, add, or remove tabs and customize widget layouts—highlighting relevant custom properties, descriptions, or key insights specific to each persona.

Persona-based customization ensures each user sees only what’s relevant and important to their role—streamlining workflows, improving usability, and enhancing adoption across your organization.

### Discover the Right Data Even Faster with an Enhanced UX

OpenMetadata is already known for its intuitive UI and simplified user experience. In Release 1.7, the UX is elevated further, making it even easier for diverse user personas to quickly find and act on the data they need.

**Key UX improvements include:**

- **Streamlined Navigation:** Simplified navigation panels to quickly guide users through key actions.
- **Clearer Asset Information:** Improved placement and labeling of critical information on data asset pages, ensuring immediate understanding.
- **Enhanced User Profiles:** Restructured user pages for better visibility into profile details and more intuitive management of open tasks.

### Automatically Propagate Collate Metadata into Your Data Platforms (Collate)

Collate already simplifies capturing and managing metadata—tags, descriptions, and ownership—across your entire data ecosystem. But making sure this enriched metadata reaches back into your source systems is equally crucial.

**With the new Reverse Metadata feature, you can:**

- Automatically push centralized metadata from Collate directly back into your databases (MySQL, Postgres), warehouses (Snowflake, BigQuery), and dashboards (e.g., Power BI).
- Select which assets should synchronize, and your source systems will instantly receive metadata updates in real time.

This seamless, two-way metadata synchronization enables powerful governance use-cases—such as **automating data masking policies in Snowflake based on centrally managed tags**—and turns Collate into a single source of truth at the heart of your end-to-end automated governance strategy.

### PNG & PDF Exports
Support for exporting **Lineage** and **ER diagrams** in **PNG**, and **Data Quality**, **Data Insights**, and more in **PDF**!

### Bulk Edit Action
Enable **bulk editing** capabilities for **Database**, **Schema**, **Table**, and **Column** entities — allowing efficient management of multiple items simultaneously.

### Recursive Import/Export
You can now **import and export the entire entity hierarchy** with all related data, including **parent-child relationships** and **dependencies**!

### Asynchronous Deletion
Support for both **soft** and **hard deletion** operations across **all services**, **entities**, **glossary**, and **term entries** — improving overall performance.


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

**Full Changelog**: [link](https://github.com/open-metadata/OpenMetadata/compare/1.6.10-release...1.7.0-release)
