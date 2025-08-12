---
title: Auto-Classification in OpenMetadata
description: Learn how to set up automatic data classification in OpenMetadata to streamline data governance and ensure consistent tagging across your data assets.
slug: /how-to-guides/data-governance/classification/auto-classification
---

# Auto-Classification Workflow

OpenMetadata identifies PII data and auto tags or suggests the tags. It automatically detects sensitive data and assigns relevant tags such as 'PII Sensitive'. The addition of tags about PII data helps consumers and governance teams identify data that needs to be treated carefully.

In the example below, the columns ‘last_name’ and ‘social security number’ are auto-tagged as PII-sensitive. This works using NLP as part of the profiler during ingestion.

{% image
src="/images/v1.9/how-to-guides/governance/auto1.png"
alt="User_name and Social Security Number are Auto-Classified as PII Sensitive"
caption="User_name and Social Security Number are Auto-Classified as PII Sensitive"
/%}

In the below example, the column ‘number_of_orders’ is also auto-tagged as Sensitive, even though the column name does not provide much information. 

{% image
src="/images/v1.9/how-to-guides/governance/auto2.png"
alt="Column Name does not provide much information"
caption="Column Name does not provide much information"
/%}

When we look at the content of the column ‘number_of_orders’ in the Sample Data tab, it becomes clear that the auto-classification is based on the data in the column.

{% image
src="/images/v1.9/how-to-guides/governance/auto3.png"
alt="Column Data provides information"
caption="Column Data provides information"
/%}

You can read more about [Auto PII Tagging](/how-to-guides/data-governance/classification/auto/auto-pii-tagging) here.

## Tag Mapping

Tag mapping is supported in the backend and not in the OpenMetadata UI. When two related tags are associated with each other, applying one tag, automatically applies the other tag. For example, when the tag `Personal Data.Personal` is applied, it automatically applies another tag `Data Classification.Confidential`. That way, applying the tag `Personal` automatically applies the tag `Confidential`.

{%inlineCallout
  color="violet-70"
  bold="What are Tiers"
  icon="MdArrowForward"
  href="/how-to-guides/data-governance/classification/tiers"%}
  Tiers helps to define the importance of data to an organization.
{%/inlineCallout%}
