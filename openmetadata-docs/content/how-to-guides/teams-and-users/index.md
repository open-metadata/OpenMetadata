---
title: Team structure in OpenMetadata
slug: /how-to-guides/teams-and-users
---

# Team structure in OpenMetadata

In OpenMetadata we have hierarchal team structure with `teamType` that can be `Organization`, `Business Unit`, `Division`, `Department`, and `Group` (default team type).

- `Organization` is the root team in the hierarchy. _It can't have a parent_. It can have children of type `Business Unit`, `Division`, `Department`, `Group` along with `Users` directly as children (who are without teams).

- `BusinessUnit` is the next level of the team in the hierarchy. It can have `Business Unit`, `Division`, `Department`, and `Group` as children. It can only have ** one parent ** either of type `Organization`, or `Business Unit`.

- `Division` is the next level of the team in the hierarchy below `Business Unit`. It can have `Division`, `Department`, and `Group` as children. It can only have ** one parent ** of type `Organization`, `Business Unit`, or `Division`.

- `Department` is the next level of the team in the hierarchy below `Division`. It can have `Department` and `Group` as children. It can have `Organization`, `Business Unit`, `Division`, or `Department` as parents. ** It can have multiple parents **.

- `Group` is the last level of the team in the hierarchy. It can have only `Users` as children and not any other teams. It can have all the team types as parents. ** It can have multiple parents **.

<Image src="/images/how-to-guides/teams-and-users/teams-structure.png" alt="team-structure"/>
<br/>
<br/>
