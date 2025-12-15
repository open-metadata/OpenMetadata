---
layout: default
title: Users & Teams
parent: Components
nav_order: 123
---

# Users & Teams
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | 13 |
| **Test Cases** | 89 |
| **Test Steps** | 34 |
| **Total Scenarios** | 123 |

---

## Teams

📁 **File:** [`playwright/e2e/Pages/Teams.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 19 |
| Steps | 14 |
| Total | 33 |

### Teams Page
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Teams Page Flow | Teams Page Flow | 11 | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L144) |
| | ↳ *Create a new team* | | | [L145](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L145) |
| | ↳ *Add owner to created team* | | | [L161](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L161) |
| | ↳ *Update email of created team* | | | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L175) |
| | ↳ *Add user to created team* | | | [L179](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L179) |
| | ↳ *Remove added user from created team* | | | [L183](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L183) |
| | ↳ *Join team should work properly* | | | [L210](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L210) |
| | ↳ *Update display name for created team* | | | [L224](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L224) |
| | ↳ *Update description for created team* | | | [L251](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L251) |
| | ↳ *Leave team flow should work properly* | | | [L287](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L287) |
| | ↳ *Soft Delete Team* | | | [L308](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L308) |
| | ↳ *Hard Delete Team* | | | [L335](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L335) |
| 2 | Create a new public team | Create a new public team | - | [L356](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L356) |
| 3 | Create a new private team and check if its visible to admin in teams selection dropdown on user profile | Create a new private team and check if its visible to admin in teams selection dropdown on user profile | - | [L390](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L390) |
| 4 | Permanently deleting a team without soft deleting should work properly | Permanently deleting a team without soft deleting should work properly | - | [L455](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L455) |
| 5 | Team search should work properly | Team search should work properly | - | [L477](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L477) |
| 6 | Export team | Export team | - | [L516](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L516) |
| 7 | Team assets should | Team assets should | - | [L559](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L559) |
| 8 | Delete a user from the table | Delete a user from the table | - | [L625](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L625) |
| 9 | Verify breadcrumb navigation for a team with a dot in its name | Breadcrumb navigation for a team with a dot in its name | - | [L698](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L698) |
| 10 | Total User Count should be rendered | Total User Count should be rendered | - | [L731](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L731) |
| 11 | Show Deleted toggle should fetch teams with correct include parameter | Show Deleted toggle should fetch teams with correct include parameter | - | [L762](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L762) |

### Teams Page with EditUser Permission
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add and Remove User for Team | Add and Remove User for Team | 3 | [L884](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L884) |
| | ↳ *Add user in Team from the placeholder* | | | [L885](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L885) |
| | ↳ *Add user in Team for the header manage area* | | | [L889](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L889) |
| | ↳ *Remove user from Team* | | | [L893](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L893) |

### Teams Page with Data Consumer User
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should not have edit access on team page with no data available | Not have edit access on team page with no data available | - | [L954](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L954) |
| 2 | Should not have edit access on team page with data available | Not have edit access on team page with data available | - | [L1017](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1017) |

### Teams Page action as Owner of Team
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | User as not owner should not have edit/create permission on Team | User as not owner should not have edit/create permission on Team | - | [L1128](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1128) |
| 2 | Add New Team in BusinessUnit Team | Add New Team in BusinessUnit Team | - | [L1154](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1154) |
| 3 | Add New Team in Department Team | Add New Team in Department Team | - | [L1162](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1162) |
| 4 | Add New Team in Division Team | Add New Team in Division Team | - | [L1170](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1170) |
| 5 | Add New User in Group Team | Add New User in Group Team | - | [L1178](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1178) |

---

## Users

📁 **File:** [`playwright/e2e/Pages/Users.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 27 |
| Steps | 5 |
| Total | 32 |

### User with Admin Roles
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Update own admin details | Update own admin details | - | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L175) |
| 2 | Create and Delete user | Create and Delete user | - | [L185](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L185) |
| 3 | Admin soft & hard delete and restore user | Admin soft & hard delete and restore user | - | [L217](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L217) |
| 4 | Admin soft & hard delete and restore user from profile page | Admin soft & hard delete and restore user from profile page | - | [L239](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L239) |

### User with Data Consumer Roles
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Token generation & revocation for Data Consumer | Token generation & revocation for Data Consumer | - | [L262](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L262) |
| 2 | Update token expiration for Data Consumer | Update token expiration for Data Consumer | - | [L273](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L273) |
| 3 | User should have only view permission for glossary and tags for Data Consumer | User should have only view permission for glossary and tags for Data Consumer | - | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L292) |
| 4 | Operations for settings page for Data Consumer | Operations for settings page for Data Consumer | - | [L352](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L352) |
| 5 | Permissions for table details page for Data Consumer | Permissions for table details page for Data Consumer | - | [L358](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L358) |
| 6 | Update user details for Data Consumer | Update user details for Data Consumer | - | [L379](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L379) |
| 7 | Reset Password for Data Consumer | Reset Password for Data Consumer | - | [L390](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L390) |

### User with Data Steward Roles
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Update user details for Data Steward | Update user details for Data Steward | - | [L415](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L415) |
| 2 | Token generation & revocation for Data Steward | Token generation & revocation for Data Steward | - | [L424](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L424) |
| 3 | Update token expiration for Data Steward | Update token expiration for Data Steward | - | [L435](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L435) |
| 4 | Operations for settings page for Data Steward | Operations for settings page for Data Steward | - | [L454](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L454) |
| 5 | Check permissions for Data Steward | Permissions for Data Steward | - | [L460](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L460) |
| 6 | Reset Password for Data Steward | Reset Password for Data Steward | - | [L483](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L483) |

### User Profile Feed Interactions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should navigate to user profile from feed card avatar click | Navigate to user profile from feed card avatar click | - | [L506](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L506) |
| 2 | Close the profile dropdown after redirecting to user profile page | Close the profile dropdown after redirecting to user profile page | - | [L567](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L567) |

### User Profile Dropdown Persona Interactions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should display persona dropdown with pagination | Display persona dropdown with pagination | - | [L635](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L635) |
| 2 | Should display default persona tag correctly | Display default persona tag correctly | - | [L670](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L670) |
| 3 | Should switch personas correctly | Switch personas correctly | - | [L699](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L699) |
| 4 | Should handle persona sorting correctly | Handle persona sorting correctly | - | [L746](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L746) |
| 5 | Should revert to default persona after page refresh when non-default is selected | Revert to default persona after page refresh when non-default is selected | - | [L780](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L780) |
| 6 | Should handle default persona change and removal correctly | Handle default persona change and removal correctly | - | [L862](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L862) |

### User Profile Persona Interactions
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should add, remove, and navigate to persona pages for Personas section | Add, remove, and navigate to persona pages for Personas section | 2 | [L1055](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1055) |
| | ↳ *Navigate back to user profile* | | | [L1093](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1093) |
| | ↳ *Remove personas from user profile* | | | [L1099](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1099) |
| 2 | Should add, remove, and navigate to persona pages for Default Persona section | Add, remove, and navigate to persona pages for Default Persona section | 3 | [L1130](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1130) |
| | ↳ *Add default persona to user profile* | | | [L1142](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1142) |
| | ↳ *Navigate back to user profile* | | | [L1215](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1215) |
| | ↳ *Remove default persona from user profile* | | | [L1221](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1221) |

---

## PersonaFlow

📁 **File:** [`playwright/e2e/Flow/PersonaFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 6 |
| Steps | 4 |
| Total | 10 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Persona creation should work properly | Persona creation should work properly | - | [L95](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L95) |
| 2 | Persona update description flow should work properly | Persona update description flow should work properly | - | [L176](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L176) |
| 3 | Persona rename flow should work properly | Persona rename flow should work properly | - | [L202](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L202) |
| 4 | Remove users in persona should work properly | Remove users in persona should work properly | - | [L221](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L221) |
| 5 | Delete persona should work properly | Delete persona should work properly | - | [L249](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L249) |
| 6 | Set and remove default persona should work properly | Set and remove default persona should work properly | 4 | [L347](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L347) |

---

## UserDetails

📁 **File:** [`playwright/e2e/Pages/UserDetails.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 8 |
| Steps | 0 |
| Total | 8 |

### User with different Roles
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Admin user can get all the teams hierarchy and edit teams | Admin user can get all the teams hierarchy and edit teams | - | [L83](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L83) |
| 2 | Create team with domain and verify visibility of inherited domain in user profile after team removal | Create team with domain and verify visibility of inherited domain in user profile after team removal | - | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L114) |
| 3 | User can search for a domain | User can search for a domain | - | [L247](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L247) |
| 4 | Admin user can assign and remove domain from a user | Admin user can assign and remove domain from a user | - | [L274](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L274) |
| 5 | Subdomain is visible when expanding parent domain in tree | Subdomain is visible when expanding parent domain in tree | - | [L421](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L421) |
| 6 | Admin user can get all the roles hierarchy and edit roles | Admin user can get all the roles hierarchy and edit roles | - | [L493](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L493) |
| 7 | Non admin user should be able to edit display name and description on own profile | Non admin user should be able to edit display name and description on own profile | - | [L524](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L524) |
| 8 | Non admin user should not be able to edit the persona or roles | Non admin user should not be able to edit the persona or roles | - | [L550](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L550) |

---

## TeamsDragAndDrop

📁 **File:** [`playwright/e2e/Features/TeamsDragAndDrop.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 7 |
| Steps | 0 |
| Total | 7 |

### Teams drag and drop should work properly
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add teams in hierarchy | Add teams in hierarchy | - | [L102](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L102) |
| 2 | Should fail when drop team type is Group | Fail when drop team type is Group | - | [L116](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L116) |
| 3 | Should fail when droppable team type is Department | Fail when droppable team type is Department | - | [L126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L126) |
| 4 | Should fail when draggable team type is BusinessUnit and droppable team type is Division | Fail when draggable team type is BusinessUnit and droppable team type is Division | - | [L140](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L140) |
| 5 | Should drag and drop on ${TEAM_TYPE_BY_NAME[droppableTeamName]} team type | Drag and drop on ${TEAM_TYPE_BY_NAME[droppableTeamName]} team type | - | [L151](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L151) |
| 6 | Should drag and drop team on table level | Drag and drop team on table level | - | [L172](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L172) |
| 7 | Delete Teams | Delete Teams | - | [L193](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L193) |

---

## PersonaDeletionUserProfile

📁 **File:** [`playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 2 |
| Steps | 5 |
| Total | 7 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | User profile loads correctly before and after persona deletion | User profile loads correctly before and after persona deletion | 3 | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts#L52) |
| 2 | User profile loads correctly after DEFAULT persona deletion ⏭️ | User profile loads correctly after DEFAULT persona deletion | 2 | [L223](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts#L223) |

---

## OnlineUsers

📁 **File:** [`playwright/e2e/Features/OnlineUsers.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 6 |
| Steps | 0 |
| Total | 6 |

### Online Users Feature
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should show online users under Settings > Members > Online Users for admins | Show online users under Settings > Members > Online Users for admins | - | [L28](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L28) |
| 2 | Should update user activity time when user navigates | Update user activity time when user navigates | - | [L70](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L70) |
| 3 | Should not show bots in online users list | Not show bots in online users list | - | [L98](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L98) |
| 4 | Should filter users by time window | Filter users by time window | - | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L114) |
| 5 | Non-admin users should not see Online Users page | Non-admin users should not see Online Users page | - | [L155](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L155) |
| 6 | Should show correct last activity format | Show correct last activity format | - | [L170](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L170) |

---

## UserProfileOnlineStatus

📁 **File:** [`playwright/e2e/Features/UserProfileOnlineStatus.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 5 |
| Steps | 0 |
| Total | 5 |

### User Profile Online Status
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Should show online status badge on user profile for active users | Show online status badge on user profile for active users | - | [L44](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L44) |
| 2 | Should show  | Show  | - | [L81](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L81) |
| 3 | Should not show online status for inactive users | Not show online status for inactive users | - | [L103](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L103) |
| 4 | Should show online status below email in user profile card | Show online status below email in user profile card | - | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L122) |
| 5 | Should update online status in real-time when user becomes active | Update online status in real-time when user becomes active | - | [L151](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L151) |

---

## Bots

📁 **File:** [`playwright/e2e/Pages/Bots.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 4 |
| Total | 5 |

### Bots Page should work properly
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Bots Page should work properly | Bots Page should work properly | 4 | [L29](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts#L29) |
| | ↳ *Create Bot* | | | [L41](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts#L41) |
| | ↳ *Update display name and description* | | | [L45](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts#L45) |
| | ↳ *Update token expiration* | | | [L49](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts#L49) |
| | ↳ *Delete Bot* | | | [L54](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts#L54) |

---

## TeamsHierarchy

📁 **File:** [`playwright/e2e/Features/TeamsHierarchy.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 0 |
| Total | 3 |

### Add Nested Teams and Test TeamsSelectable
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Add teams in hierarchy | Add teams in hierarchy | - | [L58](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts#L58) |
| 2 | Check hierarchy in Add User page | Hierarchy in Add User page | - | [L75](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts#L75) |
| 3 | Delete Parent Team | Delete Parent Team | - | [L109](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts#L109) |

---

## AddRoleAndAssignToUser

📁 **File:** [`playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 3 |
| Steps | 0 |
| Total | 3 |

### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Create role | Create role | - | [L49](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts#L49) |
| 2 | Create new user and assign new role to him | Create new user and assign new role to him | - | [L81](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts#L81) |
| 3 | Verify assigned role to new user | Assigned role to new user | - | [L112](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts#L112) |

---

## IngestionBot

📁 **File:** [`playwright/e2e/Flow/IngestionBot.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 2 |
| Total | 3 |

### Ingestion Bot 
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Ingestion bot should be able to access domain specific domain | Ingestion bot should be able to access domain specific domain | 2 | [L87](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts#L87) |
| | ↳ *Assign assets to domains* | | | [L96](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts#L96) |
| | ↳ *Assign services to domains* | | | [L148](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts#L148) |

---

## UsersPagination

📁 **File:** [`playwright/e2e/Flow/UsersPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/UsersPagination.spec.ts)

| Metric | Count |
|--------|-------|
| Tests | 1 |
| Steps | 0 |
| Total | 1 |

### Soft Delete User Pagination
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
| 1 | Testing user API calls and pagination | Testing user API calls and pagination | - | [L63](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/UsersPagination.spec.ts#L63) |

---

