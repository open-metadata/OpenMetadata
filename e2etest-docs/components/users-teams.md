---
layout: default
title: Users & Teams
parent: Components
nav_order: 91
---

# Users & Teams

| Metric | Count |
|--------|-------|
| **Total Tests** | 91 |
| **Test Files** | 13 |

---

## Users

**File:** [`playwright/e2e/Pages/Users.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts)
**Tests:** 27

### User with Admin Roles

| Test | Line |
|------|------|
| Update own admin details | [L175](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L175) |
| Create and Delete user | [L185](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L185) |
| Admin soft & hard delete and restore user | [L217](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L217) |
| Admin soft & hard delete and restore user from profile page | [L239](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L239) |

### User with Data Consumer Roles

| Test | Line |
|------|------|
| Token generation & revocation for Data Consumer | [L262](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L262) |
| Update token expiration for Data Consumer | [L273](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L273) |
| User should have only view permission for glossary and tags for Data Consumer | [L292](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L292) |
| Operations for settings page for Data Consumer | [L352](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L352) |
| Permissions for table details page for Data Consumer | [L358](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L358) |
| Update user details for Data Consumer | [L379](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L379) |
| Reset Password for Data Consumer | [L390](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L390) |

### User with Data Steward Roles

| Test | Line |
|------|------|
| Update user details for Data Steward | [L415](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L415) |
| Token generation & revocation for Data Steward | [L424](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L424) |
| Update token expiration for Data Steward | [L435](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L435) |
| Operations for settings page for Data Steward | [L454](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L454) |
| Check permissions for Data Steward | [L460](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L460) |
| Reset Password for Data Steward | [L483](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L483) |

### User Profile Feed Interactions

| Test | Line |
|------|------|
| Should navigate to user profile from feed card avatar click | [L506](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L506) |
| Close the profile dropdown after redirecting to user profile page | [L567](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L567) |

### User Profile Dropdown Persona Interactions

| Test | Line |
|------|------|
| Should display persona dropdown with pagination | [L635](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L635) |
| Should display default persona tag correctly | [L670](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L670) |
| Should switch personas correctly | [L699](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L699) |
| Should handle persona sorting correctly | [L746](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L746) |
| Should revert to default persona after page refresh when non-default is selected | [L780](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L780) |
| Should handle default persona change and removal correctly | [L862](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L862) |

### User Profile Persona Interactions

| Test | Line |
|------|------|
| Should add, remove, and navigate to persona pages for Personas section | [L1055](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1055) |
| Should add, remove, and navigate to persona pages for Default Persona section | [L1130](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts#L1130) |

## Teams

**File:** [`playwright/e2e/Pages/Teams.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts)
**Tests:** 20

### Root Tests

| Test | Line |
|------|------|
| @ | [L74](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L74) |

### Teams Page

| Test | Line |
|------|------|
| Teams Page Flow | [L144](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L144) |
| Create a new public team | [L356](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L356) |
| Create a new private team and check if its visible to admin in teams selection dropdown on user profile | [L390](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L390) |
| Permanently deleting a team without soft deleting should work properly | [L455](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L455) |
| Team search should work properly | [L477](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L477) |
| Export team | [L516](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L516) |
| Team assets should | [L559](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L559) |
| Delete a user from the table | [L625](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L625) |
| Verify breadcrumb navigation for a team with a dot in its name | [L698](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L698) |
| Total User Count should be rendered | [L731](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L731) |
| Show Deleted toggle should fetch teams with correct include parameter | [L762](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L762) |

### Teams Page with EditUser Permission

| Test | Line |
|------|------|
| Add and Remove User for Team | [L884](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L884) |

### Teams Page with Data Consumer User

| Test | Line |
|------|------|
| Should not have edit access on team page with no data available | [L954](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L954) |
| Should not have edit access on team page with data available | [L1017](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1017) |

### Teams Page action as Owner of Team

| Test | Line |
|------|------|
| User as not owner should not have edit/create permission on Team | [L1128](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1128) |
| Add New Team in BusinessUnit Team | [L1154](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1154) |
| Add New Team in Department Team | [L1162](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1162) |
| Add New Team in Division Team | [L1170](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1170) |
| Add New User in Group Team | [L1178](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts#L1178) |

## UserDetails

**File:** [`playwright/e2e/Pages/UserDetails.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts)
**Tests:** 8

### User with different Roles

| Test | Line |
|------|------|
| Admin user can get all the teams hierarchy and edit teams | [L83](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L83) |
| Create team with domain and verify visibility of inherited domain in user profile after team removal | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L114) |
| User can search for a domain | [L247](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L247) |
| Admin user can assign and remove domain from a user | [L274](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L274) |
| Subdomain is visible when expanding parent domain in tree | [L421](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L421) |
| Admin user can get all the roles hierarchy and edit roles | [L493](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L493) |
| Non admin user should be able to edit display name and description on own profile | [L524](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L524) |
| Non admin user should not be able to edit the persona or roles | [L550](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts#L550) |

## TeamsDragAndDrop

**File:** [`playwright/e2e/Features/TeamsDragAndDrop.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts)
**Tests:** 7

### Teams drag and drop should work properly

| Test | Line |
|------|------|
| Add teams in hierarchy | [L102](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L102) |
| Should fail when drop team type is Group | [L116](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L116) |
| Should fail when droppable team type is Department | [L126](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L126) |
| Should fail when draggable team type is BusinessUnit and droppable team type is Division | [L140](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L140) |
| Should drag and drop on ${TEAM_TYPE_BY_NAME[droppableTeamName]} team type | [L151](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L151) |
| Should drag and drop team on table level | [L172](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L172) |
| Delete Teams | [L193](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts#L193) |

## OnlineUsers

**File:** [`playwright/e2e/Features/OnlineUsers.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts)
**Tests:** 6

### Online Users Feature

| Test | Line |
|------|------|
| Should show online users under Settings > Members > Online Users for admins | [L28](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L28) |
| Should update user activity time when user navigates | [L70](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L70) |
| Should not show bots in online users list | [L98](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L98) |
| Should filter users by time window | [L114](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L114) |
| Non-admin users should not see Online Users page | [L155](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L155) |
| Should show correct last activity format | [L170](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts#L170) |

## PersonaFlow

**File:** [`playwright/e2e/Flow/PersonaFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts)
**Tests:** 6

### Root Tests

| Test | Line |
|------|------|
| Persona creation should work properly | [L95](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L95) |
| Persona update description flow should work properly | [L176](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L176) |
| Persona rename flow should work properly | [L202](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L202) |
| Remove users in persona should work properly | [L221](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L221) |
| Delete persona should work properly | [L249](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L249) |
| Set and remove default persona should work properly | [L347](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts#L347) |

## UserProfileOnlineStatus

**File:** [`playwright/e2e/Features/UserProfileOnlineStatus.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts)
**Tests:** 5

### User Profile Online Status

| Test | Line |
|------|------|
| Should show online status badge on user profile for active users | [L44](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L44) |
| Should show  | [L81](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L81) |
| Should not show online status for inactive users | [L103](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L103) |
| Should show online status below email in user profile card | [L122](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L122) |
| Should update online status in real-time when user becomes active | [L151](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts#L151) |

## AddRoleAndAssignToUser

**File:** [`playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts)
**Tests:** 4

### Root Tests

| Test | Line |
|------|------|
| @ | [L30](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts#L30) |
| Create role | [L49](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts#L49) |
| Create new user and assign new role to him | [L81](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts#L81) |
| Verify assigned role to new user | [L112](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts#L112) |

## TeamsHierarchy

**File:** [`playwright/e2e/Features/TeamsHierarchy.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts)
**Tests:** 3

### Add Nested Teams and Test TeamsSelectable

| Test | Line |
|------|------|
| Add teams in hierarchy | [L58](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts#L58) |
| Check hierarchy in Add User page | [L75](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts#L75) |
| Delete Parent Team | [L109](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts#L109) |

## PersonaDeletionUserProfile

**File:** [`playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts)
**Tests:** 2

### Root Tests

| Test | Line |
|------|------|
| User profile loads correctly before and after persona deletion | [L52](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts#L52) |
| User profile loads correctly after DEFAULT persona deletion | [L223](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts#L223) |

## IngestionBot

**File:** [`playwright/e2e/Flow/IngestionBot.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts)
**Tests:** 1

### Ingestion Bot 

| Test | Line |
|------|------|
| Ingestion bot should be able to access domain specific domain | [L87](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts#L87) |

## UsersPagination

**File:** [`playwright/e2e/Flow/UsersPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/UsersPagination.spec.ts)
**Tests:** 1

### Soft Delete User Pagination

| Test | Line |
|------|------|
| Testing user API calls and pagination | [L63](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/UsersPagination.spec.ts#L63) |

## Bots

**File:** [`playwright/e2e/Pages/Bots.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts)
**Tests:** 1

### Bots Page should work properly

| Test | Line |
|------|------|
| Bots Page should work properly | [L29](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts#L29) |

