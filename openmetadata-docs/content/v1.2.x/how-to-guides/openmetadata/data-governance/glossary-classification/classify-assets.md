---
title: How to Classify Data Assets
slug: /how-to-guides/openmetadata/data-governance/glossary-classification/classify-assets
---

# How to Classify Data Assets

## How to Add Classification Tags

- From the Explore page, select a data asset and click on the edit icon or + Add for Tags.
- Search for the relevant tags. You can either type and search, or scroll to select from the options provided.
- Click on the checkmark to save the changes.

{% image
src="/images/v1.1/how-to-guides/governance/tag7.png"
alt="Add Tags to Classify Data Assets"
caption="Add Tags to Classify Data Assets"
/%}

The tagged data assets can be discovered right from the Classification page. 
- Navigate to **Govern >> Classification**.
- The list of tags is displayed along with the details of Usage in various data assets.
- Click on the Usage number to view the tagged assets.

{% image
src="/images/v1.1/how-to-guides/governance/tag2.png"
alt="Usage: Number of Assets Tagged"
caption="Usage: Number of Assets Tagged"
/%}

{% image
src="/images/v1.1/how-to-guides/governance/tag3.png"
alt="Discover the Tagged Data Assets"
caption="Discover the Tagged Data Assets"
/%}

You can view all the tags in the right panel.

Data assets can also be classified using Tiers. Learn more about [Tiers](/how-to-guides/openmetadata/data-governance/glossary-classification/tiers).

Among the Classification Tags, OpenMetadata has some System Classification. Learn more about the [System Tags](/how-to-guides/openmetadata/data-governance/glossary-classification/classification).

## Task: Request to Update Tags

Apart from adding the tags directly, users can also request to update tags. This is typically done when the user wants another opinion on the tag being added, or if the user does not have access to add tags directly.

- Click on the **?** icon next to tags

{% image
src="/images/v1.1/how-to-guides/governance/tag8.png"
alt="Request to Update Tags"
caption="Request to Update Tags"
/%}

- A Task will be created with some pre-populated details. Fill in the other important information:
  - **Title** - This is auto-populated
  - **Assignees** - Multiple users can be added
  - **Update Tags** - It displays 3 tabs. 
    - You can view the **Current** tags. 
    - You can add the **New** tags.
    - It will display the **Difference** as well.
  - Click on **Submit** to create the task.

 {% image
 src="/images/v1.1/how-to-guides/governance/task1.png"
 alt="Add a Task: Request to Update Tags"
 caption="Add a Task: Request to Update Tags"
 /%}

Once a task has been created, it is displayed in the **Activity Feeds & Tasks** tab for that Data Asset. The assignees, can either `Accept the Suggestion` or `Edit and Accept the Suggestion`. Assignees can also add a **Comment**. They can also add other users as **Assignees**. 

{% image
src="/images/v1.1/how-to-guides/governance/task2.png"
alt="Task: Accept Suggestion and Comment"
caption="Task: Accept Suggestion and Comment"
/%}

## Conversations around Classification

Apart from requesting for tags, users can also create a **Conversation** around the tags assigned to a data asset.
- Click on the **Conversation** icon next to the tag.

{% image
src="/images/v1.1/how-to-guides/governance/ct1.png"
alt="Conversations around Tags"
caption="Conversations around Tags"
/%}

- Start a conversation right within the data asset page. Add **@mention** to tag a user or team. Add a **#mention** to tag a data asset.

{% image
src="/images/v1.1/how-to-guides/governance/ct2.png"
alt="Start a Conversation"
caption="Start a Conversation"
/%}

- Further in the conversation, users can **Reply** to discuss further as well as add **Reactions**, **Edit**, or **Delete**.

{% image
src="/images/v1.1/how-to-guides/governance/ct3.png"
alt="Conversation: Reply, React, Edit or Delete"
caption="Conversation: Reply, React, Edit or Delete"
/%}

## Auto-Classification in OpenMetadata

OpenMetadata identifies PII data and auto tags or suggests the tags. The data profiler automatically tags the PII-Sensitive data. The addition of tags about PII data helps consumers and governance teams identify data that needs to be treated carefully.

In the example below, the columns ‘user_name’ and ‘social security number’ are auto-tagged as PII-sensitive. This works using NLP as part of the profiler during ingestion.

{% image
src="/images/v1.1/how-to-guides/governance/auto1.png"
alt="User_name and Social Security Number are Auto-Classified as PII Sensitive"
caption="User_name and Social Security Number are Auto-Classified as PII Sensitive"
/%}

In the below example, the column ‘dwh_x10’ is also auto-tagged as PII Sensitive, even though the column name does not provide much information. 

{% image
src="/images/v1.1/how-to-guides/governance/auto2.png"
alt="Column Name does not provide much information"
caption="Column Name does not provide much information"
/%}

When we look at the content of the column ‘dwh_x10’ in the Sample Data tab, it becomes clear that the auto-classification is based on the data in the column.

{% image
src="/images/v1.1/how-to-guides/governance/auto3.png"
alt="Column Data provides information"
caption="Column Data provides information"
/%}

You can read more about [Auto PII Tagging](/connectors/ingestion/auto_tagging) here.

## Tag Mapping

Tag mapping is supported in the backend and not in the OpenMetadata UI. When two related tags are associated with each other, applying one tag, automatically applies the other tag. For example, when the tag `Personal Data.Personal` is applied, it automatically applies another tag `Data Classification.Confidential`. That way, applying the tag `Personal` automatically applies the tag `Confidential`.

{%inlineCallout
  color="violet-70"
  bold="Best Practices for Glossary and Classification"
  icon="MdArrowForward"
  href="/how-to-guides/openmetadata/data-governance/glossary-classification/best-practices"%}
  Here are the Top 8 Best Practices around Terminologies.
{%/inlineCallout%}