---
title: How To Organise Teams And users
slug: /how-to-guides/teams-and-users/how-to-organise-teams-and-users
---

# How To Organise Teams And users

## Team structure in OpenMetadata

In OpenMetadata we have hierarchal team structure with `teamType` that can be `Organization`, `Business Unit`, `Division`, `Department`, and `Group` (default team type).

- `Organization` is the root team in the hierarchy. _It can't have a parent_. It can have children of type `Business Unit`, `Division`, `Department`, `Group` along with `Users` directly as children (who are without teams).

- `BusinessUnit` is the next level of the team in the hierarchy. It can have `Business Unit`, `Division`, `Department`, and `Group` as children. It can only have ** one parent ** either of type `Organization`, or `Business Unit`.

- `Division` is the next level of the team in the hierarchy below `Business Unit`. It can have `Division`, `Department`, and `Group` as children. It can only have ** one parent ** of type `Organization`, `Business Unit`, or `Division`.

- `Department` is the next level of the team in the hierarchy below `Division`. It can have `Department` and `Group` as children. It can have `Organization`, `Business Unit`, `Division`, or `Department` as parents. ** It can have multiple parents **.

- `Group` is the last level of the team in the hierarchy. It can have only `Users` as children and not any other teams. It can have all the team types as parents. ** It can have multiple parents **.

<Image src="/images/how-to-guides/teams-and-users/teams-structure.png" alt="team-structure"/>
<br/>
<br/>

## How to change the team type

Let's say you have team `Cloud_Infra` of type `Department` and you want to change it to the type `BusinessUnit`, you can easily do that through UI.

1. Click on the `Cloud_Infra` team name and it will take you to the `Cloud_Infra` details page.
   <Image src="/images/how-to-guides/teams-and-users/cloud-infra.png" alt="cloud-infra"/>
   <br/>
   <br/>
2. On details page you will see the `Type - Department` with edit button.
   <Image src="/images/how-to-guides/teams-and-users/team-type.png" alt="team-type"/>
   <br/>
   <br/>
3. Now Click on the edit button and you will get a set of options and from them select `BusinessUnit` and click on ✅ to save it.
   <Image src="/images/how-to-guides/teams-and-users/select-team-type.png" alt="select-team-type"/>
   <br/>
   <br/>
4. Now you can see `Cloud_Infra` team type changed to `BusinessUnit` from `Department`.
