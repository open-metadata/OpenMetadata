[🏠 Home](./README.md) > **Platform**

# Platform

> **12 Components** | **69 Files** | **1242 Tests** | **1618 Scenarios** 🚀

## Table of Contents
- [Other](#other)
- [Entities](#entities)
- [Settings](#settings)
- [Personas & Customizations](#personas-customizations)
- [Navigation](#navigation)
- [Lineage (UI)](#lineage-ui-)
- [Users & Teams](#users-teams)
- [SSO](#sso)
- [RBAC](#rbac)
- [Onboarding](#onboarding)
- [App Marketplace](#app-marketplace)
- [Authentication](#authentication)

---

<div id="other"></div>

## Other

<details open>
<summary>📄 <b>ConditionalPermissions.spec.ts</b> (22 tests, 22 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ConditionalPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ConditionalPermissions.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | User with owner permission can only view owned Api Services | User with owner permission can only view owned Api Services |
| 2 | User with matchAnyTag permission can only view Api Services with the tag | User with matchAnyTag permission can only view Api Services with the tag |
| 3 | User with owner permission can only view owned Storage Services | User with owner permission can only view owned Storage Services |
| 4 | User with matchAnyTag permission can only view Storage Services with the tag | User with matchAnyTag permission can only view Storage Services with the tag |
| 5 | User with owner permission can only view owned Dashboard Services | User with owner permission can only view owned Dashboard Services |
| 6 | User with matchAnyTag permission can only view Dashboard Services with the tag | User with matchAnyTag permission can only view Dashboard Services with the tag |
| 7 | User with owner permission can only view owned Mlmodel Services | User with owner permission can only view owned Mlmodel Services |
| 8 | User with matchAnyTag permission can only view Mlmodel Services with the tag | User with matchAnyTag permission can only view Mlmodel Services with the tag |
| 9 | User with owner permission can only view owned Pipeline Services | User with owner permission can only view owned Pipeline Services |
| 10 | User with matchAnyTag permission can only view Pipeline Services with the tag | User with matchAnyTag permission can only view Pipeline Services with the tag |
| 11 | User with owner permission can only view owned Search Services | User with owner permission can only view owned Search Services |
| 12 | User with matchAnyTag permission can only view Search Services with the tag | User with matchAnyTag permission can only view Search Services with the tag |
| 13 | User with owner permission can only view owned Database Services | User with owner permission can only view owned Database Services |
| 14 | User with matchAnyTag permission can only view Database Services with the tag | User with matchAnyTag permission can only view Database Services with the tag |
| 15 | User with owner permission can only view owned Messaging Services | User with owner permission can only view owned Messaging Services |
| 16 | User with matchAnyTag permission can only view Messaging Services with the tag | User with matchAnyTag permission can only view Messaging Services with the tag |
| 17 | User with owner permission can only view owned Database | User with owner permission can only view owned Database |
| 18 | User with matchAnyTag permission can only view Database with the tag | User with matchAnyTag permission can only view Database with the tag |
| 19 | User with owner permission can only view owned Database Schema | User with owner permission can only view owned Database Schema |
| 20 | User with matchAnyTag permission can only view Database Schema with the tag | User with matchAnyTag permission can only view Database Schema with the tag |
| 21 | User with owner permission can only view owned Container | User with owner permission can only view owned Container |
| 22 | User with matchAnyTag permission can only view Container with the tag | User with matchAnyTag permission can only view Container with the tag |

</details>

<details open>
<summary>📄 <b>AutoPilot.spec.ts</b> (10 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/AutoPilot.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AutoPilot.spec.ts)

### Rest

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Rest** - Create Service and check the AutoPilot status | Create Service and check the AutoPilot status |
| 2 | **Rest** - Agents created by AutoPilot should be deleted | Agents created by AutoPilot should be deleted |

### Metabase

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metabase** - Create Service and check the AutoPilot status | Create Service and check the AutoPilot status |
| 2 | **Metabase** - Agents created by AutoPilot should be deleted | Agents created by AutoPilot should be deleted |

### Mysql

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Mysql** - Create Service and check the AutoPilot status | Create Service and check the AutoPilot status |
| 2 | **Mysql** - Agents created by AutoPilot should be deleted | Agents created by AutoPilot should be deleted |

### Kafka

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Kafka** - Create Service and check the AutoPilot status | Create Service and check the AutoPilot status |
| 2 | **Kafka** - Agents created by AutoPilot should be deleted | Agents created by AutoPilot should be deleted |

### Mlflow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Mlflow** - Create Service and check the AutoPilot status | Create Service and check the AutoPilot status |
| 2 | **Mlflow** - Agents created by AutoPilot should be deleted | Agents created by AutoPilot should be deleted |

</details>

<details open>
<summary>📄 <b>Collect.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/Collect.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Collect.spec.ts)

### Collect end point should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Collect end point should work properly** - Visit Settings page should trigger collect API | Visit Settings page should trigger collect API |
| 2 | **Collect end point should work properly** - Visit Explore page should trigger collect API | Visit Explore page should trigger collect API |
| 3 | **Collect end point should work properly** - Visit Quality page should trigger collect API | Visit Quality page should trigger collect API |
| 4 | **Collect end point should work properly** - Visit Incident Manager page should trigger collect API | Visit Incident Manager page should trigger collect API |
| 5 | **Collect end point should work properly** - Visit Insights page should trigger collect API | Visit Insights page should trigger collect API |
| 6 | **Collect end point should work properly** - Visit Glossary page should trigger collect API | Visit Glossary page should trigger collect API |
| 7 | **Collect end point should work properly** - Visit Tags page should trigger collect API | Visit Tags page should trigger collect API |

</details>

<details open>
<summary>📄 <b>CertificationDropdown.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CertificationDropdown.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CertificationDropdown.spec.ts)

### Certification Dropdown

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Certification Dropdown** - should show enabled certification tag in dropdown | Show enabled certification tag in dropdown |
| 2 | **Certification Dropdown** - should NOT show disabled certification tag in dropdown | NOT show disabled certification tag in dropdown |
| 3 | **Certification Dropdown** - should NOT show certifications when classification is disabled | NOT show certifications when classification is disabled |
| 4 | **Certification Dropdown** - should show certification after re-enabling disabled tag | Show certification after re-enabling disabled tag |
| 5 | **Certification Dropdown** - should show certifications after re-enabling classification | Show certifications after re-enabling classification |
| 6 | **Certification Dropdown** - should handle multiple disabled tags correctly | Handle multiple disabled tags correctly |

</details>

<details open>
<summary>📄 <b>DescriptionSuggestion.spec.ts</b> (5 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DescriptionSuggestion.spec.ts)

### Description Suggestions Table Entity

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Description Suggestions Table Entity** - View, Close, Reject and Accept the Suggestions | View, Close, Reject and Accept the Suggestions |
| | ↳ *View and Open the Suggestions* | |
| | ↳ *Accept Single Suggestion* | |
| | ↳ *Accept Nested Suggestion* | |
| | ↳ *Reject Single Suggestion* | |
| | ↳ *Accept all Suggestion* | |
| 2 | **Description Suggestions Table Entity** - Reject All Suggestions | Reject All Suggestions |
| 3 | **Description Suggestions Table Entity** - Fetch on avatar click and then all Pending Suggestions button click | Fetch on avatar click and then all Pending Suggestions button click |
| 4 | **Description Suggestions Table Entity** - Should auto fetch more suggestions, when last user avatar is eliminated and there are more suggestions | Auto fetch more suggestions, when last user avatar is eliminated and there are more suggestions |
| 5 | **Description Suggestions Table Entity** - Should fetch initial 10 suggestions on entity change from table1 to table2 | Fetch initial 10 suggestions on entity change from table1 to table2 |

</details>

<details open>
<summary>📄 <b>FrequentlyJoined.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/FrequentlyJoined.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/FrequentlyJoined.spec.ts)

### Frequently Joined

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Frequently Joined** - should display frequently joined columns | Display frequently joined columns |
| 2 | **Frequently Joined** - should display frequently joined table | Display frequently joined table |

</details>

<details open>
<summary>📄 <b>auth.setup.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/auth.setup.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/auth.setup.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | authenticate all users | Authenticate all users |

</details>

<details open>
<summary>📄 <b>dataInsightApp.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/dataInsightApp.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/dataInsightApp.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Run Data Insight application and wait until success | Run Data Insight application and wait until success |

</details>

<details open>
<summary>📄 <b>entity-data.setup.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/entity-data.setup.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/entity-data.setup.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | create entity data prerequisites | Create entity data prerequisites |

</details>

<details open>
<summary>📄 <b>entity-data.teardown.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/entity-data.teardown.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/entity-data.teardown.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | cleanup entity data prerequisites | Cleanup entity data prerequisites |

</details>

<details open>
<summary>📄 <b>Markdown.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Markdown.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Markdown.spec.ts)

### Markdown

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Markdown** - should render markdown | Render markdown |

</details>

<details open>
<summary>📄 <b>Permission.spec.ts</b> (1 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permission.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permission.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Permissions | Permissions |
| | ↳ *ViewBasic permission* | |
| | ↳ *EditQuery permission* | |
| | ↳ *EditTest permission* | |

</details>

<details open>
<summary>📄 <b>ApiCollection.spec.ts</b> (1 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts)

### API Collection Entity Special Test Cases

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **API Collection Entity Special Test Cases** - Verify Owner Propagation: owner should be propagated to the API Collection's API Endpoint | Owner Propagation: owner should be propagated to the API Collection's API Endpoint |
| | ↳ *Verify user Owner Propagation: owner should be propagated to the API Collection's API Endpoint* | |
| | ↳ *Verify team Owner Propagation: owner should be propagated to the API Collection's API Endpoint* | |

</details>

<details open>
<summary>📄 <b>ApiDocs.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ApiDocs.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiDocs.spec.ts)

### API docs should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **API docs should work properly** - API docs should work properly | API docs should work properly |

</details>

<details open>
<summary>📄 <b>AppBasic.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/AppBasic.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AppBasic.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | should call installed app api and it should respond with 200 | Call installed app api and it should respond with 200 |

</details>

<details open>
<summary>📄 <b>Bots.spec.ts</b> (1 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Bots.spec.ts)

### Bots Page should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Bots Page should work properly** - Bots Page should work properly | Bots Page should work properly |
| | ↳ *Verify ingestion bot delete button is always disabled* | |
| | ↳ *Create Bot* | |
| | ↳ *Update display name and description* | |
| | ↳ *Update token expiration* | |
| | ↳ *Delete Bot* | |

</details>

<details open>
<summary>📄 <b>HealthCheck.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/HealthCheck.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/HealthCheck.spec.ts)

### Health Check for OpenMetadata

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Health Check for OpenMetadata** - All 5 checks should be successful | All 5 checks should be successful |

</details>

<details open>
<summary>📄 <b>OmdURLConfiguration.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/OmdURLConfiguration.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/OmdURLConfiguration.spec.ts)

### OM URL configuration

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **OM URL configuration** - update om url configuration should work | Update om url configuration should work |

</details>


---

<div id="entities"></div>

## Entities

<details open>
<summary>📄 <b>Entity.spec.ts</b> (321 tests, 352 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Entity.spec.ts)

### Api Endpoint

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Api Endpoint** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Api Endpoint** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Api Endpoint** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Api Endpoint** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Api Endpoint** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Api Endpoint** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Api Endpoint** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Api Endpoint** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Api Endpoint** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Api Endpoint** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Api Endpoint** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Api Endpoint** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 13 | **Api Endpoint** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 14 | **Api Endpoint** - Description Add, Update and Remove for child entities | Tests description management for child entities  Tests adding, updating, and removing descriptions on child entities within a parent entity |
| 15 | **Api Endpoint** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 16 | **Api Endpoint** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 17 | **Api Endpoint** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 18 | **Api Endpoint** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 19 | **Api Endpoint** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 20 | **Api Endpoint** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 21 | **Api Endpoint** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Table** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Table** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Table** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Table** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Table** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Table** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Table** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Table** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Table** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Table** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Table** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 13 | **Table** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 14 | **Table** - DisplayName Add, Update and Remove for child entities | DisplayName Add, Update and Remove for child entities |
| 15 | **Table** - Description Add, Update and Remove for child entities | Tests description management for child entities  Tests adding, updating, and removing descriptions on child entities within a parent entity |
| 16 | **Table** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 17 | **Table** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 18 | **Table** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 19 | **Table** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 20 | **Table** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 21 | **Table** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 22 | **Table** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |
| 23 | **Table** - Switch from Data Observability tab to Activity Feed tab and verify data appears | Switch from Data Observability tab to Activity Feed tab and verify data appears |
| | ↳ *Navigate to Data Observability tab* | |
| | ↳ *Verify tabs UI component is rendered in Data Observability tab* | |
| | ↳ *Switch to Activity Feed tab* | |
| | ↳ *Verify tabs or left component is rendered in Activity Feed tab* | |
| 24 | **Table** - Data Consumer should be denied access to queries and sample data tabs when deny policy rule is applied on table level | Tests access control for table-level data access with deny policy  Tests that a data consumer assigned a role with deny rules for ViewQueries and ViewSampleData cannot access those tabs on table entities |

### Stored Procedure

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Stored Procedure** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Stored Procedure** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Stored Procedure** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Stored Procedure** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Stored Procedure** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Stored Procedure** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Stored Procedure** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Stored Procedure** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Stored Procedure** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Stored Procedure** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Stored Procedure** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 12 | **Stored Procedure** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 13 | **Stored Procedure** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 14 | **Stored Procedure** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 15 | **Stored Procedure** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 16 | **Stored Procedure** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 17 | **Stored Procedure** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Dashboard** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Dashboard** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Dashboard** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Dashboard** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Dashboard** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Dashboard** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Dashboard** - Dashboard page should show the project name | Tests project name visibility on Dashboard and DashboardDataModel pages  Verifies that the project name is displayed on Dashboard and DashboardDataModel entity pages |
| 9 | **Dashboard** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 10 | **Dashboard** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 11 | **Dashboard** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 12 | **Dashboard** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 13 | **Dashboard** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 14 | **Dashboard** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 15 | **Dashboard** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 16 | **Dashboard** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 17 | **Dashboard** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 18 | **Dashboard** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 19 | **Dashboard** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Pipeline** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Pipeline** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Pipeline** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Pipeline** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Pipeline** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Pipeline** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Pipeline** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Pipeline** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Pipeline** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Pipeline** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Pipeline** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 13 | **Pipeline** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 14 | **Pipeline** - Description Add, Update and Remove for child entities | Tests description management for child entities  Tests adding, updating, and removing descriptions on child entities within a parent entity |
| 15 | **Pipeline** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 16 | **Pipeline** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 17 | **Pipeline** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 18 | **Pipeline** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 19 | **Pipeline** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 20 | **Pipeline** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 21 | **Pipeline** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Topic** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Topic** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Topic** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Topic** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Topic** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Topic** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Topic** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Topic** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Topic** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Topic** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Topic** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 13 | **Topic** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 14 | **Topic** - Description Add, Update and Remove for child entities | Tests description management for child entities  Tests adding, updating, and removing descriptions on child entities within a parent entity |
| 15 | **Topic** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 16 | **Topic** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 17 | **Topic** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 18 | **Topic** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 19 | **Topic** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 20 | **Topic** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 21 | **Topic** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Ml Model

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Ml Model** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Ml Model** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Ml Model** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Ml Model** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Ml Model** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Ml Model** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Ml Model** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Ml Model** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Ml Model** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Ml Model** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Ml Model** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Ml Model** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 13 | **Ml Model** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 14 | **Ml Model** - Description Add, Update and Remove for child entities | Tests description management for child entities  Tests adding, updating, and removing descriptions on child entities within a parent entity |
| 15 | **Ml Model** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 16 | **Ml Model** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 17 | **Ml Model** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 18 | **Ml Model** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 19 | **Ml Model** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 20 | **Ml Model** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 21 | **Ml Model** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Container** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Container** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Container** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Container** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Container** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Container** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Container** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Container** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Container** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Container** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Container** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 13 | **Container** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 14 | **Container** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 15 | **Container** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 16 | **Container** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 17 | **Container** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 18 | **Container** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Search Index

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Search Index** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Search Index** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Search Index** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Search Index** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Search Index** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Search Index** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Search Index** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Search Index** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Search Index** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Search Index** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Search Index** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Search Index** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 13 | **Search Index** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 14 | **Search Index** - Description Add, Update and Remove for child entities | Tests description management for child entities  Tests adding, updating, and removing descriptions on child entities within a parent entity |
| 15 | **Search Index** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 16 | **Search Index** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 17 | **Search Index** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 18 | **Search Index** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 19 | **Search Index** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 20 | **Search Index** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 21 | **Search Index** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Dashboard Data Model

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard Data Model** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Dashboard Data Model** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Dashboard Data Model** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Dashboard Data Model** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Dashboard Data Model** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Dashboard Data Model** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Dashboard Data Model** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Dashboard Data Model** - DashboardDataModel page should show the project name | Tests project name visibility on Dashboard and DashboardDataModel pages  Verifies that the project name is displayed on Dashboard and DashboardDataModel entity pages |
| 9 | **Dashboard Data Model** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 10 | **Dashboard Data Model** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 11 | **Dashboard Data Model** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 12 | **Dashboard Data Model** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 13 | **Dashboard Data Model** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 14 | **Dashboard Data Model** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 15 | **Dashboard Data Model** - DisplayName Add, Update and Remove for child entities | DisplayName Add, Update and Remove for child entities |
| 16 | **Dashboard Data Model** - Description Add, Update and Remove for child entities | Tests description management for child entities  Tests adding, updating, and removing descriptions on child entities within a parent entity |
| 17 | **Dashboard Data Model** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 18 | **Dashboard Data Model** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 19 | **Dashboard Data Model** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 20 | **Dashboard Data Model** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 21 | **Dashboard Data Model** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 22 | **Dashboard Data Model** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 23 | **Dashboard Data Model** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Metric

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Metric** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Metric** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Metric** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Metric** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Metric** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Metric** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Metric** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Metric** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Metric** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Metric** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 12 | **Metric** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 13 | **Metric** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 14 | **Metric** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 15 | **Metric** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 16 | **Metric** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 17 | **Metric** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Chart

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Chart** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Chart** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Chart** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Chart** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Chart** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Chart** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Chart** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Chart** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Chart** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Chart** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Chart** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 12 | **Chart** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 13 | **Chart** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 14 | **Chart** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 15 | **Chart** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 16 | **Chart** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 17 | **Chart** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Directory

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Directory** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Directory** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Directory** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Directory** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Directory** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Directory** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Directory** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Directory** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Directory** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Directory** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Directory** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 12 | **Directory** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 13 | **Directory** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 14 | **Directory** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 15 | **Directory** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 16 | **Directory** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### File

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **File** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **File** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **File** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **File** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **File** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **File** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **File** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **File** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **File** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **File** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **File** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 12 | **File** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 13 | **File** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 14 | **File** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 15 | **File** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 16 | **File** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Spreadsheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Spreadsheet** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Spreadsheet** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Spreadsheet** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Spreadsheet** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Spreadsheet** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Spreadsheet** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Spreadsheet** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Spreadsheet** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Spreadsheet** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Spreadsheet** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Spreadsheet** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 12 | **Spreadsheet** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 13 | **Spreadsheet** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 14 | **Spreadsheet** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 15 | **Spreadsheet** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 16 | **Spreadsheet** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Worksheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Worksheet** - Domain Add, Update and Remove | Tests domain management on entities  Tests adding a domain to an entity, updating it to a different domain, and removing the domain |
| 2 | **Worksheet** - Domain Propagation | Tests domain propagation from service to entity  Verifies that a domain assigned to a service propagates to its child entities, and that removing the domain from the service removes it from the entity |
| 3 | **Worksheet** - User as Owner Add, Update and Remove | Tests user ownership management on entities  Tests adding users as owners, updating owner list, and removing owners from an entity |
| 4 | **Worksheet** - Team as Owner Add, Update and Remove | Tests team ownership management on entities  Tests adding teams as owners, updating team owner list, and removing teams from an entity |
| 5 | **Worksheet** - User as Owner with unsorted list | Tests multi-user ownership with unsorted owner list  Tests adding multiple owners in different order, removing individual owners, and verifying the owner list maintains proper state |
| 6 | **Worksheet** - Tier Add, Update and Remove | Tests tier management on entities  Tests assigning a tier to an entity, updating it to a different tier, and removing the tier |
| 7 | **Worksheet** - Certification Add Remove | Tests certification management on entities  Tests adding a certification badge to an entity, updating it to a different certification, and removing it |
| 8 | **Worksheet** - Update description | Tests description update functionality  Tests adding and updating entity description |
| 9 | **Worksheet** - Tag Add, Update and Remove | Tests tag management on entities  Tests adding tags to an entity, updating the tag selection, and removing tags |
| 10 | **Worksheet** - Glossary Term Add, Update and Remove | Tests glossary term management on entities  Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms |
| 11 | **Worksheet** - Tag and Glossary Selector should close vice versa | Tests tag and glossary selector mutual exclusivity  Verifies that opening the tag selector closes the glossary selector and vice versa |
| 12 | **Worksheet** - Announcement create, edit & delete | Tests announcement lifecycle management  Tests creating an announcement on an entity, editing it, and deleting it |
| 13 | **Worksheet** - Inactive Announcement create & delete | Tests inactive announcement management  Tests creating an inactive announcement and then deleting it |
| 14 | **Worksheet** - UpVote & DownVote entity | Tests entity voting functionality  Tests upvoting an entity and downvoting it, verifying vote state changes |
| 15 | **Worksheet** - Follow & Un-follow entity | Tests entity following functionality  Tests following an entity and unfollowing it, verifying follow state changes |
| 16 | **Worksheet** - Update displayName | Tests entity display name update  Tests renaming an entity by updating its display name |
| 17 | **Worksheet** - User should be denied access to edit description when deny policy rule is applied on an entity | Tests access control for description editing with deny policy  Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions |

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Delete Api Endpoint | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 2 | Delete Table | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 3 | Delete Stored Procedure | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 4 | Delete Dashboard | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 5 | Delete Pipeline | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 6 | Delete Topic | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 7 | Delete Ml Model | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 8 | Delete Container | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 9 | Delete Search Index | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 10 | Delete Dashboard Data Model | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 11 | Delete Metric | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 12 | Delete Chart | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 13 | Delete Directory | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 14 | Delete File | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 15 | Delete Spreadsheet | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 16 | Delete Worksheet | Tests entity deletion (soft and hard delete)  Tests soft deleting an entity and then hard deleting it to completely remove it from the system |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |

</details>

<details open>
<summary>📄 <b>EntityDataSteward.spec.ts</b> (158 tests, 158 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataSteward.spec.ts)

### ApiEndpoint

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **ApiEndpoint** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **ApiEndpoint** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **ApiEndpoint** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **ApiEndpoint** - Update description | Update description |
| 5 | **ApiEndpoint** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **ApiEndpoint** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **ApiEndpoint** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 8 | **ApiEndpoint** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **ApiEndpoint** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 10 | **ApiEndpoint** - UpVote & DownVote entity | UpVote & DownVote entity |
| 11 | **ApiEndpoint** - Follow & Un-follow entity | Follow & Un-follow entity |
| 12 | **ApiEndpoint** - Update displayName | Update displayName |

### Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Table** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Table** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Table** - Update description | Update description |
| 5 | **Table** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Table** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Table** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 8 | **Table** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **Table** - DisplayName Add, Update and Remove for child entities | DisplayName Add, Update and Remove for child entities |
| 10 | **Table** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 11 | **Table** - UpVote & DownVote entity | UpVote & DownVote entity |
| 12 | **Table** - Follow & Un-follow entity | Follow & Un-follow entity |
| 13 | **Table** - Update displayName | Update displayName |

### Store Procedure

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Store Procedure** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Store Procedure** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Store Procedure** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Store Procedure** - Update description | Update description |
| 5 | **Store Procedure** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Store Procedure** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Store Procedure** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **Store Procedure** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **Store Procedure** - Update displayName | Update displayName |

### Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Dashboard** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Dashboard** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Dashboard** - Update description | Update description |
| 5 | **Dashboard** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Dashboard** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Dashboard** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **Dashboard** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **Dashboard** - Update displayName | Update displayName |

### Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Pipeline** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Pipeline** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Pipeline** - Update description | Update description |
| 5 | **Pipeline** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Pipeline** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Pipeline** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 8 | **Pipeline** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **Pipeline** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 10 | **Pipeline** - UpVote & DownVote entity | UpVote & DownVote entity |
| 11 | **Pipeline** - Follow & Un-follow entity | Follow & Un-follow entity |
| 12 | **Pipeline** - Update displayName | Update displayName |

### Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Topic** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Topic** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Topic** - Update description | Update description |
| 5 | **Topic** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Topic** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Topic** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 8 | **Topic** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **Topic** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 10 | **Topic** - UpVote & DownVote entity | UpVote & DownVote entity |
| 11 | **Topic** - Follow & Un-follow entity | Follow & Un-follow entity |
| 12 | **Topic** - Update displayName | Update displayName |

### MlModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **MlModel** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **MlModel** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **MlModel** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **MlModel** - Update description | Update description |
| 5 | **MlModel** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **MlModel** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **MlModel** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 8 | **MlModel** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **MlModel** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 10 | **MlModel** - UpVote & DownVote entity | UpVote & DownVote entity |
| 11 | **MlModel** - Follow & Un-follow entity | Follow & Un-follow entity |
| 12 | **MlModel** - Update displayName | Update displayName |

### Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Container** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Container** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Container** - Update description | Update description |
| 5 | **Container** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Container** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Container** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **Container** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **Container** - Update displayName | Update displayName |

### SearchIndex

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SearchIndex** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **SearchIndex** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **SearchIndex** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **SearchIndex** - Update description | Update description |
| 5 | **SearchIndex** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **SearchIndex** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **SearchIndex** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 8 | **SearchIndex** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **SearchIndex** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 10 | **SearchIndex** - UpVote & DownVote entity | UpVote & DownVote entity |
| 11 | **SearchIndex** - Follow & Un-follow entity | Follow & Un-follow entity |
| 12 | **SearchIndex** - Update displayName | Update displayName |

### DashboardDataModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **DashboardDataModel** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **DashboardDataModel** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **DashboardDataModel** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **DashboardDataModel** - Update description | Update description |
| 5 | **DashboardDataModel** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **DashboardDataModel** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **DashboardDataModel** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 8 | **DashboardDataModel** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **DashboardDataModel** - DisplayName Add, Update and Remove for child entities | DisplayName Add, Update and Remove for child entities |
| 10 | **DashboardDataModel** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 11 | **DashboardDataModel** - UpVote & DownVote entity | UpVote & DownVote entity |
| 12 | **DashboardDataModel** - Follow & Un-follow entity | Follow & Un-follow entity |
| 13 | **DashboardDataModel** - Update displayName | Update displayName |

### Metric

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Metric** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Metric** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Metric** - Update description | Update description |
| 5 | **Metric** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Metric** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Metric** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **Metric** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **Metric** - Update displayName | Update displayName |

### Directory

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Directory** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Directory** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Directory** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Directory** - Update description | Update description |
| 5 | **Directory** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Directory** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Directory** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **Directory** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **Directory** - Update displayName | Update displayName |

### File

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **File** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **File** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **File** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **File** - Update description | Update description |
| 5 | **File** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **File** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **File** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **File** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **File** - Update displayName | Update displayName |

### Spreadsheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Spreadsheet** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Spreadsheet** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Spreadsheet** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Spreadsheet** - Update description | Update description |
| 5 | **Spreadsheet** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Spreadsheet** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Spreadsheet** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **Spreadsheet** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **Spreadsheet** - Update displayName | Update displayName |

### Worksheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Worksheet** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 2 | **Worksheet** - Team as Owner Add, Update and Remove | Team as Owner Add, Update and Remove |
| 3 | **Worksheet** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 4 | **Worksheet** - Update description | Update description |
| 5 | **Worksheet** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 6 | **Worksheet** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 7 | **Worksheet** - UpVote & DownVote entity | UpVote & DownVote entity |
| 8 | **Worksheet** - Follow & Un-follow entity | Follow & Un-follow entity |
| 9 | **Worksheet** - Update displayName | Update displayName |

</details>

<details open>
<summary>📄 <b>EntityDataConsumer.spec.ts</b> (143 tests, 143 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/EntityDataConsumer.spec.ts)

### ApiEndpoint

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **ApiEndpoint** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **ApiEndpoint** - Update description | Update description |
| 3 | **ApiEndpoint** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **ApiEndpoint** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **ApiEndpoint** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 6 | **ApiEndpoint** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 7 | **ApiEndpoint** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 8 | **ApiEndpoint** - UpVote & DownVote entity | UpVote & DownVote entity |
| 9 | **ApiEndpoint** - Follow & Un-follow entity | Follow & Un-follow entity |
| 10 | **ApiEndpoint** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 11 | **ApiEndpoint** - No edit owner permission | No edit owner permission |

### Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Table** - Update description | Update description |
| 3 | **Table** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Table** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Table** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 6 | **Table** - DisplayName edit for child entities should not be allowed | DisplayName edit for child entities should not be allowed |
| 7 | **Table** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 8 | **Table** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **Table** - UpVote & DownVote entity | UpVote & DownVote entity |
| 10 | **Table** - Follow & Un-follow entity | Follow & Un-follow entity |
| 11 | **Table** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 12 | **Table** - No edit owner permission | No edit owner permission |

### Store Procedure

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Store Procedure** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Store Procedure** - Update description | Update description |
| 3 | **Store Procedure** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Store Procedure** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Store Procedure** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **Store Procedure** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **Store Procedure** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **Store Procedure** - No edit owner permission | No edit owner permission |

### Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Dashboard** - Update description | Update description |
| 3 | **Dashboard** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Dashboard** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Dashboard** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **Dashboard** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **Dashboard** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **Dashboard** - No edit owner permission | No edit owner permission |

### Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Pipeline** - Update description | Update description |
| 3 | **Pipeline** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Pipeline** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Pipeline** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 6 | **Pipeline** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 7 | **Pipeline** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 8 | **Pipeline** - UpVote & DownVote entity | UpVote & DownVote entity |
| 9 | **Pipeline** - Follow & Un-follow entity | Follow & Un-follow entity |
| 10 | **Pipeline** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 11 | **Pipeline** - No edit owner permission | No edit owner permission |

### Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Topic** - Update description | Update description |
| 3 | **Topic** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Topic** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Topic** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 6 | **Topic** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 7 | **Topic** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 8 | **Topic** - UpVote & DownVote entity | UpVote & DownVote entity |
| 9 | **Topic** - Follow & Un-follow entity | Follow & Un-follow entity |
| 10 | **Topic** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 11 | **Topic** - No edit owner permission | No edit owner permission |

### MlModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **MlModel** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **MlModel** - Update description | Update description |
| 3 | **MlModel** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **MlModel** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **MlModel** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 6 | **MlModel** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 7 | **MlModel** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 8 | **MlModel** - UpVote & DownVote entity | UpVote & DownVote entity |
| 9 | **MlModel** - Follow & Un-follow entity | Follow & Un-follow entity |
| 10 | **MlModel** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 11 | **MlModel** - No edit owner permission | No edit owner permission |

### Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Container** - Update description | Update description |
| 3 | **Container** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Container** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Container** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **Container** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **Container** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **Container** - No edit owner permission | No edit owner permission |

### SearchIndex

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SearchIndex** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **SearchIndex** - Update description | Update description |
| 3 | **SearchIndex** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **SearchIndex** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **SearchIndex** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 6 | **SearchIndex** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 7 | **SearchIndex** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 8 | **SearchIndex** - UpVote & DownVote entity | UpVote & DownVote entity |
| 9 | **SearchIndex** - Follow & Un-follow entity | Follow & Un-follow entity |
| 10 | **SearchIndex** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 11 | **SearchIndex** - No edit owner permission | No edit owner permission |

### DashboardDataModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **DashboardDataModel** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **DashboardDataModel** - Update description | Update description |
| 3 | **DashboardDataModel** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **DashboardDataModel** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **DashboardDataModel** - Tag Add, Update and Remove for child entities | Tag Add, Update and Remove for child entities |
| 6 | **DashboardDataModel** - DisplayName edit for child entities should not be allowed | DisplayName edit for child entities should not be allowed |
| 7 | **DashboardDataModel** - Description Add, Update and Remove for child entities | Description Add, Update and Remove for child entities |
| 8 | **DashboardDataModel** - Glossary Term Add, Update and Remove for child entities | Glossary Term Add, Update and Remove for child entities |
| 9 | **DashboardDataModel** - UpVote & DownVote entity | UpVote & DownVote entity |
| 10 | **DashboardDataModel** - Follow & Un-follow entity | Follow & Un-follow entity |
| 11 | **DashboardDataModel** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 12 | **DashboardDataModel** - No edit owner permission | No edit owner permission |

### Metric

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Metric** - Update description | Update description |
| 3 | **Metric** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Metric** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Metric** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **Metric** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **Metric** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **Metric** - No edit owner permission | No edit owner permission |

### Directory

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Directory** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Directory** - Update description | Update description |
| 3 | **Directory** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Directory** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Directory** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **Directory** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **Directory** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **Directory** - No edit owner permission | No edit owner permission |

### File

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **File** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **File** - Update description | Update description |
| 3 | **File** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **File** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **File** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **File** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **File** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **File** - No edit owner permission | No edit owner permission |

### Spreadsheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Spreadsheet** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Spreadsheet** - Update description | Update description |
| 3 | **Spreadsheet** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Spreadsheet** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Spreadsheet** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **Spreadsheet** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **Spreadsheet** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **Spreadsheet** - No edit owner permission | No edit owner permission |

### Worksheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Worksheet** - Tier Add, Update and Remove | Tier Add, Update and Remove |
| 2 | **Worksheet** - Update description | Update description |
| 3 | **Worksheet** - Tag Add, Update and Remove | Tag Add, Update and Remove |
| 4 | **Worksheet** - Glossary Term Add, Update and Remove | Glossary Term Add, Update and Remove |
| 5 | **Worksheet** - UpVote & DownVote entity | UpVote & DownVote entity |
| 6 | **Worksheet** - Follow & Un-follow entity | Follow & Un-follow entity |
| 7 | **Worksheet** - User as Owner Add, Update and Remove | User as Owner Add, Update and Remove |
| 8 | **Worksheet** - No edit owner permission | No edit owner permission |

</details>

<details open>
<summary>📄 <b>ServiceEntity.spec.ts</b> (140 tests, 155 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceEntity.spec.ts)

### Api Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Api Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Api Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Api Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Api Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Api Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Api Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Api Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Api Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Api Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Api Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Api Collection

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Api Collection** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Api Collection** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Api Collection** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Api Collection** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Api Collection** - Update description | Tests description updates  Edits the service description |
| 6 | **Api Collection** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Api Collection** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Api Collection** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Api Collection** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Api Collection** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Tests custom property management  Sets and updates supported custom property types on the service |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 11 | **Api Collection** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Database Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Database Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Database Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Database Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Database Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Database Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Database Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Database Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Database Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Database Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Database Service** - Follow & Un-follow entity for Database Entity | Tests follow and unfollow actions  Follows the service and then unfollows it to verify state changes |
| 11 | **Database Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Dashboard Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Dashboard Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Dashboard Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Dashboard Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Dashboard Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Dashboard Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Dashboard Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Dashboard Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Dashboard Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Dashboard Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Messaging Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Messaging Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Messaging Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Messaging Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Messaging Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Messaging Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Messaging Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Messaging Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Messaging Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Messaging Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Messaging Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Mlmodel Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Mlmodel Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Mlmodel Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Mlmodel Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Mlmodel Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Mlmodel Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Mlmodel Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Mlmodel Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Mlmodel Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Mlmodel Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Mlmodel Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Pipeline Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Pipeline Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Pipeline Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Pipeline Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Pipeline Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Pipeline Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Pipeline Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Pipeline Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Pipeline Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Pipeline Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Search Index Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Search Index Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Search Index Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Search Index Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Search Index Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Search Index Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Search Index Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Search Index Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Search Index Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Search Index Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Search Index Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Storage Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Storage Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Storage Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Storage Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Storage Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Storage Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Storage Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Storage Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Storage Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Storage Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Storage Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Database

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Database** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Database** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Database** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Database** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Database** - Certification Add Remove | Tests certification lifecycle  Adds a certification to the service, updates it, and removes it |
| 6 | **Database** - Update description | Tests description updates  Edits the service description |
| 7 | **Database** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 8 | **Database** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 9 | **Database** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 10 | **Database** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 11 | **Database** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Tests custom property management  Sets and updates supported custom property types on the service |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 12 | **Database** - Follow & Un-follow entity for Database Entity | Tests follow and unfollow actions  Follows the service and then unfollows it to verify state changes |
| 13 | **Database** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Database Schema

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Database Schema** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Database Schema** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Database Schema** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Database Schema** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Database Schema** - Certification Add Remove | Tests certification lifecycle  Adds a certification to the service, updates it, and removes it |
| 6 | **Database Schema** - Update description | Tests description updates  Edits the service description |
| 7 | **Database Schema** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 8 | **Database Schema** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 9 | **Database Schema** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 10 | **Database Schema** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 11 | **Database Schema** - Set & Update table-cp, string, integer, markdown, number, duration, email, enum, sqlQuery, timestamp, entityReference, entityReferenceList, timeInterval, time-cp, date-cp, dateTime-cp Custom Property  | Tests custom property management  Sets and updates supported custom property types on the service |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 12 | **Database Schema** - Follow & Un-follow entity for Database Entity | Tests follow and unfollow actions  Follows the service and then unfollows it to verify state changes |
| 13 | **Database Schema** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Drive Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Drive Service** - Domain Add, Update and Remove | Tests domain management on services  Adds a domain, switches to another, then removes it from the service |
| 2 | **Drive Service** - User as Owner Add, Update and Remove | Tests user ownership management  Adds user owners, updates the owner list, and removes owners from the service |
| 3 | **Drive Service** - Team as Owner Add, Update and Remove | Tests team ownership management  Adds team owners, updates the list, and removes teams from the service |
| 4 | **Drive Service** - Tier Add, Update and Remove | Tests tier management  Assigns a tier to the service, updates it, and removes it |
| 5 | **Drive Service** - Update description | Tests description updates  Edits the service description |
| 6 | **Drive Service** - Tag Add, Update and Remove | Tests tag management  Adds tags to the service, updates them, and removes them |
| 7 | **Drive Service** - Glossary Term Add, Update and Remove | Tests glossary term management  Assigns glossary terms to the service, updates them, and removes them |
| 8 | **Drive Service** - Announcement create, edit & delete | Tests announcement lifecycle  Creates, edits, and deletes an announcement on the service |
| 9 | **Drive Service** - Inactive Announcement create & delete | Tests inactive announcements  Creates an inactive announcement and then deletes it |
| 10 | **Drive Service** - Update displayName | Tests display name updates  Renames the service by updating its display name |

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Delete Api Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 2 | Delete Api Collection | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 3 | Delete Database Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 4 | Delete Dashboard Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 5 | Delete Messaging Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 6 | Delete Mlmodel Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 7 | Delete Pipeline Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 8 | Delete Search Index Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 9 | Delete Storage Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 10 | Delete Database | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 11 | Delete Database Schema | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |
| 12 | Delete Drive Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| | ↳ *Soft delete* | |
| | ↳ *Hard delete* | |

</details>

<details open>
<summary>📄 <b>EntityPermissions.spec.ts</b> (40 tests, 40 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/EntityPermissions.spec.ts)

### Table Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table Permissions** - Table allow common operations permissions | Table allow common operations permissions |
| 2 | **Table Permissions** - Table allow entity-specific permission operations | Table allow entity-specific permission operations |
| 3 | **Table Permissions** - Table deny common operations permissions | Table deny common operations permissions |
| 4 | **Table Permissions** - Table deny entity-specific permission operations | Table deny entity-specific permission operations |

### Dashboard Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard Permissions** - Dashboard allow common operations permissions | Dashboard allow common operations permissions |
| 2 | **Dashboard Permissions** - Dashboard allow entity-specific permission operations | Dashboard allow entity-specific permission operations |
| 3 | **Dashboard Permissions** - Dashboard deny common operations permissions | Dashboard deny common operations permissions |
| 4 | **Dashboard Permissions** - Dashboard deny entity-specific permission operations | Dashboard deny entity-specific permission operations |

### Pipeline Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline Permissions** - Pipeline allow common operations permissions | Pipeline allow common operations permissions |
| 2 | **Pipeline Permissions** - Pipeline allow entity-specific permission operations | Pipeline allow entity-specific permission operations |
| 3 | **Pipeline Permissions** - Pipeline deny common operations permissions | Pipeline deny common operations permissions |
| 4 | **Pipeline Permissions** - Pipeline deny entity-specific permission operations | Pipeline deny entity-specific permission operations |

### Topic Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic Permissions** - Topic allow common operations permissions | Topic allow common operations permissions |
| 2 | **Topic Permissions** - Topic allow entity-specific permission operations | Topic allow entity-specific permission operations |
| 3 | **Topic Permissions** - Topic deny common operations permissions | Topic deny common operations permissions |
| 4 | **Topic Permissions** - Topic deny entity-specific permission operations | Topic deny entity-specific permission operations |

### MlModel Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **MlModel Permissions** - MlModel allow common operations permissions | MlModel allow common operations permissions |
| 2 | **MlModel Permissions** - MlModel allow entity-specific permission operations | MlModel allow entity-specific permission operations |
| 3 | **MlModel Permissions** - MlModel deny common operations permissions | MlModel deny common operations permissions |
| 4 | **MlModel Permissions** - MlModel deny entity-specific permission operations | MlModel deny entity-specific permission operations |

### Container Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container Permissions** - Container allow common operations permissions | Container allow common operations permissions |
| 2 | **Container Permissions** - Container deny common operations permissions | Container deny common operations permissions |

### SearchIndex Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SearchIndex Permissions** - SearchIndex allow common operations permissions | SearchIndex allow common operations permissions |
| 2 | **SearchIndex Permissions** - SearchIndex allow entity-specific permission operations | SearchIndex allow entity-specific permission operations |
| 3 | **SearchIndex Permissions** - SearchIndex deny common operations permissions | SearchIndex deny common operations permissions |
| 4 | **SearchIndex Permissions** - SearchIndex deny entity-specific permission operations | SearchIndex deny entity-specific permission operations |

### DashboardDataModel Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **DashboardDataModel Permissions** - DashboardDataModel allow common operations permissions | DashboardDataModel allow common operations permissions |
| 2 | **DashboardDataModel Permissions** - DashboardDataModel allow entity-specific permission operations | DashboardDataModel allow entity-specific permission operations |
| 3 | **DashboardDataModel Permissions** - DashboardDataModel deny common operations permissions | DashboardDataModel deny common operations permissions |
| 4 | **DashboardDataModel Permissions** - DashboardDataModel deny entity-specific permission operations | DashboardDataModel deny entity-specific permission operations |

### Metric Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric Permissions** - Metric allow common operations permissions | Metric allow common operations permissions |
| 2 | **Metric Permissions** - Metric deny common operations permissions | Metric deny common operations permissions |

### Directory Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Directory Permissions** - Directory allow common operations permissions | Directory allow common operations permissions |
| 2 | **Directory Permissions** - Directory deny common operations permissions | Directory deny common operations permissions |

### File Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **File Permissions** - File allow common operations permissions | File allow common operations permissions |
| 2 | **File Permissions** - File deny common operations permissions | File deny common operations permissions |

### Spreadsheet Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Spreadsheet Permissions** - Spreadsheet allow common operations permissions | Spreadsheet allow common operations permissions |
| 2 | **Spreadsheet Permissions** - Spreadsheet deny common operations permissions | Spreadsheet deny common operations permissions |

### Worksheet Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Worksheet Permissions** - Worksheet allow common operations permissions | Worksheet allow common operations permissions |
| 2 | **Worksheet Permissions** - Worksheet deny common operations permissions | Worksheet deny common operations permissions |

</details>

<details open>
<summary>📄 <b>RightEntityPanelFlow.spec.ts</b> (40 tests, 40 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/RightEntityPanelFlow.spec.ts)

### Right Entity Panel - Admin User Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Right Entity Panel - Admin User Flow** - Admin - Overview Tab - Description Section - Add and Update | Admin - Overview Tab - Description Section - Add and Update |
| 2 | **Right Entity Panel - Admin User Flow** - Admin - Overview Tab - Owners Section - Add and Update, Verify Deleted Users Not Visible | Admin - Overview Tab - Owners Section - Add and Update, Verify Deleted Users Not Visible |
| 3 | **Right Entity Panel - Admin User Flow** - Admin - Overview Tab - Owners Section - Add Team Owner and Verify Deleted Teams Not Visible | Admin - Overview Tab - Owners Section - Add Team Owner and Verify Deleted Teams Not Visible |
| 4 | **Right Entity Panel - Admin User Flow** - Admin - Overview Tab - Tags Section - Add Tag and Verify Deleted Tags Not Visible | Admin - Overview Tab - Tags Section - Add Tag and Verify Deleted Tags Not Visible |
| 5 | **Right Entity Panel - Admin User Flow** - Admin - Overview Tab - Glossary Terms Section - Add Term and Verify Deleted Terms Not Visible | Admin - Overview Tab - Glossary Terms Section - Add Term and Verify Deleted Terms Not Visible |
| 6 | **Right Entity Panel - Admin User Flow** - Admin - Overview Tab - Tier Section - Add and Update | Admin - Overview Tab - Tier Section - Add and Update |
| 7 | **Right Entity Panel - Admin User Flow** - Admin - Overview Tab - Domains Section - Add and Update | Admin - Overview Tab - Domains Section - Add and Update |
| 8 | **Right Entity Panel - Admin User Flow** - Admin - Schema Tab - View Schema | Admin - Schema Tab - View Schema |
| 9 | **Right Entity Panel - Admin User Flow** - Lineage Tab - No Lineage | Lineage Tab - No Lineage |
| 10 | **Right Entity Panel - Admin User Flow** - Lineage Tab - With Upstream and Downstream | Lineage Tab - With Upstream and Downstream |
| 11 | **Right Entity Panel - Admin User Flow** - Data Quality Tab - No Test Cases | Data Quality Tab - No Test Cases |
| 12 | **Right Entity Panel - Admin User Flow** - Data Quality Tab - Incidents Empty State | Data Quality Tab - Incidents Empty State |
| 13 | **Right Entity Panel - Admin User Flow** - Data Quality Tab - With Test Cases | Data Quality Tab - With Test Cases |
| 14 | **Right Entity Panel - Admin User Flow** - Data Quality Tab - Incidents Tab | Data Quality Tab - Incidents Tab |
| 15 | **Right Entity Panel - Admin User Flow** - Data Quality Tab - Incidents Tab - Test Case Link Navigation | Data Quality Tab - Incidents Tab - Test Case Link Navigation |
| 16 | **Right Entity Panel - Admin User Flow** - Admin - Custom Properties Tab - View Custom Properties | Admin - Custom Properties Tab - View Custom Properties |
| 17 | **Right Entity Panel - Admin User Flow** - Admin - Custom Properties Tab - Search Functionality | Admin - Custom Properties Tab - Search Functionality |
| 18 | **Right Entity Panel - Admin User Flow** - Admin - Custom Properties Tab - Different Property Types Display | Admin - Custom Properties Tab - Different Property Types Display |
| 19 | **Right Entity Panel - Admin User Flow** - Admin - Custom Properties Tab - Empty State | Admin - Custom Properties Tab - Empty State |

### Right Entity Panel - Data Steward User Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Overview Tab - Description Section - Add and Update | Data Steward - Overview Tab - Description Section - Add and Update |
| 2 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Overview Tab - Owners Section - Add and Update | Data Steward - Overview Tab - Owners Section - Add and Update |
| 3 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Overview Tab - Tier Section - Add and Update | Data Steward - Overview Tab - Tier Section - Add and Update |
| 4 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Overview Tab - Tags Section - Add and Update | Data Steward - Overview Tab - Tags Section - Add and Update |
| 5 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Overview Tab - Glossary Terms Section - Add and Update | Data Steward - Overview Tab - Glossary Terms Section - Add and Update |
| 6 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Overview Tab - Should NOT have permissions for Domains | Data Steward - Overview Tab - Should NOT have permissions for Domains |
| 7 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Schema Tab - View Schema | Data Steward - Schema Tab - View Schema |
| 8 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Lineage Tab - No Lineage | Data Steward - Lineage Tab - No Lineage |
| 9 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Data Quality Tab - No Test Cases | Data Steward - Data Quality Tab - No Test Cases |
| 10 | **Right Entity Panel - Data Steward User Flow** - Data Steward - Custom Properties Tab - View Custom Properties | Data Steward - Custom Properties Tab - View Custom Properties |

### Right Entity Panel - Data Consumer User Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Overview Tab - Description Section - Add and Update | Data Consumer - Overview Tab - Description Section - Add and Update |
| 2 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Overview Tab - Owners Section - View Owners | Data Consumer - Overview Tab - Owners Section - View Owners |
| 3 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Overview Tab - Tier Section - Add and Update | Data Consumer - Overview Tab - Tier Section - Add and Update |
| 4 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Overview Tab - Tags Section - Add and Update | Data Consumer - Overview Tab - Tags Section - Add and Update |
| 5 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Overview Tab - Glossary Terms Section - Add and Update | Data Consumer - Overview Tab - Glossary Terms Section - Add and Update |
| 6 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Overview Tab - Should NOT have permissions for Domains & Data Products | Data Consumer - Overview Tab - Should NOT have permissions for Domains & Data Products |
| 7 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Schema Tab - View Schema | Data Consumer - Schema Tab - View Schema |
| 8 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Lineage Tab - No Lineage | Data Consumer - Lineage Tab - No Lineage |
| 9 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Data Quality Tab - No Test Cases | Data Consumer - Data Quality Tab - No Test Cases |
| 10 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Data Quality Tab - Incidents Empty State | Data Consumer - Data Quality Tab - Incidents Empty State |
| 11 | **Right Entity Panel - Data Consumer User Flow** - Data Consumer - Custom Properties Tab - View Custom Properties | Data Consumer - Custom Properties Tab - View Custom Properties |

</details>

<details open>
<summary>📄 <b>EntitySummaryPanel.spec.ts</b> (16 tests, 16 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntitySummaryPanel.spec.ts)

### Entity Summary Panel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Entity Summary Panel** - should display summary panel for table | Display summary panel for table |
| 2 | **Entity Summary Panel** - should display summary panel for database | Display summary panel for database |
| 3 | **Entity Summary Panel** - should display summary panel for databaseSchema | Display summary panel for databaseSchema |
| 4 | **Entity Summary Panel** - should display summary panel for dashboard | Display summary panel for dashboard |
| 5 | **Entity Summary Panel** - should display summary panel for dashboardDataModel | Display summary panel for dashboardDataModel |
| 6 | **Entity Summary Panel** - should display summary panel for pipeline | Display summary panel for pipeline |
| 7 | **Entity Summary Panel** - should display summary panel for topic | Display summary panel for topic |
| 8 | **Entity Summary Panel** - should display summary panel for mlmodel | Display summary panel for mlmodel |
| 9 | **Entity Summary Panel** - should display summary panel for container | Display summary panel for container |
| 10 | **Entity Summary Panel** - should display summary panel for searchIndex | Display summary panel for searchIndex |
| 11 | **Entity Summary Panel** - should render entity title section with link | Render entity title section with link |
| 12 | **Entity Summary Panel** - should display owners section | Display owners section |
| 13 | **Entity Summary Panel** - should display domain section | Display domain section |
| 14 | **Entity Summary Panel** - should display tags section | Display tags section |
| 15 | **Entity Summary Panel** - should navigate between tabs | Navigate between tabs |
| 16 | **Entity Summary Panel** - should display description section | Display description section |

</details>

<details open>
<summary>📄 <b>ServiceEntityPermissions.spec.ts</b> (16 tests, 16 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts)

### Api Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Api Service Permissions** - Api Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **Api Service Permissions** - Api Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

### Dashboard Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard Service Permissions** - Dashboard Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **Dashboard Service Permissions** - Dashboard Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

### Database Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Database Service Permissions** - Database Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **Database Service Permissions** - Database Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

### Messaging Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Messaging Service Permissions** - Messaging Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **Messaging Service Permissions** - Messaging Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

### Mlmodel Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Mlmodel Service Permissions** - Mlmodel Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **Mlmodel Service Permissions** - Mlmodel Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

### Pipeline Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline Service Permissions** - Pipeline Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **Pipeline Service Permissions** - Pipeline Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

### SearchIndex Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SearchIndex Service Permissions** - SearchIndex Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **SearchIndex Service Permissions** - SearchIndex Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

### Storage Service Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Storage Service Permissions** - Storage Service allow common operations permissions | Tests allow permissions for common service operations  Verifies that a user with allow permissions can perform all common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations |
| 2 | **Storage Service Permissions** - Storage Service deny common operations permissions | Tests deny permissions for common service operations  Verifies that a user with deny permissions cannot perform common operations on the service, including EditDescription, EditOwners, EditTier, EditDisplayName, EditTags, EditGlossaryTerms, EditCustomFields, and Delete operations. UI elements for these actions should be hidden or disabled |

</details>

<details open>
<summary>📄 <b>EntityVersionPages.spec.ts</b> (14 tests, 70 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/EntityVersionPages.spec.ts)

### Entity Version pages

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Entity Version pages** - ApiEndpoint | ApiEndpoint |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 2 | **Entity Version pages** - Table | Table |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 3 | **Entity Version pages** - Store Procedure | Store Procedure |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 4 | **Entity Version pages** - Dashboard | Dashboard |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 5 | **Entity Version pages** - Pipeline | Pipeline |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 6 | **Entity Version pages** - Topic | Topic |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 7 | **Entity Version pages** - MlModel | MlModel |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 8 | **Entity Version pages** - Container | Container |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 9 | **Entity Version pages** - SearchIndex | SearchIndex |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 10 | **Entity Version pages** - DashboardDataModel | DashboardDataModel |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 11 | **Entity Version pages** - Directory | Directory |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 12 | **Entity Version pages** - File | File |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 13 | **Entity Version pages** - Spreadsheet | Spreadsheet |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 14 | **Entity Version pages** - Worksheet | Worksheet |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show column display name changes properly* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |

</details>

<details open>
<summary>📄 <b>ServiceEntityVersionPage.spec.ts</b> (12 tests, 48 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts)

### Service Version pages

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service Version pages** - Api Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 2 | **Service Version pages** - Api Collection | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 3 | **Service Version pages** - Dashboard Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 4 | **Service Version pages** - Database Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 5 | **Service Version pages** - Messaging Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 6 | **Service Version pages** - Mlmodel Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 7 | **Service Version pages** - Pipeline Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 8 | **Service Version pages** - SearchIndex Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 9 | **Service Version pages** - Storage Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 10 | **Service Version pages** - Database | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 11 | **Service Version pages** - Database Schema | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |
| 12 | **Service Version pages** - Drive Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| | ↳ *should show edited tags and description changes* | |
| | ↳ *should show owner changes* | |
| | ↳ *should show tier changes* | |
| | ↳ *should show version details after soft deleted* | |

</details>

<details open>
<summary>📄 <b>RestoreEntityInheritedFields.spec.ts</b> (11 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RestoreEntityInheritedFields.spec.ts)

### ApiEndpoint

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **ApiEndpoint** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### Store Procedure

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Store Procedure** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### MlModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **MlModel** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### SearchIndex

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SearchIndex** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### DashboardDataModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **DashboardDataModel** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

### Chart

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Chart** - Validate restore with Inherited domain and data products assigned | Validate restore with Inherited domain and data products assigned |

</details>

<details open>
<summary>📄 <b>BulkImport.spec.ts</b> (6 tests, 27 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkImport.spec.ts)

### Bulk Import Export

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Bulk Import Export** - Database service | Database service |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *should export data database service details* | |
| | ↳ *should import and edit with two additional database* | |
| 2 | **Bulk Import Export** - Database | Database |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *should export data database details* | |
| | ↳ *should import and edit with two additional database schema* | |
| 3 | **Bulk Import Export** - Database Schema | Database Schema |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *should export data database schema details* | |
| | ↳ *should import and edit with two additional table* | |
| 4 | **Bulk Import Export** - Table | Table |
| | ↳ *should export data table details* | |
| | ↳ *should import and edit with two additional columns* | |
| 5 | **Bulk Import Export** - Keyboard Delete selection | Keyboard Delete selection |
| | ↳ *should export data database schema details* | |
| | ↳ *should import and perform edit operation on entity* | |
| | ↳ *should export data database schema details after edit changes* | |
| | ↳ *Perform Column Select and Delete Operation* | |
| | ↳ *Perform Cell Delete Operation and Save* | |
| | ↳ *should verify the removed value from entity* | |
| 6 | **Bulk Import Export** - Range selection | Range selection |
| | ↳ *should export data database details* | |
| | ↳ *should import and test range selection* | |
| | ↳ *Ctrl+a should select all cells in the grid and deselect all cells by clicking on second cell of .rdg-row* | |
| | ↳ *should select all the cells in the column by clicking on column header* | |
| | ↳ *allow multiple column selection* | |
| | ↳ *allow multiple column selection using keyboard* | |
| | ↳ *allow multiple cell selection using mouse on rightDown and leftUp and extend selection using shift+click* | |
| | ↳ *allow multiple cell selection using keyboard on rightDown and leftUp* | |
| | ↳ *perform single cell copy-paste and undo-redo* | |
| | ↳ *Select range, copy-paste and undo-redo* | |

</details>

<details open>
<summary>📄 <b>BulkEditEntity.spec.ts</b> (5 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/BulkEditEntity.spec.ts)

### Bulk Edit Entity

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Bulk Edit Entity** - Database service | Database service |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *Perform bulk edit action* | |
| 2 | **Bulk Edit Entity** - Database | Database |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *Perform bulk edit action* | |
| 3 | **Bulk Edit Entity** - Database Schema | Database Schema |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *Perform bulk edit action* | |
| 4 | **Bulk Edit Entity** - Table | Table |
| | ↳ *Perform bulk edit action* | |
| 5 | **Bulk Edit Entity** - Glossary | Glossary |
| | ↳ *Perform bulk edit action* | |

</details>

<details open>
<summary>📄 <b>QueryEntity.spec.ts</b> (3 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/QueryEntity.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Query Entity | Query Entity |
| | ↳ *Create a new query entity* | |
| | ↳ *Update owner, description and tag* | |
| | ↳ *Update query and QueryUsedIn* | |
| | ↳ *Verify query filter* | |
| | ↳ *Verify vote for query* | |
| | ↳ *Visit full screen view of query and Delete* | |
| 2 | Verify query duration | Query duration |
| 3 | Verify Query Pagination | Query Pagination |

</details>

<details open>
<summary>📄 <b>EntityRightCollapsablePanel.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/EntityRightCollapsablePanel.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Show and Hide Right Collapsable Panel | Show and Hide Right Collapsable Panel |

</details>


---

<div id="settings"></div>

## Settings

<details open>
<summary>📄 <b>SettingsNavigationPage.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SettingsNavigationPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SettingsNavigationPage.spec.ts)

### Settings Navigation Page Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Settings Navigation Page Tests** - should update navigation sidebar | Update navigation sidebar |
| 2 | **Settings Navigation Page Tests** - should show navigation blocker when leaving with unsaved changes | Show navigation blocker when leaving with unsaved changes |
| 3 | **Settings Navigation Page Tests** - should save changes and navigate when "Save changes" is clicked in blocker | Save changes and navigate when "Save changes" is clicked in blocker |
| 4 | **Settings Navigation Page Tests** - should handle reset functionality and prevent navigation blocker after save | Handle reset functionality and prevent navigation blocker after save |

</details>

<details open>
<summary>📄 <b>SearchSettings.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchSettings.spec.ts)

### Search Settings Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Search Settings Tests** - Update global search settings | Update global search settings |
| 2 | **Search Settings Tests** - Update entity search settings | Update entity search settings |
| 3 | **Search Settings Tests** - Restore default search settings | Restore default search settings |

### Search Preview test

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Search Preview test** - Search preview for searchable table | Search preview for searchable table |

</details>

<details open>
<summary>📄 <b>DataInsightSettings.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataInsightSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataInsightSettings.spec.ts)

### Data Insight settings page should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Insight settings page should work properly** - Edit data insight application | Edit data insight application |
| 2 | **Data Insight settings page should work properly** - Uninstall application | Uninstall application |
| 3 | **Data Insight settings page should work properly** - Install application | Install application |

</details>

<details open>
<summary>📄 <b>LineageSettings.spec.ts</b> (2 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/LineageSettings.spec.ts)

### Lineage Settings Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Lineage Settings Tests** - Verify global lineage config | Global lineage config |
| | ↳ *Lineage config should throw error if upstream depth is less than 0* | |
| | ↳ *Update global lineage config and verify lineage for column layer* | |
| | ↳ *Update global lineage config and verify lineage for entity layer* | |
| | ↳ *Verify Upstream and Downstream expand collapse buttons* | |
| | ↳ *Reset global lineage config and verify lineage* | |
| 2 | **Lineage Settings Tests** - Verify lineage settings for PipelineViewMode as Edge | Lineage settings for PipelineViewMode as Edge |

</details>

<details open>
<summary>📄 <b>CronValidations.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CronValidations.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CronValidations.spec.ts)

### Cron Validations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Cron Validations** - Validate different cron expressions | Validate different cron expressions |

</details>


---

<div id="personas-customizations"></div>

## Personas & Customizations

<details open>
<summary>📄 <b>CustomizeDetailPage.spec.ts</b> (24 tests, 79 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CustomizeDetailPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomizeDetailPage.spec.ts)

### Persona customize UI tab

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Persona customize UI tab** - should show all the customize options | Show all the customize options |
| 2 | **Persona customize UI tab** - should show all the data assets customize options | Show all the data assets customize options |
| 3 | **Persona customize UI tab** - should show all the governance customize options | Show all the governance customize options |
| 4 | **Persona customize UI tab** - Navigation check default state | Navigation check default state |
| 5 | **Persona customize UI tab** - customize navigation should work | Customize navigation should work |
| | ↳ *hide navigation items and validate with persona* | |
| | ↳ *show navigation items and validate with persona* | |

### Persona customization

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Persona customization** - Table - customization should work | Table - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 2 | **Persona customization** - Topic - customization should work | Topic - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 3 | **Persona customization** - Dashboard - customization should work | Dashboard - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 4 | **Persona customization** - Ml Model - customization should work | Ml Model - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 5 | **Persona customization** - Pipeline - customization should work | Pipeline - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 6 | **Persona customization** - Dashboard Data Model - customization should work | Dashboard Data Model - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 7 | **Persona customization** - API Collection - customization should work | API Collection - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 8 | **Persona customization** - Search Index - customization should work | Search Index - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 9 | **Persona customization** - Container - customization should work | Container - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 10 | **Persona customization** - Database - customization should work | Database - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 11 | **Persona customization** - Database Schema - customization should work | Database Schema - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 12 | **Persona customization** - Stored Procedure - customization should work | Stored Procedure - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 13 | **Persona customization** - API Endpoint - customization should work | API Endpoint - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 14 | **Persona customization** - Domain - customization should work | Domain - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 15 | **Persona customization** - Glossary - customization should work | Glossary - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 16 | **Persona customization** - Glossary Term - customization should work | Glossary Term - customization should work |
| | ↳ *pre-requisite* | |
| | ↳ *should show all the tabs & widget as default when no customization is done* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 17 | **Persona customization** - Validate Glossary Term details page after customization of tabs | Validate Glossary Term details page after customization of tabs |
| | ↳ *pre-requisite* | |
| | ↳ *apply customization* | |
| | ↳ *Validate customization* | |
| 18 | **Persona customization** - customize tab label should only render if it's customize by user | Customize tab label should only render if it's customize by user |
| | ↳ *pre-requisite* | |
| | ↳ *apply tab label customization for Table* | |
| | ↳ *validate applied label change and language support for page* | |
| 19 | **Persona customization** - Domain - customize tab label should only render if it's customized by user | Domain - customize tab label should only render if it's customized by user |
| | ↳ *pre-requisite* | |
| | ↳ *apply tab label customization for Domain* | |
| | ↳ *validate applied label change for Domain Documentation tab* | |

</details>

<details open>
<summary>📄 <b>CustomizeWidgets.spec.ts</b> (9 tests, 45 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/CustomizeWidgets.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/CustomizeWidgets.spec.ts)

### Widgets

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Widgets** - Activity Feed | Activity Feed |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget filters* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Test widget customization* | |
| 2 | **Widgets** - Data Assets | Data Assets |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget displays entities and navigation* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Test widget customization* | |
| 3 | **Widgets** - My Data | My Data |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget filters* | |
| | ↳ *Test widget displays entities and navigation* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Test widget customization* | |
| 4 | **Widgets** - KPI | KPI |
| | ↳ *Add KPI* | |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Test widget loads KPI data correctly* | |
| | ↳ *Test widget customization* | |
| 5 | **Widgets** - Total Data Assets | Total Data Assets |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget filters* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Test widget customization* | |
| 6 | **Widgets** - Following Assets | Following Assets |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget filters* | |
| | ↳ *Test widget displays followed entities* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Test widget customization* | |
| 7 | **Widgets** - Domains | Domains |
| | ↳ *Add widget* | |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget filters* | |
| | ↳ *Test widget displays entities and navigation* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Remove widget* | |
| 8 | **Widgets** - My Tasks | My Tasks |
| | ↳ *Create a task* | |
| | ↳ *Add widget* | |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget filters* | |
| | ↳ *Test widget displays entities and navigation* | |
| | ↳ *Remove widget* | |
| 9 | **Widgets** - Data Products | Data Products |
| | ↳ *Add widget* | |
| | ↳ *Test widget header and navigation* | |
| | ↳ *Test widget filters* | |
| | ↳ *Test widget displays entities and navigation* | |
| | ↳ *Test widget footer navigation* | |
| | ↳ *Remove widget* | |

</details>

<details open>
<summary>📄 <b>PersonaFlow.spec.ts</b> (6 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaFlow.spec.ts)

### Persona operations

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Persona operations** - Persona creation should work properly | Persona creation should work properly |
| 2 | **Persona operations** - Persona update description flow should work properly | Persona update description flow should work properly |
| 3 | **Persona operations** - Persona rename flow should work properly | Persona rename flow should work properly |
| 4 | **Persona operations** - Remove users in persona should work properly | Remove users in persona should work properly |
| 5 | **Persona operations** - Delete persona should work properly | Delete persona should work properly |

### Default persona setting and removal flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Default persona setting and removal flow** - Set and remove default persona should work properly | Set and remove default persona should work properly |
| | ↳ *Admin creates a persona and sets the default persona* | |
| | ↳ *User refreshes and checks the default persona is applied* | |
| | ↳ *Changing default persona* | |
| | ↳ *Verify changed default persona for new user* | |
| | ↳ *Admin removes the default persona* | |
| | ↳ *User refreshes and sees no default persona* | |

</details>

<details open>
<summary>📄 <b>CustomizeLandingPage.spec.ts</b> (3 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/CustomizeLandingPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/CustomizeLandingPage.spec.ts)

### Customize Landing Page Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Customize Landing Page Flow** - Check all default widget present | All default widget present |
| 2 | **Customize Landing Page Flow** - Add, Remove and Reset widget should work properly | Add, Remove and Reset widget should work properly |
| | ↳ *Remove widget* | |
| | ↳ *Add widget* | |
| | ↳ *Resetting the layout flow should work properly* | |
| 3 | **Customize Landing Page Flow** - Widget drag and drop reordering | Widget drag and drop reordering |

</details>

<details open>
<summary>📄 <b>CustomThemeConfig.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/CustomThemeConfig.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/CustomThemeConfig.spec.ts)

### Custom Theme Config Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Custom Theme Config Page** - Update and reset custom theme config | Update and reset custom theme config |
| 2 | **Custom Theme Config Page** - Should call customMonogramUrlPath only once after save if the monogram is not valid | Call customMonogramUrlPath only once after save if the monogram is not valid |

</details>


---

<div id="navigation"></div>

## Navigation

<details open>
<summary>📄 <b>Navbar.spec.ts</b> (22 tests, 22 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/Navbar.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Navbar.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Search Term - All | Search Term - All |
| 2 | Search Term - Database | Search Term - Database |
| 3 | Search Term - Database Schema | Search Term - Database Schema |
| 4 | Search Term - Table | Search Term - Table |
| 5 | Search Term - Topic | Search Term - Topic |
| 6 | Search Term - Dashboard | Search Term - Dashboard |
| 7 | Search Term - Pipeline | Search Term - Pipeline |
| 8 | Search Term - ML Model | Search Term - ML Model |
| 9 | Search Term - Container | Search Term - Container |
| 10 | Search Term - Stored Procedure | Search Term - Stored Procedure |
| 11 | Search Term - Data Model | Search Term - Data Model |
| 12 | Search Term - Glossary | Search Term - Glossary |
| 13 | Search Term - Tag | Search Term - Tag |
| 14 | Search Term - Search Index | Search Term - Search Index |
| 15 | Search Term - Data Product | Search Term - Data Product |
| 16 | Search Term - API Endpoint | Search Term - API Endpoint |
| 17 | Search Term - API Collection | Search Term - API Collection |
| 18 | Search Term - Metric | Search Term - Metric |
| 19 | Search Term - Directory | Search Term - Directory |
| 20 | Search Term - File | Search Term - File |
| 21 | Search Term - Spreadsheet | Search Term - Spreadsheet |
| 22 | Search Term - Worksheet | Search Term - Worksheet |

</details>

<details open>
<summary>📄 <b>Pagination.spec.ts</b> (10 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Pagination.spec.ts)

### Pagination tests for all pages

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pagination tests for all pages** - should test pagination on Users page | Pagination on Users page |
| 2 | **Pagination tests for all pages** - should test pagination on Roles page | Pagination on Roles page |
| 3 | **Pagination tests for all pages** - should test pagination on Policies page | Pagination on Policies page |
| 4 | **Pagination tests for all pages** - should test pagination on Database Services page | Pagination on Database Services page |
| 5 | **Pagination tests for all pages** - should test pagination on Bots page | Pagination on Bots page |
| 6 | **Pagination tests for all pages** - should test pagination on Service version page | Pagination on Service version page |

### Pagination tests for Classification Tags page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pagination tests for Classification Tags page** - should test pagination on Classification Tags page | Pagination on Classification Tags page |

### Pagination tests for Metrics page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pagination tests for Metrics page** - should test pagination on Metrics page | Pagination on Metrics page |

### Pagination tests for Notification Alerts page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pagination tests for Notification Alerts page** - should test pagination on Notification Alerts page | Pagination on Notification Alerts page |

### Pagination tests for Observability Alerts page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pagination tests for Observability Alerts page** - should test pagination on Observability Alerts page | Pagination on Observability Alerts page |

</details>

<details open>
<summary>📄 <b>NavigationBlocker.spec.ts</b> (5 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/NavigationBlocker.spec.ts)

### Navigation Blocker Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Navigation Blocker Tests** - should show navigation blocker modal when trying to navigate away with unsaved changes | Show navigation blocker modal when trying to navigate away with unsaved changes |
| 2 | **Navigation Blocker Tests** - should confirm navigation when "Save changes" is clicked | Confirm navigation when "Save changes" is clicked |
| 3 | **Navigation Blocker Tests** - should navigate to new page when "Leave" is clicked | Navigate to new page when "Leave" is clicked |
| 4 | **Navigation Blocker Tests** - should not show navigation blocker after saving changes | Not show navigation blocker after saving changes |
| 5 | **Navigation Blocker Tests** - should stay on current page and keep changes when X button is clicked | Stay on current page and keep changes when X button is clicked |

</details>

<details open>
<summary>📄 <b>GlobalPageSize.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/GlobalPageSize.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/GlobalPageSize.spec.ts)

### Table & Data Model columns table pagination

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table & Data Model columns table pagination** - Page size should persist across different pages | Page size should persist across different pages |

</details>


---

<div id="lineage-ui-"></div>

## Lineage (UI)

<details open>
<summary>📄 <b>Lineage.spec.ts</b> (22 tests, 77 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Lineage.spec.ts)

### Test pagination in column level lineage

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Test pagination in column level lineage** - Verify column visibility across pagination pages | Column visibility across pagination pages |
| | ↳ *Verify T1-P1: C1-C5 visible, C6-C11 hidden* | |
| | ↳ *Verify T2-P1: C1-C5 visible, C6-C12 hidden* | |
| | ↳ *Navigate to T1-P2 and verify visibility* | |
| | ↳ *Navigate to T2-P2 and verify visibility* | |
| | ↳ *Navigate to T1-P3 and verify visibility* | |
| | ↳ *Navigate to T2-P3 and verify visibility* | |
| 2 | **Test pagination in column level lineage** - Verify edges when no column is hovered or selected | Edges when no column is hovered or selected |
| | ↳ *Verify T1-P1 and T2-P1: Only (T1,C1)-(T2,C1), (T1,C2)-(T2,C2), (T1,C3)-(T2,C3) edges visible* | |
| | ↳ *Navigate to T2-P2 and verify (T1,C1)-(T2,C6), (T1,C2)-(T2,C7), (T1,C4)-(T2,C8), (T1,C5)-(T2,C8) edges visible* | |
| | ↳ *Navigate to T1-P2 and verify (T1,C6)-(T2,C6), (T1,C7)-(T2,C7), (T1,C9)-(T2,C8) edges visible* | |
| 3 | **Test pagination in column level lineage** - Verify columns and edges when a column is hovered | Columns and edges when a column is hovered |
| | ↳ *Hover on (T1,C1) and verify highlighted columns and edges* | |
| 4 | **Test pagination in column level lineage** - Verify columns and edges when a column is clicked | Columns and edges when a column is clicked |
| | ↳ *Navigate to T1-P2 and T2-P2, click (T2,C6) and verify highlighted columns and edges* | |
| 5 | **Test pagination in column level lineage** - Verify edges for column level lineage between 2 nodes when filter is toggled | Edges for column level lineage between 2 nodes when filter is toggled |
| | ↳ *1. Load both the table* | |
| | ↳ *2. Verify edges visible and hidden for page1 of both the tables* | |
| | ↳ *3. Enable the filter for table1 by clicking filter button* | |
| | ↳ *4. Verify that only columns with lineage are visible in table1* | |
| | ↳ *5. Enable the filter for table2 by clicking filter button* | |
| | ↳ *6. Verify that only columns with lineage are visible in table2* | |
| | ↳ *7. Verify new edges are now visible.* | |

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Lineage creation from Table entity | Lineage creation from Table entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 2 | Lineage creation from Dashboard entity | Lineage creation from Dashboard entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 3 | Lineage creation from Topic entity | Lineage creation from Topic entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 4 | Lineage creation from MlModel entity | Lineage creation from MlModel entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 5 | Lineage creation from Container entity | Lineage creation from Container entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 6 | Lineage creation from SearchIndex entity | Lineage creation from SearchIndex entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 7 | Lineage creation from ApiEndpoint entity | Lineage creation from ApiEndpoint entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 8 | Lineage creation from Metric entity | Lineage creation from Metric entity |
| | ↳ *Should create lineage for the entity* | |
| | ↳ *Should create pipeline between entities* | |
| | ↳ *Verify Lineage Export CSV* | |
| | ↳ *Verify Lineage Export PNG* | |
| | ↳ *Remove lineage between nodes for the entity* | |
| | ↳ *Verify Lineage Config* | |
| 9 | Verify column lineage between tables | Column lineage between tables |
| 10 | Verify column lineage between table and topic | Column lineage between table and topic |
| 11 | Verify column lineage between topic and api endpoint | Column lineage between topic and api endpoint |
| 12 | Verify column lineage between table and api endpoint | Column lineage between table and api endpoint |
| 13 | Verify function data in edge drawer | Function data in edge drawer |
| 14 | Verify table search with special characters as handled | Table search with special characters as handled |
| 15 | Verify cycle lineage should be handled properly | Cycle lineage should be handled properly |
| 16 | Verify column layer is applied on entering edit mode | Column layer is applied on entering edit mode |
| | ↳ *Verify column layer is inactive initially* | |
| | ↳ *Enter edit mode and verify column layer is active* | |
| 17 | Verify there is no traced nodes and columns on exiting edit mode | There is no traced nodes and columns on exiting edit mode |
| | ↳ *Verify node tracing is cleared on exiting edit mode* | |
| | ↳ *Verify column tracing is cleared on exiting edit mode* | |

</details>

<details open>
<summary>📄 <b>ImpactAnalysis.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ImpactAnalysis.spec.ts)

### Impact Analysis

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Impact Analysis** - validate upstream/ downstream counts | Validate upstream/ downstream counts |
| 2 | **Impact Analysis** - Verify Downstream connections | Downstream connections |
| 3 | **Impact Analysis** - Verify Upstream connections | Upstream connections |
| 4 | **Impact Analysis** - verify owner filter for Asset level impact analysis | Owner filter for Asset level impact analysis |
| 5 | **Impact Analysis** - verify domain for Asset level impact analysis | Domain for Asset level impact analysis |
| 6 | **Impact Analysis** - verify tier for Asset level impact analysis | Tier for Asset level impact analysis |
| 7 | **Impact Analysis** - Verify upstream/downstream counts for column level | Upstream/downstream counts for column level |
| 8 | **Impact Analysis** - Verify column level downstream connections | Column level downstream connections |
| 9 | **Impact Analysis** - Verify column level upstream connections | Column level upstream connections |

</details>

<details open>
<summary>📄 <b>PlatformLineage.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PlatformLineage.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Verify Platform Lineage View | Platform Lineage View |

</details>


---

<div id="users-teams"></div>

## Users & Teams

<details open>
<summary>📄 <b>Users.spec.ts</b> (28 tests, 33 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Users.spec.ts)

### User with Admin Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User with Admin Roles** - Update own admin details | Update own admin details |
| 2 | **User with Admin Roles** - Create and Delete user | Create and Delete user |
| | ↳ *User shouldn't be allowed to create User with same Email* | |
| 3 | **User with Admin Roles** - Admin soft & hard delete and restore user | Admin soft & hard delete and restore user |
| 4 | **User with Admin Roles** - Admin soft & hard delete and restore user from profile page | Admin soft & hard delete and restore user from profile page |

### User with Data Consumer Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User with Data Consumer Roles** - Token generation & revocation for Data Consumer | Token generation & revocation for Data Consumer |
| 2 | **User with Data Consumer Roles** - Update token expiration for Data Consumer | Update token expiration for Data Consumer |
| 3 | **User with Data Consumer Roles** - User should have only view permission for glossary and tags for Data Consumer | User should have only view permission for glossary and tags for Data Consumer |
| 4 | **User with Data Consumer Roles** - Operations for settings page for Data Consumer | Operations for settings page for Data Consumer |
| 5 | **User with Data Consumer Roles** - Permissions for table details page for Data Consumer | Permissions for table details page for Data Consumer |
| 6 | **User with Data Consumer Roles** - Update user details for Data Consumer | Update user details for Data Consumer |
| 7 | **User with Data Consumer Roles** - Reset Password for Data Consumer | Reset Password for Data Consumer |

### User with Data Steward Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User with Data Steward Roles** - Update user details for Data Steward | Update user details for Data Steward |
| 2 | **User with Data Steward Roles** - Token generation & revocation for Data Steward | Token generation & revocation for Data Steward |
| 3 | **User with Data Steward Roles** - Update token expiration for Data Steward | Update token expiration for Data Steward |
| 4 | **User with Data Steward Roles** - Operations for settings page for Data Steward | Operations for settings page for Data Steward |
| 5 | **User with Data Steward Roles** - Check permissions for Data Steward | Permissions for Data Steward |
| 6 | **User with Data Steward Roles** - Reset Password for Data Steward | Reset Password for Data Steward |

### User Profile Feed Interactions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User Profile Feed Interactions** - Should navigate to user profile from feed card avatar click | Navigate to user profile from feed card avatar click |
| 2 | **User Profile Feed Interactions** - Close the profile dropdown after redirecting to user profile page | Close the profile dropdown after redirecting to user profile page |

### User Profile Dropdown Persona Interactions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User Profile Dropdown Persona Interactions** - Should display persona dropdown with pagination | Display persona dropdown with pagination |
| 2 | **User Profile Dropdown Persona Interactions** - Should display default persona tag correctly | Display default persona tag correctly |
| 3 | **User Profile Dropdown Persona Interactions** - Should switch personas correctly | Switch personas correctly |
| 4 | **User Profile Dropdown Persona Interactions** - Should handle persona sorting correctly | Handle persona sorting correctly |
| 5 | **User Profile Dropdown Persona Interactions** - Should revert to default persona after page refresh when non-default is selected | Revert to default persona after page refresh when non-default is selected |
| 6 | **User Profile Dropdown Persona Interactions** - Should handle default persona change and removal correctly | Handle default persona change and removal correctly |

### User Profile Persona Interactions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User Profile Persona Interactions** - Should add, remove, and navigate to persona pages for Personas section | Add, remove, and navigate to persona pages for Personas section |
| | ↳ *Navigate to persona page by clicking on persona chip* | |
| | ↳ *Navigate back to user profile* | |
| | ↳ *Remove personas from user profile* | |
| 2 | **User Profile Persona Interactions** - Should add, remove, and navigate to persona pages for Default Persona section | Add, remove, and navigate to persona pages for Default Persona section |
| | ↳ *Add default persona to user profile* | |
| | ↳ *Navigate to persona page by clicking on default persona chip* | |
| | ↳ *Navigate back to user profile* | |
| | ↳ *Remove default persona from user profile* | |

### Users Performance around application with multiple team inheriting roles and policy

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Users Performance around application with multiple team inheriting roles and policy** - User Performance across different entities pages | User Performance across different entities pages |

</details>

<details open>
<summary>📄 <b>Teams.spec.ts</b> (19 tests, 31 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Teams.spec.ts)

### Teams Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Teams Page** - Teams Page Flow | Teams Page Flow |
| | ↳ *Create a new team* | |
| | ↳ *Add owner to created team* | |
| | ↳ *Update email of created team* | |
| | ↳ *Add user to created team* | |
| | ↳ *Remove added user from created team* | |
| | ↳ *Join team should work properly* | |
| | ↳ *Update display name for created team* | |
| | ↳ *Update description for created team* | |
| | ↳ *Leave team flow should work properly* | |
| | ↳ *Soft Delete Team* | |
| | ↳ *Hard Delete Team* | |
| 2 | **Teams Page** - Create a new public team | Create a new public team |
| 3 | **Teams Page** - Create a new private team and check if its visible to admin in teams selection dropdown on user profile | Create a new private team and check if its visible to admin in teams selection dropdown on user profile |
| 4 | **Teams Page** - Permanently deleting a team without soft deleting should work properly | Permanently deleting a team without soft deleting should work properly |
| 5 | **Teams Page** - Team search should work properly | Team search should work properly |
| 6 | **Teams Page** - Export team | Export team |
| 7 | **Teams Page** - Team assets should | Team assets should |
| 8 | **Teams Page** - Delete a user from the table | Delete a user from the table |
| 9 | **Teams Page** - Verify breadcrumb navigation for a team with a dot in its name | Breadcrumb navigation for a team with a dot in its name |
| 10 | **Teams Page** - Total User Count should be rendered | Total User Count should be rendered |
| 11 | **Teams Page** - Show Deleted toggle should fetch teams with correct include parameter | Show Deleted toggle should fetch teams with correct include parameter |

### Teams Page with EditUser Permission

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Teams Page with EditUser Permission** - Add and Remove User for Team | Add and Remove User for Team |
| | ↳ *Add user in Team from the placeholder* | |
| | ↳ *Add user in Team for the header manage area* | |
| | ↳ *Remove user from Team* | |

### Teams Page with Data Consumer User

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Teams Page with Data Consumer User** - Should not have edit access on team page with no data available | Not have edit access on team page with no data available |
| 2 | **Teams Page with Data Consumer User** - Should not have edit access on team page with data available | Not have edit access on team page with data available |

### Teams Page action as Owner of Team

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Teams Page action as Owner of Team** - User as not owner should not have edit/create permission on Team | User as not owner should not have edit/create permission on Team |
| 2 | **Teams Page action as Owner of Team** - Add New Team in BusinessUnit Team | Add New Team in BusinessUnit Team |
| 3 | **Teams Page action as Owner of Team** - Add New Team in Department Team | Add New Team in Department Team |
| 4 | **Teams Page action as Owner of Team** - Add New Team in Division Team | Add New Team in Division Team |
| 5 | **Teams Page action as Owner of Team** - Add New User in Group Team | Add New User in Group Team |

</details>

<details open>
<summary>📄 <b>TeamsDragAndDrop.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsDragAndDrop.spec.ts)

### Teams drag and drop should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Teams drag and drop should work properly** - Add teams in hierarchy | Add teams in hierarchy |
| 2 | **Teams drag and drop should work properly** - Should fail when drop team type is Group | Fail when drop team type is Group |
| 3 | **Teams drag and drop should work properly** - Should fail when droppable team type is Department | Fail when droppable team type is Department |
| 4 | **Teams drag and drop should work properly** - Should fail when draggable team type is BusinessUnit and droppable team type is Division | Fail when draggable team type is BusinessUnit and droppable team type is Division |
| 5 | **Teams drag and drop should work properly** - Should drag and drop on BusinessUnit team type | Drag and drop on BusinessUnit team type |
| 6 | **Teams drag and drop should work properly** - Should drag and drop on Division team type | Drag and drop on Division team type |
| 7 | **Teams drag and drop should work properly** - Should drag and drop on Department team type | Drag and drop on Department team type |
| 8 | **Teams drag and drop should work properly** - Should drag and drop team on table level | Drag and drop team on table level |
| 9 | **Teams drag and drop should work properly** - Delete Teams | Delete Teams |

</details>

<details open>
<summary>📄 <b>UserDetails.spec.ts</b> (8 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/UserDetails.spec.ts)

### User with different Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User with different Roles** - Admin user can get all the teams hierarchy and edit teams | Admin user can get all the teams hierarchy and edit teams |
| 2 | **User with different Roles** - Create team with domain and verify visibility of inherited domain in user profile after team removal | Create team with domain and verify visibility of inherited domain in user profile after team removal |
| 3 | **User with different Roles** - User can search for a domain | User can search for a domain |
| 4 | **User with different Roles** - Admin user can assign and remove domain from a user | Admin user can assign and remove domain from a user |
| 5 | **User with different Roles** - Subdomain is visible when expanding parent domain in tree | Subdomain is visible when expanding parent domain in tree |
| 6 | **User with different Roles** - Admin user can get all the roles hierarchy and edit roles | Admin user can get all the roles hierarchy and edit roles |
| 7 | **User with different Roles** - Non admin user should be able to edit display name and description on own profile | Non admin user should be able to edit display name and description on own profile |
| 8 | **User with different Roles** - Non admin user should not be able to edit the persona or roles | Non admin user should not be able to edit the persona or roles |

</details>

<details open>
<summary>📄 <b>OnlineUsers.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/OnlineUsers.spec.ts)

### Online Users Feature

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Online Users Feature** - Should show online users under Settings > Members > Online Users for admins | Show online users under Settings > Members > Online Users for admins |
| 2 | **Online Users Feature** - Should update user activity time when user navigates | Update user activity time when user navigates |
| 3 | **Online Users Feature** - Should not show bots in online users list | Not show bots in online users list |
| 4 | **Online Users Feature** - Should filter users by time window | Filter users by time window |
| 5 | **Online Users Feature** - Non-admin users should not see Online Users page | Non-admin users should not see Online Users page |
| 6 | **Online Users Feature** - Should show correct last activity format | Show correct last activity format |

</details>

<details open>
<summary>📄 <b>UserProfileOnlineStatus.spec.ts</b> (5 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/UserProfileOnlineStatus.spec.ts)

### User Profile Online Status

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User Profile Online Status** - Should show online status badge on user profile for active users | Show online status badge on user profile for active users |
| 2 | **User Profile Online Status** - Should show "Active recently" for users active within last hour | Show "Active recently" for users active within last hour |
| 3 | **User Profile Online Status** - Should not show online status for inactive users | Not show online status for inactive users |
| 4 | **User Profile Online Status** - Should show online status below email in user profile card | Show online status below email in user profile card |
| 5 | **User Profile Online Status** - Should update online status in real-time when user becomes active | Update online status in real-time when user becomes active |

</details>

<details open>
<summary>📄 <b>TeamsHierarchy.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TeamsHierarchy.spec.ts)

### Add Nested Teams and Test TeamsSelectable

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Add Nested Teams and Test TeamsSelectable** - Add teams in hierarchy | Add teams in hierarchy |
| 2 | **Add Nested Teams and Test TeamsSelectable** - Check hierarchy in Add User page | Hierarchy in Add User page |
| 3 | **Add Nested Teams and Test TeamsSelectable** - Delete Parent Team | Delete Parent Team |

</details>

<details open>
<summary>📄 <b>PersonaDeletionUserProfile.spec.ts</b> (1 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/PersonaDeletionUserProfile.spec.ts)

### User profile works after persona deletion

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **User profile works after persona deletion** - User profile loads correctly before and after persona deletion | User profile loads correctly before and after persona deletion |
| | ↳ *Create persona with user* | |
| | ↳ *Verify persona appears on user profile* | |
| | ↳ *Delete the persona* | |
| | ↳ *Verify user profile still loads after persona deletion* | |

</details>

<details open>
<summary>📄 <b>UsersPagination.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/UsersPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/UsersPagination.spec.ts)

### Soft Delete User Pagination

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Soft Delete User Pagination** - Testing user API calls and pagination | Testing user API calls and pagination |

</details>


---

<div id="sso"></div>

## SSO

<details open>
<summary>📄 <b>SSOConfiguration.spec.ts</b> (10 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SSOConfiguration.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SSOConfiguration.spec.ts)

### SSO Configuration Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SSO Configuration Tests** - should display all available SSO providers | Display all available SSO providers |
| 2 | **SSO Configuration Tests** - should enable Configure button when provider is selected | Enable Configure button when provider is selected |
| 3 | **SSO Configuration Tests** - should show correct fields for Google provider with confidential client | Show correct fields for Google provider with confidential client |
| 4 | **SSO Configuration Tests** - should show correct fields for Auth0 provider with confidential client | Show correct fields for Auth0 provider with confidential client |
| 5 | **SSO Configuration Tests** - should show correct fields for Okta provider with confidential client | Show correct fields for Okta provider with confidential client |
| 6 | **SSO Configuration Tests** - should show correct fields when selecting SAML provider | Show correct fields when selecting SAML provider |
| 7 | **SSO Configuration Tests** - should show correct fields when selecting LDAP provider | Show correct fields when selecting LDAP provider |
| 8 | **SSO Configuration Tests** - should show correct fields when selecting Google provider | Show correct fields when selecting Google provider |
| 9 | **SSO Configuration Tests** - should show correct fields when selecting Auth0 provider | Show correct fields when selecting Auth0 provider |
| 10 | **SSO Configuration Tests** - should show correct fields when selecting Okta provider | Show correct fields when selecting Okta provider |

</details>


---

<div id="rbac"></div>

## RBAC

<details open>
<summary>📄 <b>SearchRBAC.spec.ts</b> (11 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/SearchRBAC.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SearchRBAC.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Search RBAC for ApiEndpoint | Search RBAC for ApiEndpoint |
| 2 | Search RBAC for Table | Search RBAC for Table |
| 3 | Search RBAC for Store Procedure | Search RBAC for Store Procedure |
| 4 | Search RBAC for Dashboard | Search RBAC for Dashboard |
| 5 | Search RBAC for Pipeline | Search RBAC for Pipeline |
| 6 | Search RBAC for Topic | Search RBAC for Topic |
| 7 | Search RBAC for MlModel | Search RBAC for MlModel |
| 8 | Search RBAC for Container | Search RBAC for Container |
| 9 | Search RBAC for SearchIndex | Search RBAC for SearchIndex |
| 10 | Search RBAC for DashboardDataModel | Search RBAC for DashboardDataModel |
| 11 | Search RBAC for Metric | Search RBAC for Metric |

</details>

<details open>
<summary>📄 <b>AddRoleAndAssignToUser.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AddRoleAndAssignToUser.spec.ts)

### Add role and assign it to the user

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Add role and assign it to the user** - Create role | Create role |
| 2 | **Add role and assign it to the user** - Create new user and assign new role to him | Create new user and assign new role to him |
| 3 | **Add role and assign it to the user** - Verify assigned role to new user | Assigned role to new user |

</details>

<details open>
<summary>📄 <b>Policies.spec.ts</b> (3 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Policies.spec.ts)

### Policy page should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Policy page should work properly** - Add new policy with invalid condition | Add new policy with invalid condition |
| | ↳ *Default Policies and Roles should be displayed* | |
| | ↳ *Add new policy* | |
| | ↳ *Edit policy description* | |
| | ↳ *Edit policy display name* | |
| | ↳ *Add new rule* | |
| | ↳ *Edit rule name for created Rule* | |
| | ↳ *Delete new rule* | |
| | ↳ *Delete last rule and validate* | |
| | ↳ *Delete created policy* | |
| 2 | **Policy page should work properly** - Policy should have associated rules and teams | Policy should have associated rules and teams |
| 3 | **Policy page should work properly** - Delete policy action from manage button options | Delete policy action from manage button options |

</details>

<details open>
<summary>📄 <b>Roles.spec.ts</b> (2 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Roles.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Roles.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Roles page should work properly | Roles page should work properly |
| | ↳ *Add new role and check all tabs data* | |
| | ↳ *Add new role without selecting data* | |
| | ↳ *Edit created role* | |
| | ↳ *Edit role display name* | |
| | ↳ *Add new policy to created role* | |
| | ↳ *Remove added policy from created role* | |
| | ↳ *Check if last policy is not removed* | |
| | ↳ *Delete created Role* | |
| 2 | Delete role action from manage button options | Delete role action from manage button options |

</details>


---

<div id="onboarding"></div>

## Onboarding

<details open>
<summary>📄 <b>Tour.spec.ts</b> (3 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/Tour.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Tour.spec.ts)

### Tour should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tour should work properly** - Tour should work from help section | Tour should work from help section |
| 2 | **Tour should work properly** - Tour should work from welcome screen | Tour should work from welcome screen |
| 3 | **Tour should work properly** - Tour should work from URL directly | Tour should work from URL directly |

</details>


---

<div id="app-marketplace"></div>

## App Marketplace

<details open>
<summary>📄 <b>DataInsightReportApplication.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataInsightReportApplication.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataInsightReportApplication.spec.ts)

### Data Insight Report Application

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Insight Report Application** - Install application | Install application |
| 2 | **Data Insight Report Application** - Edit application | Edit application |
| 3 | **Data Insight Report Application** - Run application | Run application |
| 4 | **Data Insight Report Application** - Uninstall application | Uninstall application |

</details>

<details open>
<summary>📄 <b>SearchIndexApplication.spec.ts</b> (1 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/SearchIndexApplication.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SearchIndexApplication.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Search Index Application | Search Index Application |
| | ↳ *Visit Application page* | |
| | ↳ *Verify last execution run* | |
| | ↳ *View App Run Config* | |
| | ↳ *Edit application* | |
| | ↳ *Uninstall application* | |
| | ↳ *Install application* | |
| | ↳ *Run application* | |

</details>


---

<div id="authentication"></div>

## Authentication

<details open>
<summary>📄 <b>Login.spec.ts</b> (5 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Login.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Login.spec.ts)

### Login flow should work properly

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Login flow should work properly** - Signup and Login with signed up credentials | Signup and Login with signed up credentials |
| 2 | **Login flow should work properly** - Signin using invalid credentials | Signin using invalid credentials |
| 3 | **Login flow should work properly** - Forgot password and login with new password | Forgot password and login with new password |
| 4 | **Login flow should work properly** - Refresh should work | Refresh should work |
| | ↳ *Login and wait for refresh call is made* | |
| 5 | **Login flow should work properly** - accessing app with expired token should do auto renew token | Accessing app with expired token should do auto renew token |

</details>

<details open>
<summary>📄 <b>LoginConfiguration.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/LoginConfiguration.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/LoginConfiguration.spec.ts)

### Login configuration

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Login configuration** - update login configuration should work | Update login configuration should work |
| 2 | **Login configuration** - reset login configuration should work | Reset login configuration should work |

</details>


---

