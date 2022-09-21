---
title: Discovery & Collaboration
slug: /openmetadata/discovery-collaboration
---

# Discovery & Collaboration
OpenMetadata supports a rich set of features to enable Data Discovery & Collaboration.  

## Search
Search is at the front and center of OpenMetadata and is available in the top Menu bar across all 
the different pages.

<Image src="/images/openmetadata/discovery-collaboration/search-top-bar.png" alt="search-top-bar"/>

Users can also start searching by invoking the Keyboard shortcut <kbd>Ctrl</kbd> + <kbd>K</kbd> in Windows or <kbd>Cmd</kbd> + <kbd>K</kbd> in Mac OS. 
The popup search dialog supports a full set of keyboard navigation to highlight and select the result by using 
the arrow keys and <kbd>Return</kbd> button.

<Image src="/images/openmetadata/discovery-collaboration/command-k-search.png" alt="command-k-search"/>

The Search APIs are backed by Elastic Search.

## Conversation Threads
As part of Data Collaboration feature of OpenMetadata, Conversation Threads were one
of the earliest features introduced to enable users to easily ask 
any questions that they might have around a data asset.

In the 0.9.0 release of OpenMetadata, we introduced the ability to reply and create entire conversation 
threads around all the various activities across any data asset. In release 0.11.0, we took it to the next level by extending conversation threads to Tasks and adding support for reactions with emojis.

Across OpenMetadata, users can start conversations around description, column description or tags of an entity by clicking the chat icon as shown in the screen-shot below.

<Image src="/images/openmetadata/discovery-collaboration/add-conversation.png" alt="add-conversation"/>

<Image src="/images/openmetadata/discovery-collaboration/conversation.png" alt="conversation"/>

Users can also reply or react with emojis for any Conversation by hovering over the conversation.

<Image src="/images/openmetadata/discovery-collaboration/conversation-reply.png" alt="conversation-reply"/>

The Conversations also show up in the Activity Feed of every user for added convenience to be able to view and filter
all the relevant conversations in a single place.

<Image src="/images/openmetadata/discovery-collaboration/activity-feed.png" alt="activity-feed"/>


## Tasks

Tasks are an extension to the Conversation Threads feature where users can now create tasks for
requesting create or update description of a data asset and assigning the task to an appropriate user or team. 

![Tasks Workflow](https://miro.medium.com/max/1400/1*bbck_VGxcp1S5dznMtTIxg.gif)

Users can react and reply to Tasks similar to a Conversation thread.

## Announcements
Informing users about upcoming changes to the data is a big challenge. In most organizations, a team sends an email well in advance about the change. But no one reads/tracks them and finally, when the change is done, many users are unprepared to handle it.

With the Announcements feature, you can now inform your entire team of all the upcoming events and changes, such as deprecation, deletion, or schema changes. These announcements can be scheduled with a start date and an end date. All the users following your data are not only notified in Activity Feeds but a banner is also shown on the data asset details page for users to discover (or be reminded of) the announcement.

<Image src="/images/openmetadata/discovery-collaboration/create-announcement.png" alt="create-announcement"/>

<Image src="/images/openmetadata/discovery-collaboration/announcement-banner.png" alt="announcement-banner"/>

Furthermore, users can react with emojis and reply to the announcements from both the Activity Feed in the homepage and from the data asset page. 

<Image src="/images/openmetadata/discovery-collaboration/announcement-reply.png" alt="announcement-reply"/>

## Glossaries

## Tags
