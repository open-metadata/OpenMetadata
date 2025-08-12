---
title: How to Add Tags | OpenMetadata User Tagging Guide
description: Add metadata tags to datasets, columns, or dashboards for improved classification, search, and governance reporting.
slug: /how-to-guides/guide-for-data-users/tags
---

# How to Add Tags

- From the Explore page, select a data asset and click on the edit icon or + Add for Tags.
- Search for the relevant tags. You can either type and search, or scroll to select from the options provided.
- Click on the checkmark to save the changes.

{% image
src="/images/v1.9/how-to-guides/governance/tag7.png"
alt="Add Tags to Classify Data Assets"
caption="Add Tags to Classify Data Assets"
/%}

The tagged data assets can be discovered right from the Classification page. 
- Navigate to **Govern >> Classification**.
- The list of tags is displayed along with the details of Usage in various data assets.
- Click on the Usage number to view the tagged assets.

{% image
src="/images/v1.9/how-to-guides/governance/tag2.png"
alt="Usage: Number of Assets Tagged"
caption="Usage: Number of Assets Tagged"
/%}

{% image
src="/images/v1.9/how-to-guides/governance/tag3.png"
alt="Discover the Tagged Data Assets"
caption="Discover the Tagged Data Assets"
/%}

You can view all the tags in the right panel.

Data assets can also be classified using Tiers. Learn more about [Tiers](/how-to-guides/data-governance/classification/tiers).

Among the Classification Tags, OpenMetadata has some System Classification. Learn more about the [System Tags](/how-to-guides/data-governance/classification/overview#classification-in-openmetadata).

## Auto-Classification in OpenMetadata

OpenMetadata identifies PII data and auto tags or suggests the tags. The data profiler automatically tags the PII-Sensitive data. The addition of tags about PII data helps consumers and governance teams identify data that needs to be treated carefully.

In the example below, the columns ‘user_name’ and ‘social security number’ are auto-tagged as PII-sensitive. This works using NLP as part of the profiler during ingestion.

{% image
src="/images/v1.9/how-to-guides/governance/auto1.png"
alt="User_name and Social Security Number are Auto-Classified as PII Sensitive"
caption="User_name and Social Security Number are Auto-Classified as PII Sensitive"
/%}

In the below example, the column ‘dwh_x10’ is also auto-tagged as PII Sensitive, even though the column name does not provide much information. 

{% image
src="/images/v1.9/how-to-guides/governance/auto2.png"
alt="Column Name does not provide much information"
caption="Column Name does not provide much information"
/%}

When we look at the content of the column ‘dwh_x10’ in the Sample Data tab, it becomes clear that the auto-classification is based on the data in the column.

{% image
src="/images/v1.9/how-to-guides/governance/auto3.png"
alt="Column Data provides information"
caption="Column Data provides information"
/%}

{%inlineCallout
  color="violet-70"
  bold="How to Request for Tags"
  icon="MdArrowForward"
  href="/how-to-guides/guide-for-data-users/request-tags"%}
  Request for tags and discuss about the same, all within OpenMetadata.
{%/inlineCallout%}
