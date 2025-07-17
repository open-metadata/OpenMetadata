---
title: How to Request for Tags
description: Use tag requests to suggest relevant labels for data assets and improve discoverability through collaborative tagging.
slug: /how-to-guides/data-collaboration/request-tags
---

# How to Request for Tags

Apart from adding the tags directly to the data assets, users can also request to update tags. This is typically done when the user wants another opinion on the tag being added, or if the user does not have access to add tags directly. Requesting for a tag will create a Task in OpenMetadata.

- Click on the **?** icon next to tags

{% image
src="/images/v1.8/how-to-guides/governance/tag8.png"
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
 src="/images/v1.8/how-to-guides/governance/task1.png"
 alt="Add a Task: Request to Update Tags"
 caption="Add a Task: Request to Update Tags"
 /%}

Once a task has been created, it is displayed in the **Activity Feeds & Tasks** tab for that Data Asset. The assignees, can either `Accept the Suggestion` or `Edit and Accept the Suggestion`. Assignees can also add a **Comment**. They can also add other users as **Assignees**. 

{% image
src="/images/v1.8/how-to-guides/governance/task2.png"
alt="Task: Accept Suggestion and Comment"
caption="Task: Accept Suggestion and Comment"
/%}

## Conversations around Tags

Apart from requesting for tags, users can also create a **Conversation** around the tags assigned to a data asset.
- Click on the **Conversation** icon next to the tag.

{% image
src="/images/v1.8/how-to-guides/governance/ct1.png"
alt="Conversations around Tags"
caption="Conversations around Tags"
/%}

- Start a conversation right within the data asset page. Add **@mention** to tag a user or team. Add a **#mention** to tag a data asset.

{% image
src="/images/v1.8/how-to-guides/governance/ct2.png"
alt="Start a Conversation"
caption="Start a Conversation"
/%}

- Further in the conversation, users can **Reply** to discuss further as well as add **Reactions**, **Edit**, or **Delete**.

{% image
src="/images/v1.8/how-to-guides/governance/ct3.png"
alt="Conversation: Reply, React, Edit or Delete"
caption="Conversation: Reply, React, Edit or Delete"
/%}

{%inlineCallout
  color="violet-70"
  bold="Overview of Announcements"
  icon="MdArrowForward"
  href="/how-to-guides/data-collaboration/announcements"%}
  Learn more about the announcements in OpenMetadata
{%/inlineCallout%}