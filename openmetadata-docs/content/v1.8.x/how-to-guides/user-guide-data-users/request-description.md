---
title: How to Request for Description
description: Learn how to request data asset descriptions in OpenMetadata. Step-by-step guide for data users to collaborate and improve data documentation.
slug: /how-to-guides/guide-for-data-users/request-description
---

# How to Request for Description

Apart from adding the a description to the data assets directly, users can also request to update description. This is typically done when the user wants another opinion on the description being added, or if the user does not have access to edit the description. Requesting for a description will create a Task in OpenMetadata.

- Click on the **?** icon next to Description

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/desc3.png"
alt="Request for Data Asset Description"
caption="Request for Data Asset Description"
/%}

- A Task will be created with some pre-populated details. Fill in the other important information:
  - **Title** - This is auto-populated
  - **Assignees** - Multiple users or teams can be added
  - **Description** - Add the new description. 
    - You can view the **Current** description. 
    - You can add the **New** description.
    - It will display the **Difference** as well.
  - Click on **Submit** to create the task.

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/desc4.png"
alt="Create a Task for Data Asset Description"
caption="Create a Task for Data Asset Description"
/%}

Once a task has been created, it is displayed in the **Activity Feeds & Tasks** tab for that Data Asset. The assignees, can either `Accept the Suggestion` or `Edit and Accept the Suggestion`. Assignees can also add a **Comment**. They can also add other users as **Assignees**.

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/desc5.png"
alt="Task: Accept Suggestion and Comment"
caption="Task: Accept Suggestion and Comment"
/%}

## Conversations around the Data Asset Description

Apart from requesting for a description, users can also create a **Conversation** around the description of a data asset.
- Click on the **Conversation** icon next to the description.

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/desc6.png"
alt="Conversation around Description"
caption="Conversation around Description"
/%}

- Start a conversation right within the data asset page. Add **@mention** to tag a user or team. Add a **#mention** to tag a data asset.

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/desc7.png"
alt="Start a Conversation"
caption="Start a Conversation"
/%}

- Further in the conversation, users can **Reply** to discuss further as well as add **Reactions**, **Edit**, or **Delete**.

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/desc8.png"
alt="Conversation: Reply, React, Edit or Delete"
caption="Conversation: Reply, React, Edit or Delete"
/%}

{%inlineCallout
  color="violet-70"
  bold="How to Assign or Change Data Ownership"
  icon="MdArrowForward"
  href="/how-to-guides/guide-for-data-users/data-ownership"%}
  Learn how to assign or change data owners
{%/inlineCallout%}