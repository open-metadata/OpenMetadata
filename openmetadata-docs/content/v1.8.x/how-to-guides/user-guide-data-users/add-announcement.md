---
title: How to Create an Announcement
slug: /how-to-guides/guide-for-data-users/add-announcement
---

# How to Create an Announcement

{% note noteType="Tip" %} **Quick Tip:** Always watch out for announcements on the backward incompatible changes. Saves a ton of debugging time later on for data teams. {% /note %}

To add an announcement:
- Navigate to **Explore** and the relevant **Data Asset** section to select a specific asset.
- Click on the vertical ellipsis icon **⋮** located on the top right and select **Announcements**.

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/announce5.png"
alt="Announcements Option"
caption="Announcements Option"
/%}

- Click on **Add Announcement**.

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/announce6.png"
alt="Add an Announcement"
caption="Add an Announcement"
/%}

- Enter the following information and click Submit.
  - Title of the Announcement
  - Start Date
  - End Date
  - Description

{% image
src="/images/v1.8/how-to-guides/user-guide-for-data-stewards/announce7.png"
alt="Add the Announcement Details"
caption="Add the Announcement Details"
/%}

This announcement will be displayed in OpenMetadata during the scheduled time. It will be displayed to all the users who own or follow that particular data asset.

{% note noteType="Warning" %} 
**Pro Tip:** Create Announcements for deletion, deprecation, and other important changes. Let your team know of a tentative date when these changes will be implemented.
{% /note noteType="Warning" %}
{% /note %}

{%inlineCallout
  color="violet-70"
  bold="Data Asset Versioning"
  icon="MdArrowForward"
  href="/how-to-guides/guide-for-data-users/versions"%}
  Review all the major and minor changes with version history
{%/inlineCallout%}