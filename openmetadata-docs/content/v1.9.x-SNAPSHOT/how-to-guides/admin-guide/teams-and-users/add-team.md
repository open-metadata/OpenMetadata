---
title: How to Add a Team | OpenMetadata Admin Guide
slug: /how-to-guides/admin-guide/teams-and-users/add-team
---

# How to Add a Team

Creating a Team in OpenMetadata is easy. Decide on the `teamType` that you would like to add. Refer to the [**Team Structure in OpenMetadata**](/how-to-guides/admin-guide/teams-and-users) to get a clear understanding of the various **Team Types**.

**1.** Click on **Settings >> Team & User Management >> Teams**. Further, navigate to the relevant `BusinessUnit`, `Division`, or `Department` where you would like to create a new team. Click on **Add Team**.

{% image
src="/images/v1.9/how-to-guides/teams-and-users/teams.png"
alt="Navigate to team & user management"
caption="Navigate to team & user management"
/%}
{% image
src="/images/v1.9/how-to-guides/teams-and-users/teams1.1.png"
alt="click on teams"
caption="click on teams"
/%}
{% image
src="/images/v1.9/how-to-guides/teams-and-users/add-team1.png"
alt="select-team-type"
caption="Add a Team"
/%}

**2.** Enter the details like `Name`, `Display Name`, `Email`, `Team Type`, and `Description` and click on **OK**. The choice of the `teamType` is restricted by the type of the parent team selected. More information can be found in the [**Team Structure**](/how-to-guides/admin-guide/teams-and-users) document. Enable the **Public Team** option to allow open access, permitting anyone to join the team, view data, and collaborate.

{% note noteType="Warning" %}
- Once created, the teamType for `Group` **cannot be changed later**. 
- Only the Teams of the type `Group` can **own data assets**.
{% /note noteType="Warning" %}
{% /note %}

{% image
src="/images/v1.9/how-to-guides/teams-and-users/add-team2.png"
alt="select-team-type"
caption="Enter the Team Details"
/%}

**3.** The new team has been created. You can further add Users or create another Team within it.

{% image
src="/images/v1.9/how-to-guides/teams-and-users/add-team3.png"
alt="select-team-type"
caption="New Team Created"
/%}

{%inlineCallout
  color="violet-70"
  bold="How to Invite Users to OpenMetadata"
  icon="MdArrowForward"
  href="/how-to-guides/admin-guide/teams-and-users/invite-users"%}
  Data is a team game. Admins can invite other users.
{%/inlineCallout%}
