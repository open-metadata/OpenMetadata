---
title: Cost Analysis
slug: /how-to-guides/data-insights/cost-analysis
collate: true
---

# Cost Analysis

Gain valuable insights into your resource allocation and utilization with `Cost Analysis`. With a suite of interactive graphs, it empowers you to make data-driven decisions to optimize your data platform costs and improve your resource management. You'll be equipped to make informed decisions, and optimize your resources.

## Supported Connectors
{% multiTablesWrapper %}

| Connector          | Status                       |
| :----------------- | :--------------------------- |
| Snowflake          | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

## Requirements
To have cost analysis data available you will need to execute the below workflows after the metadata ingestion has run.

1. **Usage Workflow**:
- Purpose: Gather lifecycle information for data assets.
- Description: The Usage Workflow collects essential information regarding the data asset Life Cycle. This information includes details such as `accessed_at` timestamps and `accessed_by` user information for each data asset. This data is crucial to determine whether a data asset is frequently used or unused within a specified time period.
- Click [here](/connectors/ingestion/workflows/usage) for documentation on the usage workflow.


2. **Profiler Workflow**:
- Purpose: Gather size information (in bytes) for data assets.
- Description: The Profiler Workflow is responsible for obtaining the size of data assets in bytes. This information is vital for generating the size-related data used in the Cost Analysis charts. It helps in assessing the resource consumption and cost implications of each asset.
- Click [here](/how-to-guides/data-quality-observability/profiler/workflow) for documentation on the profiler workflow.

3. **Data Insights Workflow**:
- Purpose: Aggregate information from Usage Workflow and Profiler Workflow.
- Description: The Data Insights Workflow serves as the central aggregator of data, combining the Life Cycle information from the Usage Workflow and the size information from the Profiler Workflow. This aggregated data is then utilized in the creation of the Cost Analysis charts. By integrating both usage and size data, it provides a comprehensive view of resource utilization and its impact on costs.

With these three interconnected workflows, the `Cost Analysis` feature enables users to make informed decisions about resource allocation, cost optimization, and performance improvement.

## Cost Analysis Reports
After the required workflows are completed, the following charts and metrics will be available to be explored by navigating to `Insights -> Cost Analysis`:

**Used vs Unused Assets Count**  
The chart visually displays the count of assets classified as `Used` and `Unused` within the specified time frame, providing a straightforward overview of resource utilization.

{% image
    src="/images/v1.7/features/data-insight/cost-analysis/used-vs-unused-assets-count.png"
    alt="Used vs Unused Assets Count"
    caption="Used vs Unused Assets Count"
 /%}

**Used vs Unused Assets Size**  
The chart visually represents the size of the `Used` and `Unused` and data assets. This graph provides insight into the distribution of resource size and highlights the size-related implications of asset utilization.

{% image
    src="/images/v1.7/features/data-insight/cost-analysis/used-vs-unused-assets-size.png"
    alt="Used vs Unused Assets Size"
    caption="Used vs Unused Assets Size"
 /%}

**Used vs Unused Assets Size Percentage**  
The chart compares the percentage of used and unused data asset sizes over distinct time periods. It offers a dynamic visualization of how resource allocation and size distribution evolve.

{% image
    src="/images/v1.7/features/data-insight/cost-analysis/used-vs-unused-assets-size-percentage.png"
    alt="Used vs Unused Assets Size Percentage"
    caption="Used vs Unused Assets Size Percentage"
 /%}

**Used vs Unused Assets Count Percentage**  
The chart contrasts the percentage distribution of used and unused data asset counts across various time intervals. This graph offers a visual snapshot of resource utilization trends, facilitating cost-efficiency assessments and strategic resource allocation.

{% image
    src="/images/v1.7/features/data-insight/cost-analysis/used-vs-unused-assets-count-percentage.png"
    alt="Used vs Unused Assets Count Percentage"
    caption="Used vs Unused Assets Count Percentage"
 /%}

**Unused Assets**  
The table displays underutilized data assets, presenting their names, last accessed timestamps, and sizes in KB, helping identify potential resource savings and optimization opportunities.

{% image
    src="/images/v1.7/features/data-insight/cost-analysis/unused-assets.png"
    alt="Unused Assets"
    caption="Unused Assets"
 /%}

**Frequently Used Assets**  
The table showcases frequently accessed data assets, detailing their names, last accessed timestamps, and sizes in KB, enabling efficient resource allocation.

{% image
    src="/images/v1.7/features/data-insight/cost-analysis/frequently-used-assets.png"
    alt="Frequently Used Assets"
    caption="Frequently Used Assets"
 /%}

{%inlineCallout
  color="violet-70"
  bold="Configure the Data Insights Report"
  icon="MdArrowForward"
  href="/how-to-guides/data-insights/email-report"%}
  Email the data insights report to Admins and Teams at the desired frequency.
{%/inlineCallout%}