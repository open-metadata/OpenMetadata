---
title: Overview of Classification | Official Documentation
description: Get an overview of classification features to understand how data is organized, labeled, and governed across your OpenMetadata.
slug: /how-to-guides/data-governance/classification/overview
---

# Overview of Classification

**Classification** is a tag or annotation that categorizes or classifies a data asset. Classification does not define the semantics or meaning of data, but it helps define the type of data. For example, data can be:
- Sensitive or Non-sensitive, 
- PII or Non-PII in terms of privacy, 
- Verified or Unverified in terms of readiness for data consumption.

Classification is used for policy enforcement purposes. Classification helps in browsing, searching, grouping, and managing data. It also helps in Security, Data Privacy, and Data Protection use cases. All of this is done by defining Policies, like Access Control policies, Retention policies, and Data Management policies.

## Classification in OpenMetadata

For Classification in OpenMetadata, we use a flat list of terms from knowledge organization systems. Classification groups together a set of similar terms called **Tags**, which can be accessed from **Govern > Classification**. 

In the below example, PersonalData is a Classification and it further has Tags under it. `PersonalData` is also a **System** Classification. System classifications are an important part of OpenMetadata and therefore cannot be deleted. The descriptions for the System tags can be modified. They can also be disabled. `PII` and `Tiers` are the other important system classifications in OpenMetadata.

{% image
src="/images/v1.8/how-to-guides/governance/tag4.png"
alt="Classification: Groups together Tags"
caption="Classification: Groups together Tags"
/%}

## Classification and Categorization Tags

OpenMetadata supports both Classification and Categorization tags.
- **Classification tags** are **mutually exclusive**. A data asset can be in only one class in a hierarchy. Data can either be Public or Private, Sensitive or Non-sensitive. It cannot be both.

- **Categorization tags** are **not mutually exclusive**. A data asset can belong to multiple categories. The same table can have Usage, Financial, Reporting and Compliance tags.

## Mutually Exclusive Tags

There are cases where only one tag from a particular classification is relevant for a data asset. For example, an asset can either be PII Sensitive or PII Non-Sensitive. It cannot be both. For such cases, a Classification can be created where the tags can be mutually exclusive. If this configuration is enabled, you won’t be able to assign multiple tags from the same Classification to the same data asset.

{% note %}
**Pro Tip:** The Global Search in OpenMetadata also helps discover related Glossary Terms and Tags.
{% image
src="/images/v1.8/how-to-guides/governance/tag1.png"
alt="Search for Glossary Terms and Tags"
caption="Search for Glossary Terms and Tags"
/%}
{% /note %}

## How Classification Helps?

- You can discover the data assets in the Tags page.
- You can also search for data assets and filter them by tags.
- Tags can be used for authoring Policies.

## Classification APIs

OpenMetadata has extensive classification APIs to automate tagging. These APIs support two kinds of entities - Classification and Tags. These entities are identified by a Unique ID. Tags have a fully qualified name in the form of `classification.tagTerm`

Refer the **[API Documentation on Classification](https://sandbox.open-metadata.org/docs#tag/Classifications)**.

{%inlineCallout
  color="violet-70"
  bold="How to Classify Data Assets"
  icon="MdArrowForward"
  href="/how-to-guides/data-governance/classification/assets"%}
  Add tags to data assets, or request them and discuss about the same, all within OpenMetadata.
{%/inlineCallout%}