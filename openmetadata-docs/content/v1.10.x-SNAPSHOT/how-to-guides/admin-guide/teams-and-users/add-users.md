---
title: How to Add Users to Teams
slug: /how-to-guides/admin-guide/teams-and-users/add-users
---

# How to Add Users to Teams

If the user does not already exist in OpenMetadata, then [invite the user](/how-to-guides/admin-guide/teams-and-users/invite-users) to OpenMetadata. While creating the **new user**, you can add them to the relevant **Team** as well as assign them the relevant **Roles**.

{% note %}
**Note:** You can add a User to multiple Teams when creating a New User.
{% image
src="/images/v1.10/how-to-guides/teams-and-users/add-user5.png"
alt="Add User to Team"
/%}
{% /note %}


If the user, already exists in OpenMetadata, then
- Go to **Settings >> Team & User Management Teams >> Users Tab**
- Select the specific team you would like to add a user to. A team may have further sub teams. Select the required sub team.
- Click on **Add User**.

{% note %}
**Note:** Users will inherit the Roles that apply to the Team they belong to.
{% /note %}

{% image
src="/images/v1.10/how-to-guides/teams-and-users/add-user3.png"
alt="Add User to Team"
caption="Select Relevant Team"
/%}

{% image
src="/images/v1.10/how-to-guides/teams-and-users/add-user3.1.png"
alt="Teams"
caption="Teams"
/%}

{% image
src="/images/v1.10/how-to-guides/teams-and-users/add-user3.2.png"
alt="Add User to Team"
caption="Select Relevant Team"
/%}

- Search for the user, select the checkbox, and click on **Update**.

{% image
src="/images/v1.10/how-to-guides/teams-and-users/add-user4.png"
alt="Add User to Team"
caption="Add User to the Team"
/%}

It's that simple to add users to teams!

{%inlineCallout
  color="violet-70"
  bold="How to Change the Team Type"
  icon="MdArrowForward"
  href="/how-to-guides/admin-guide/teams-and-users/change-team-type"%}
  Change the team type to change the hierarchy.
{%/inlineCallout%}