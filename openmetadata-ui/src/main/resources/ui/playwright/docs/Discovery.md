[🏠 Home](./README.md) > **Discovery**

# Discovery

> **7 Components** | **28 Files** | **697 Tests** | **827 Scenarios** 🚀

## Table of Contents
- [Feed](#feed)
- [Search](#search)
- [Data Assets](#data-assets)
- [Curated Assets](#curated-assets)
- [Explore](#explore)
- [Home Page](#home-page)
- [Data Insights](#data-insights)

---

<div id="feed"></div>

## Feed

<details open>
<summary>📄 <b>ActivityFeed.spec.ts</b> (11 tests, 14 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ActivityFeed.spec.ts)

### FeedWidget on landing page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **FeedWidget on landing page** - renders widget wrapper and header with sort dropdown | Renders widget wrapper and header with sort dropdown |
| 2 | **FeedWidget on landing page** - clicking title navigates to explore page | Clicking title navigates to explore page |
| 3 | **FeedWidget on landing page** - feed body renders content or empty state | Feed body renders content or empty state |
| 4 | **FeedWidget on landing page** - changing filter triggers feed reload | Changing filter triggers feed reload |
| 5 | **FeedWidget on landing page** - footer shows view more link when applicable | Footer shows view more link when applicable |
| 6 | **FeedWidget on landing page** - feed cards render with proper structure when available | Feed cards render with proper structure when available |
| 7 | **FeedWidget on landing page** - emoji reactions can be added when feed messages exist | Emoji reactions can be added when feed messages exist |
| 8 | **FeedWidget on landing page** - thread drawer opens from reply count and allows posting a reply | Thread drawer opens from reply count and allows posting a reply |

### Mention notifications in Notification Box

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Mention notifications in Notification Box** - Mention notification shows correct user details in Notification box | Mention notification shows correct user details in Notification box |
| | ↳ *Admin user creates a conversation on an entity* | |
| | ↳ *User1 mentions admin user in a reply* | |
| | ↳ *Admin user checks notification for correct user and timestamp* | |
| | ↳ *Update user display name and verify reaction tooltip* | |

### Mentions: Chinese character encoding in activity feed

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Mentions: Chinese character encoding in activity feed** - Should allow mentioning a user with Chinese characters in the activity feed | Allow mentioning a user with Chinese characters in the activity feed |
| 2 | **Mentions: Chinese character encoding in activity feed** - Should encode the chinese character while mentioning api endpoint | Encode the chinese character while mentioning api endpoint |

</details>


---

<div id="search"></div>

## Search

<details open>
<summary>📄 <b>AdvancedSearch.spec.ts</b> (111 tests, 111 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearch.spec.ts)

### Advanced Search

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Advanced Search** - Verify All conditions for Owners field | All conditions for Owners field |
| 2 | **Advanced Search** - Verify All conditions for Tags field | All conditions for Tags field |
| 3 | **Advanced Search** - Verify All conditions for Tier field | All conditions for Tier field |
| 4 | **Advanced Search** - Verify All conditions for Service field | All conditions for Service field |
| 5 | **Advanced Search** - Verify All conditions for Database field | All conditions for Database field |
| 6 | **Advanced Search** - Verify All conditions for Database Schema field | All conditions for Database Schema field |
| 7 | **Advanced Search** - Verify All conditions for Column field | All conditions for Column field |
| 8 | **Advanced Search** - Verify All conditions for Display Name field | All conditions for Display Name field |
| 9 | **Advanced Search** - Verify All conditions for Service Type field | All conditions for Service Type field |
| 10 | **Advanced Search** - Verify All conditions for Schema Field field | All conditions for Schema Field field |
| 11 | **Advanced Search** - Verify All conditions for Container Column field | All conditions for Container Column field |
| 12 | **Advanced Search** - Verify All conditions for Data Model Type field | All conditions for Data Model Type field |
| 13 | **Advanced Search** - Verify All conditions for Field field | All conditions for Field field |
| 14 | **Advanced Search** - Verify All conditions for Task field | All conditions for Task field |
| 15 | **Advanced Search** - Verify All conditions for Domains field | All conditions for Domains field |
| 16 | **Advanced Search** - Verify All conditions for Name field | All conditions for Name field |
| 17 | **Advanced Search** - Verify All conditions for Project field | All conditions for Project field |
| 18 | **Advanced Search** - Verify All conditions for Status field | All conditions for Status field |
| 19 | **Advanced Search** - Verify All conditions for Chart field | All conditions for Chart field |
| 20 | **Advanced Search** - Verify All conditions for Response Schema Field field | All conditions for Response Schema Field field |
| 21 | **Advanced Search** - Verify All conditions for Request Schema Field field | All conditions for Request Schema Field field |
| 22 | **Advanced Search** - Verify All conditions for Data Product field | All conditions for Data Product field |
| 23 | **Advanced Search** - Verify Rule functionality for field Owners with AND operator | Rule functionality for field Owners with AND operator |
| 24 | **Advanced Search** - Verify Group functionality for field Owners with AND operator | Group functionality for field Owners with AND operator |
| 25 | **Advanced Search** - Verify Rule functionality for field Tags with AND operator | Rule functionality for field Tags with AND operator |
| 26 | **Advanced Search** - Verify Group functionality for field Tags with AND operator | Group functionality for field Tags with AND operator |
| 27 | **Advanced Search** - Verify Rule functionality for field Tier with AND operator | Rule functionality for field Tier with AND operator |
| 28 | **Advanced Search** - Verify Group functionality for field Tier with AND operator | Group functionality for field Tier with AND operator |
| 29 | **Advanced Search** - Verify Rule functionality for field Service with AND operator | Rule functionality for field Service with AND operator |
| 30 | **Advanced Search** - Verify Group functionality for field Service with AND operator | Group functionality for field Service with AND operator |
| 31 | **Advanced Search** - Verify Rule functionality for field Database with AND operator | Rule functionality for field Database with AND operator |
| 32 | **Advanced Search** - Verify Group functionality for field Database with AND operator | Group functionality for field Database with AND operator |
| 33 | **Advanced Search** - Verify Rule functionality for field Database Schema with AND operator | Rule functionality for field Database Schema with AND operator |
| 34 | **Advanced Search** - Verify Group functionality for field Database Schema with AND operator | Group functionality for field Database Schema with AND operator |
| 35 | **Advanced Search** - Verify Rule functionality for field Column with AND operator | Rule functionality for field Column with AND operator |
| 36 | **Advanced Search** - Verify Group functionality for field Column with AND operator | Group functionality for field Column with AND operator |
| 37 | **Advanced Search** - Verify Rule functionality for field Display Name with AND operator | Rule functionality for field Display Name with AND operator |
| 38 | **Advanced Search** - Verify Group functionality for field Display Name with AND operator | Group functionality for field Display Name with AND operator |
| 39 | **Advanced Search** - Verify Rule functionality for field Service Type with AND operator | Rule functionality for field Service Type with AND operator |
| 40 | **Advanced Search** - Verify Group functionality for field Service Type with AND operator | Group functionality for field Service Type with AND operator |
| 41 | **Advanced Search** - Verify Rule functionality for field Schema Field with AND operator | Rule functionality for field Schema Field with AND operator |
| 42 | **Advanced Search** - Verify Group functionality for field Schema Field with AND operator | Group functionality for field Schema Field with AND operator |
| 43 | **Advanced Search** - Verify Rule functionality for field Container Column with AND operator | Rule functionality for field Container Column with AND operator |
| 44 | **Advanced Search** - Verify Group functionality for field Container Column with AND operator | Group functionality for field Container Column with AND operator |
| 45 | **Advanced Search** - Verify Rule functionality for field Data Model Type with AND operator | Rule functionality for field Data Model Type with AND operator |
| 46 | **Advanced Search** - Verify Group functionality for field Data Model Type with AND operator | Group functionality for field Data Model Type with AND operator |
| 47 | **Advanced Search** - Verify Rule functionality for field Field with AND operator | Rule functionality for field Field with AND operator |
| 48 | **Advanced Search** - Verify Group functionality for field Field with AND operator | Group functionality for field Field with AND operator |
| 49 | **Advanced Search** - Verify Rule functionality for field Task with AND operator | Rule functionality for field Task with AND operator |
| 50 | **Advanced Search** - Verify Group functionality for field Task with AND operator | Group functionality for field Task with AND operator |
| 51 | **Advanced Search** - Verify Rule functionality for field Domains with AND operator | Rule functionality for field Domains with AND operator |
| 52 | **Advanced Search** - Verify Group functionality for field Domains with AND operator | Group functionality for field Domains with AND operator |
| 53 | **Advanced Search** - Verify Rule functionality for field Name with AND operator | Rule functionality for field Name with AND operator |
| 54 | **Advanced Search** - Verify Group functionality for field Name with AND operator | Group functionality for field Name with AND operator |
| 55 | **Advanced Search** - Verify Rule functionality for field Project with AND operator | Rule functionality for field Project with AND operator |
| 56 | **Advanced Search** - Verify Group functionality for field Project with AND operator | Group functionality for field Project with AND operator |
| 57 | **Advanced Search** - Verify Rule functionality for field Status with AND operator | Rule functionality for field Status with AND operator |
| 58 | **Advanced Search** - Verify Group functionality for field Status with AND operator | Group functionality for field Status with AND operator |
| 59 | **Advanced Search** - Verify Rule functionality for field Chart with AND operator | Rule functionality for field Chart with AND operator |
| 60 | **Advanced Search** - Verify Group functionality for field Chart with AND operator | Group functionality for field Chart with AND operator |
| 61 | **Advanced Search** - Verify Rule functionality for field Response Schema Field with AND operator | Rule functionality for field Response Schema Field with AND operator |
| 62 | **Advanced Search** - Verify Group functionality for field Response Schema Field with AND operator | Group functionality for field Response Schema Field with AND operator |
| 63 | **Advanced Search** - Verify Rule functionality for field Request Schema Field with AND operator | Rule functionality for field Request Schema Field with AND operator |
| 64 | **Advanced Search** - Verify Group functionality for field Request Schema Field with AND operator | Group functionality for field Request Schema Field with AND operator |
| 65 | **Advanced Search** - Verify Rule functionality for field Data Product with AND operator | Rule functionality for field Data Product with AND operator |
| 66 | **Advanced Search** - Verify Group functionality for field Data Product with AND operator | Group functionality for field Data Product with AND operator |
| 67 | **Advanced Search** - Verify Rule functionality for field Owners with OR operator | Rule functionality for field Owners with OR operator |
| 68 | **Advanced Search** - Verify Group functionality for field Owners with OR operator | Group functionality for field Owners with OR operator |
| 69 | **Advanced Search** - Verify Rule functionality for field Tags with OR operator | Rule functionality for field Tags with OR operator |
| 70 | **Advanced Search** - Verify Group functionality for field Tags with OR operator | Group functionality for field Tags with OR operator |
| 71 | **Advanced Search** - Verify Rule functionality for field Tier with OR operator | Rule functionality for field Tier with OR operator |
| 72 | **Advanced Search** - Verify Group functionality for field Tier with OR operator | Group functionality for field Tier with OR operator |
| 73 | **Advanced Search** - Verify Rule functionality for field Service with OR operator | Rule functionality for field Service with OR operator |
| 74 | **Advanced Search** - Verify Group functionality for field Service with OR operator | Group functionality for field Service with OR operator |
| 75 | **Advanced Search** - Verify Rule functionality for field Database with OR operator | Rule functionality for field Database with OR operator |
| 76 | **Advanced Search** - Verify Group functionality for field Database with OR operator | Group functionality for field Database with OR operator |
| 77 | **Advanced Search** - Verify Rule functionality for field Database Schema with OR operator | Rule functionality for field Database Schema with OR operator |
| 78 | **Advanced Search** - Verify Group functionality for field Database Schema with OR operator | Group functionality for field Database Schema with OR operator |
| 79 | **Advanced Search** - Verify Rule functionality for field Column with OR operator | Rule functionality for field Column with OR operator |
| 80 | **Advanced Search** - Verify Group functionality for field Column with OR operator | Group functionality for field Column with OR operator |
| 81 | **Advanced Search** - Verify Rule functionality for field Display Name with OR operator | Rule functionality for field Display Name with OR operator |
| 82 | **Advanced Search** - Verify Group functionality for field Display Name with OR operator | Group functionality for field Display Name with OR operator |
| 83 | **Advanced Search** - Verify Rule functionality for field Service Type with OR operator | Rule functionality for field Service Type with OR operator |
| 84 | **Advanced Search** - Verify Group functionality for field Service Type with OR operator | Group functionality for field Service Type with OR operator |
| 85 | **Advanced Search** - Verify Rule functionality for field Schema Field with OR operator | Rule functionality for field Schema Field with OR operator |
| 86 | **Advanced Search** - Verify Group functionality for field Schema Field with OR operator | Group functionality for field Schema Field with OR operator |
| 87 | **Advanced Search** - Verify Rule functionality for field Container Column with OR operator | Rule functionality for field Container Column with OR operator |
| 88 | **Advanced Search** - Verify Group functionality for field Container Column with OR operator | Group functionality for field Container Column with OR operator |
| 89 | **Advanced Search** - Verify Rule functionality for field Data Model Type with OR operator | Rule functionality for field Data Model Type with OR operator |
| 90 | **Advanced Search** - Verify Group functionality for field Data Model Type with OR operator | Group functionality for field Data Model Type with OR operator |
| 91 | **Advanced Search** - Verify Rule functionality for field Field with OR operator | Rule functionality for field Field with OR operator |
| 92 | **Advanced Search** - Verify Group functionality for field Field with OR operator | Group functionality for field Field with OR operator |
| 93 | **Advanced Search** - Verify Rule functionality for field Task with OR operator | Rule functionality for field Task with OR operator |
| 94 | **Advanced Search** - Verify Group functionality for field Task with OR operator | Group functionality for field Task with OR operator |
| 95 | **Advanced Search** - Verify Rule functionality for field Domains with OR operator | Rule functionality for field Domains with OR operator |
| 96 | **Advanced Search** - Verify Group functionality for field Domains with OR operator | Group functionality for field Domains with OR operator |
| 97 | **Advanced Search** - Verify Rule functionality for field Name with OR operator | Rule functionality for field Name with OR operator |
| 98 | **Advanced Search** - Verify Group functionality for field Name with OR operator | Group functionality for field Name with OR operator |
| 99 | **Advanced Search** - Verify Rule functionality for field Project with OR operator | Rule functionality for field Project with OR operator |
| 100 | **Advanced Search** - Verify Group functionality for field Project with OR operator | Group functionality for field Project with OR operator |
| 101 | **Advanced Search** - Verify Rule functionality for field Status with OR operator | Rule functionality for field Status with OR operator |
| 102 | **Advanced Search** - Verify Group functionality for field Status with OR operator | Group functionality for field Status with OR operator |
| 103 | **Advanced Search** - Verify Rule functionality for field Chart with OR operator | Rule functionality for field Chart with OR operator |
| 104 | **Advanced Search** - Verify Group functionality for field Chart with OR operator | Group functionality for field Chart with OR operator |
| 105 | **Advanced Search** - Verify Rule functionality for field Response Schema Field with OR operator | Rule functionality for field Response Schema Field with OR operator |
| 106 | **Advanced Search** - Verify Group functionality for field Response Schema Field with OR operator | Group functionality for field Response Schema Field with OR operator |
| 107 | **Advanced Search** - Verify Rule functionality for field Request Schema Field with OR operator | Rule functionality for field Request Schema Field with OR operator |
| 108 | **Advanced Search** - Verify Group functionality for field Request Schema Field with OR operator | Group functionality for field Request Schema Field with OR operator |
| 109 | **Advanced Search** - Verify Rule functionality for field Data Product with OR operator | Rule functionality for field Data Product with OR operator |
| 110 | **Advanced Search** - Verify Group functionality for field Data Product with OR operator | Group functionality for field Data Product with OR operator |
| 111 | **Advanced Search** - Verify search with non existing value do not result in infinite search | Search with non existing value do not result in infinite search |

</details>

<details open>
<summary>📄 <b>AdvancedSearchSuggestions.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts)

### Advanced Search Suggestions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Advanced Search Suggestions** - Verify suggestions for Database field | Suggestions for Database field |
| 2 | **Advanced Search Suggestions** - Verify suggestions for Database Schema field | Suggestions for Database Schema field |
| 3 | **Advanced Search Suggestions** - Verify suggestions for API Collection field | Suggestions for API Collection field |
| 4 | **Advanced Search Suggestions** - Verify suggestions for Glossary field | Suggestions for Glossary field |
| 5 | **Advanced Search Suggestions** - Verify suggestions for Domains field | Suggestions for Domains field |
| 6 | **Advanced Search Suggestions** - Verify suggestions for Data Product field | Suggestions for Data Product field |
| 7 | **Advanced Search Suggestions** - Verify suggestions for Tags field | Suggestions for Tags field |
| 8 | **Advanced Search Suggestions** - Verify suggestions for Certification field | Suggestions for Certification field |
| 9 | **Advanced Search Suggestions** - Verify suggestions for Tier field | Suggestions for Tier field |

</details>

<details open>
<summary>📄 <b>TableSearch.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSearch.spec.ts)

### Table Search

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table Search** - Services page should have search functionality | Services page should have search functionality |
| 2 | **Table Search** - API Collection page should have search functionality | API Collection page should have search functionality |
| 3 | **Table Search** - Database Schema Tables tab should have search functionality | Database Schema Tables tab should have search functionality |
| 4 | **Table Search** - Data Models Table should have search functionality | Data Models Table should have search functionality |
| 5 | **Table Search** - Stored Procedure Table should have search functionality | Stored Procedure Table should have search functionality |
| 6 | **Table Search** - Topics Table should have search functionality | Topics Table should have search functionality |
| 7 | **Table Search** - Drives Service Directories Table should have search functionality | Drives Service Directories Table should have search functionality |
| 8 | **Table Search** - Drives Service Files Table should have search functionality | Drives Service Files Table should have search functionality |
| 9 | **Table Search** - Drives Service Spreadsheets Table should have search functionality | Drives Service Spreadsheets Table should have search functionality |

</details>

<details open>
<summary>📄 <b>SchemaSearch.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SchemaSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaSearch.spec.ts)

### Schema search

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Schema search** - Search schema in database page | Search schema in database page |

</details>

<details open>
<summary>📄 <b>GlobalSearch.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/GlobalSearch.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/GlobalSearch.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | searching for longer description should work | Searching for longer description should work |

</details>


---

<div id="data-assets"></div>

## Data Assets

<details open>
<summary>📄 <b>DataAssetRulesDisabled.spec.ts</b> (32 tests, 32 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataAssetRulesDisabled.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataAssetRulesDisabled.spec.ts)

### Data Asset Rules Disabled

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Asset Rules Disabled** - Verify the ApiEndpoint entity item action after rules disabled | The ApiEndpoint entity item action after rules disabled |
| 2 | **Data Asset Rules Disabled** - Verify the Table entity item action after rules disabled | The Table entity item action after rules disabled |
| 3 | **Data Asset Rules Disabled** - Verify the Store Procedure entity item action after rules disabled | The Store Procedure entity item action after rules disabled |
| 4 | **Data Asset Rules Disabled** - Verify the Dashboard entity item action after rules disabled | The Dashboard entity item action after rules disabled |
| 5 | **Data Asset Rules Disabled** - Verify the Pipeline entity item action after rules disabled | The Pipeline entity item action after rules disabled |
| 6 | **Data Asset Rules Disabled** - Verify the Topic entity item action after rules disabled | The Topic entity item action after rules disabled |
| 7 | **Data Asset Rules Disabled** - Verify the MlModel entity item action after rules disabled | The MlModel entity item action after rules disabled |
| 8 | **Data Asset Rules Disabled** - Verify the Container entity item action after rules disabled | The Container entity item action after rules disabled |
| 9 | **Data Asset Rules Disabled** - Verify the SearchIndex entity item action after rules disabled | The SearchIndex entity item action after rules disabled |
| 10 | **Data Asset Rules Disabled** - Verify the DashboardDataModel entity item action after rules disabled | The DashboardDataModel entity item action after rules disabled |
| 11 | **Data Asset Rules Disabled** - Verify the Metric entity item action after rules disabled | The Metric entity item action after rules disabled |
| 12 | **Data Asset Rules Disabled** - Verify the Chart entity item action after rules disabled | The Chart entity item action after rules disabled |
| 13 | **Data Asset Rules Disabled** - Verify the Directory entity item action after rules disabled | The Directory entity item action after rules disabled |
| 14 | **Data Asset Rules Disabled** - Verify the File entity item action after rules disabled | The File entity item action after rules disabled |
| 15 | **Data Asset Rules Disabled** - Verify the Spreadsheet entity item action after rules disabled | The Spreadsheet entity item action after rules disabled |
| 16 | **Data Asset Rules Disabled** - Verify the Worksheet entity item action after rules disabled | The Worksheet entity item action after rules disabled |
| 17 | **Data Asset Rules Disabled** - Verify the Api Service entity item action after rules disabled | The Api Service entity item action after rules disabled |
| 18 | **Data Asset Rules Disabled** - Verify the Api Collection entity item action after rules disabled | The Api Collection entity item action after rules disabled |
| 19 | **Data Asset Rules Disabled** - Verify the Database Service entity item action after rules disabled | The Database Service entity item action after rules disabled |
| 20 | **Data Asset Rules Disabled** - Verify the Dashboard Service entity item action after rules disabled | The Dashboard Service entity item action after rules disabled |
| 21 | **Data Asset Rules Disabled** - Verify the Messaging Service entity item action after rules disabled | The Messaging Service entity item action after rules disabled |
| 22 | **Data Asset Rules Disabled** - Verify the MlModel Service entity item action after rules disabled | The MlModel Service entity item action after rules disabled |
| 23 | **Data Asset Rules Disabled** - Verify the Pipeline Service entity item action after rules disabled | The Pipeline Service entity item action after rules disabled |
| 24 | **Data Asset Rules Disabled** - Verify the SearchIndex Service entity item action after rules disabled | The SearchIndex Service entity item action after rules disabled |
| 25 | **Data Asset Rules Disabled** - Verify the Storage Service entity item action after rules disabled | The Storage Service entity item action after rules disabled |
| 26 | **Data Asset Rules Disabled** - Verify the Database entity item action after rules disabled | The Database entity item action after rules disabled |
| 27 | **Data Asset Rules Disabled** - Verify the Database Schema entity item action after rules disabled | The Database Schema entity item action after rules disabled |
| 28 | **Data Asset Rules Disabled** - Verify the Drive Service entity item action after rules disabled | The Drive Service entity item action after rules disabled |

### Data Asset Rules Disabled Bulk Edit Actions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Asset Rules Disabled Bulk Edit Actions** - Database service | Database service |
| | ↳ *Perform bulk edit action* | |
| 2 | **Data Asset Rules Disabled Bulk Edit Actions** - Database | Database |
| | ↳ *Perform bulk edit action* | |
| 3 | **Data Asset Rules Disabled Bulk Edit Actions** - Database Schema | Database Schema |
| | ↳ *Perform bulk edit action* | |

### GlossaryTerm Domain Entity Rules Disabled

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **GlossaryTerm Domain Entity Rules Disabled** - should allow multiple domain selection for glossary term when entity rules are disabled | Allow multiple domain selection for glossary term when entity rules are disabled |

</details>

<details open>
<summary>📄 <b>DataAssetRulesEnabled.spec.ts</b> (29 tests, 29 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/DataAssetRulesEnabled.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataAssetRulesEnabled.spec.ts)

### Data Asset Rules Enabled

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Asset Rules Enabled** - Verify the ApiEndpoint Entity Action items after rules is Enabled | The ApiEndpoint Entity Action items after rules is Enabled |
| 2 | **Data Asset Rules Enabled** - Verify the Table Entity Action items after rules is Enabled | The Table Entity Action items after rules is Enabled |
| 3 | **Data Asset Rules Enabled** - Verify the Store Procedure Entity Action items after rules is Enabled | The Store Procedure Entity Action items after rules is Enabled |
| 4 | **Data Asset Rules Enabled** - Verify the Dashboard Entity Action items after rules is Enabled | The Dashboard Entity Action items after rules is Enabled |
| 5 | **Data Asset Rules Enabled** - Verify the Pipeline Entity Action items after rules is Enabled | The Pipeline Entity Action items after rules is Enabled |
| 6 | **Data Asset Rules Enabled** - Verify the Topic Entity Action items after rules is Enabled | The Topic Entity Action items after rules is Enabled |
| 7 | **Data Asset Rules Enabled** - Verify the MlModel Entity Action items after rules is Enabled | The MlModel Entity Action items after rules is Enabled |
| 8 | **Data Asset Rules Enabled** - Verify the Container Entity Action items after rules is Enabled | The Container Entity Action items after rules is Enabled |
| 9 | **Data Asset Rules Enabled** - Verify the SearchIndex Entity Action items after rules is Enabled | The SearchIndex Entity Action items after rules is Enabled |
| 10 | **Data Asset Rules Enabled** - Verify the DashboardDataModel Entity Action items after rules is Enabled | The DashboardDataModel Entity Action items after rules is Enabled |
| 11 | **Data Asset Rules Enabled** - Verify the Metric Entity Action items after rules is Enabled | The Metric Entity Action items after rules is Enabled |
| 12 | **Data Asset Rules Enabled** - Verify the Chart Entity Action items after rules is Enabled | The Chart Entity Action items after rules is Enabled |
| 13 | **Data Asset Rules Enabled** - Verify the Directory Entity Action items after rules is Enabled | The Directory Entity Action items after rules is Enabled |
| 14 | **Data Asset Rules Enabled** - Verify the File Entity Action items after rules is Enabled | The File Entity Action items after rules is Enabled |
| 15 | **Data Asset Rules Enabled** - Verify the Spreadsheet Entity Action items after rules is Enabled | The Spreadsheet Entity Action items after rules is Enabled |
| 16 | **Data Asset Rules Enabled** - Verify the Worksheet Entity Action items after rules is Enabled | The Worksheet Entity Action items after rules is Enabled |
| 17 | **Data Asset Rules Enabled** - Verify the Api Service Entity Action items after rules is Enabled | The Api Service Entity Action items after rules is Enabled |
| 18 | **Data Asset Rules Enabled** - Verify the Api Collection Entity Action items after rules is Enabled | The Api Collection Entity Action items after rules is Enabled |
| 19 | **Data Asset Rules Enabled** - Verify the Database Service Entity Action items after rules is Enabled | The Database Service Entity Action items after rules is Enabled |
| 20 | **Data Asset Rules Enabled** - Verify the Dashboard Service Entity Action items after rules is Enabled | The Dashboard Service Entity Action items after rules is Enabled |
| 21 | **Data Asset Rules Enabled** - Verify the Messaging Service Entity Action items after rules is Enabled | The Messaging Service Entity Action items after rules is Enabled |
| 22 | **Data Asset Rules Enabled** - Verify the MlModel Service Entity Action items after rules is Enabled | The MlModel Service Entity Action items after rules is Enabled |
| 23 | **Data Asset Rules Enabled** - Verify the Pipeline Service Entity Action items after rules is Enabled | The Pipeline Service Entity Action items after rules is Enabled |
| 24 | **Data Asset Rules Enabled** - Verify the SearchIndex Service Entity Action items after rules is Enabled | The SearchIndex Service Entity Action items after rules is Enabled |
| 25 | **Data Asset Rules Enabled** - Verify the Storage Service Entity Action items after rules is Enabled | The Storage Service Entity Action items after rules is Enabled |
| 26 | **Data Asset Rules Enabled** - Verify the Database Entity Action items after rules is Enabled | The Database Entity Action items after rules is Enabled |
| 27 | **Data Asset Rules Enabled** - Verify the Database Schema Entity Action items after rules is Enabled | The Database Schema Entity Action items after rules is Enabled |
| 28 | **Data Asset Rules Enabled** - Verify the Drive Service Entity Action items after rules is Enabled | The Drive Service Entity Action items after rules is Enabled |

### GlossaryTerm Domain Entity Rules Enabled

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **GlossaryTerm Domain Entity Rules Enabled** - should enforce single domain selection for glossary term when entity rules are enabled | Enforce single domain selection for glossary term when entity rules are enabled |

</details>

<details open>
<summary>📄 <b>Table.spec.ts</b> (13 tests, 13 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Table.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Table.spec.ts)

### Table pagination sorting search scenarios 

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table pagination sorting search scenarios ** - Table pagination with sorting should works | Table pagination with sorting should works |
| 2 | **Table pagination sorting search scenarios ** - Table search with sorting should work | Table search with sorting should work |
| 3 | **Table pagination sorting search scenarios ** - Table filter with sorting should work | Table filter with sorting should work |
| 4 | **Table pagination sorting search scenarios ** - Table page should show schema tab with count | Table page should show schema tab with count |
| 5 | **Table pagination sorting search scenarios ** - should persist current page | Persist current page |
| 6 | **Table pagination sorting search scenarios ** - should persist page size | Persist page size |

### Table & Data Model columns table pagination

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table & Data Model columns table pagination** - expand collapse should only visible for nested columns | Expand collapse should only visible for nested columns |
| 2 | **Table & Data Model columns table pagination** - expand / collapse should not appear after updating nested fields table | Expand / collapse should not appear after updating nested fields table |

### Tags and glossary terms should be consistent for search 

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tags and glossary terms should be consistent for search ** - Glossary term should be consistent for search | Glossary term should be consistent for search |
| 2 | **Tags and glossary terms should be consistent for search ** - Tags term should be consistent for search | Tags term should be consistent for search |

### Large Table Column Search & Copy Link

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Large Table Column Search & Copy Link** - Search for column, copy link, and verify side panel behavior | Search for column, copy link, and verify side panel behavior |

### dbt Tab Visibility for Seed Files

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **dbt Tab Visibility for Seed Files** - should show dbt tab if only path is present | Show dbt tab if only path is present |
| 2 | **dbt Tab Visibility for Seed Files** - should show dbt tab if only source project is present | Show dbt tab if only source project is present |

</details>

<details open>
<summary>📄 <b>TableSorting.spec.ts</b> (11 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableSorting.spec.ts)

### Table Sorting

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table Sorting** - Services page should have sorting on name column | Services page should have sorting on name column |
| 2 | **Table Sorting** - Data Observability services page should have sorting on name column | Data Observability services page should have sorting on name column |
| 3 | **Table Sorting** - Database Schema page should have sorting on name column | Database Schema page should have sorting on name column |
| 4 | **Table Sorting** - API Endpoint page should have sorting on name column | API Endpoint page should have sorting on name column |
| 5 | **Table Sorting** - API Endpoint schema should have sorting on name column | API Endpoint schema should have sorting on name column |
| 6 | **Table Sorting** - Database Schema Tables tab should have sorting on name column | Database Schema Tables tab should have sorting on name column |
| 7 | **Table Sorting** - Data Models Table should have sorting on name column | Data Models Table should have sorting on name column |
| 8 | **Table Sorting** - Stored Procedure Table should have sorting on name column | Stored Procedure Table should have sorting on name column |
| 9 | **Table Sorting** - Topics Table should have sorting on name column | Topics Table should have sorting on name column |
| 10 | **Table Sorting** - Drives Service Files Table should have sorting on name column | Drives Service Files Table should have sorting on name column |
| 11 | **Table Sorting** - Drives Service Spreadsheets Table should have sorting on name column | Drives Service Spreadsheets Table should have sorting on name column |

</details>

<details open>
<summary>📄 <b>DataAssetsWidget.spec.ts</b> (7 tests, 7 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DataAssetsWidget.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DataAssetsWidget.spec.ts)

### Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table** - Check Data Asset and Service Filtration | Data Asset and Service Filtration |

### Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard** - Check Data Asset and Service Filtration | Data Asset and Service Filtration |

### Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline** - Check Data Asset and Service Filtration | Data Asset and Service Filtration |

### Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic** - Check Data Asset and Service Filtration | Data Asset and Service Filtration |

### Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container** - Check Data Asset and Service Filtration | Data Asset and Service Filtration |

### MlModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **MlModel** - Check Data Asset and Service Filtration | Data Asset and Service Filtration |

### SearchIndex

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SearchIndex** - Check Data Asset and Service Filtration | Data Asset and Service Filtration |

</details>

<details open>
<summary>📄 <b>Container.spec.ts</b> (5 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Container.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Container.spec.ts)

### Container entity specific tests 

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container entity specific tests ** - Container page should show Schema and Children count | Container page should show Schema and Children count |
| 2 | **Container entity specific tests ** - Container page children pagination | Container page children pagination |
| 3 | **Container entity specific tests ** - expand / collapse should not appear after updating nested fields for container | Expand / collapse should not appear after updating nested fields for container |
| 4 | **Container entity specific tests ** - Copy column link button should copy the column URL to clipboard | Copy column link button should copy the column URL to clipboard |
| 5 | **Container entity specific tests ** - Copy column link should have valid URL format | Copy column link should have valid URL format |

</details>

<details open>
<summary>📄 <b>SchemaTable.spec.ts</b> (5 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/SchemaTable.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | schema table test | Schema table test |
| | ↳ *set owner* | |
| | ↳ *set the description* | |
| 2 | Schema Table Pagination should work Properly | Schema Table Pagination should work Properly |
| 3 | Copy column link button should copy the column URL to clipboard | Copy column link button should copy the column URL to clipboard |
| 4 | Copy column link should have valid URL format | Copy column link should have valid URL format |
| 5 | Copy nested column link should include full hierarchical path | Copy nested column link should include full hierarchical path |

</details>

<details open>
<summary>📄 <b>Dashboards.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Dashboards.spec.ts)

### Dashboards

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboards** - should change the page size | Change the page size |

### Dashboard and Charts deleted toggle

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard and Charts deleted toggle** - should be able to toggle between deleted and non-deleted charts | Be able to toggle between deleted and non-deleted charts |

### Data Model

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Model** - expand / collapse should not appear after updating nested fields for dashboardDataModels | Expand / collapse should not appear after updating nested fields for dashboardDataModels |

### Data Model with special characters in name

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Model with special characters in name** - should display data model when service name contains dots | Display data model when service name contains dots |

</details>

<details open>
<summary>📄 <b>Topic.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Topic.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Topic.spec.ts)

### Topic entity specific tests 

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic entity specific tests ** - Topic page should show schema tab with count | Topic page should show schema tab with count |
| 2 | **Topic entity specific tests ** - Copy field link button should copy the field URL to clipboard | Copy field link button should copy the field URL to clipboard |
| 3 | **Topic entity specific tests ** - Copy field link should have valid URL format | Copy field link should have valid URL format |
| 4 | **Topic entity specific tests ** - Copy nested field link should include full hierarchical path | Copy nested field link should include full hierarchical path |

</details>

<details open>
<summary>📄 <b>SchemaDefinition.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/SchemaDefinition.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/SchemaDefinition.spec.ts)

### Schema definition (views)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Schema definition (views)** - Verify schema definition (views) of table entity | Schema definition (views) of table entity |

</details>

<details open>
<summary>📄 <b>TableConstraint.spec.ts</b> (1 tests, 3 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TableConstraint.spec.ts)

### Table Constraints

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table Constraints** - Table Constraint | Table Constraint |
| | ↳ *Add Constraints* | |
| | ↳ *Verify Constraints Data* | |
| | ↳ *Remove Constraints* | |

</details>

<details open>
<summary>📄 <b>PipelineExecution.spec.ts</b> (1 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/PipelineExecution.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/PipelineExecution.spec.ts)

### Pipeline Execution Tab

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline Execution Tab** - Execution tab should display start time, end time, and duration columns | Execution tab should display start time, end time, and duration columns |
| | ↳ *Navigate to pipeline entity page* | |
| | ↳ *Navigate to Executions tab* | |
| | ↳ *Verify ListView displays timing columns* | |
| | ↳ *Verify execution data rows are present* | |
| | ↳ *Verify duration is 10 minutes for both tasks* | |

</details>

<details open>
<summary>📄 <b>TableVersionPage.spec.ts</b> (1 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TableVersionPage.spec.ts)

### Table Version Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table Version Page** - Pagination and Search should works for columns | Pagination and Search should works for columns |
| | ↳ *Pagination Should Work* | |
| | ↳ *Search Should Work* | |

</details>


---

<div id="curated-assets"></div>

## Curated Assets

<details open>
<summary>📄 <b>CuratedAssets.spec.ts</b> (23 tests, 23 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CuratedAssets.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CuratedAssets.spec.ts)

### Curated Assets Widget

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Curated Assets Widget** - Test Tables with display name filter | Tables with display name filter |
| 2 | **Curated Assets Widget** - Test Dashboards with display name filter | Dashboards with display name filter |
| 3 | **Curated Assets Widget** - Test Pipelines with display name filter | Pipelines with display name filter |
| 4 | **Curated Assets Widget** - Test Topics with display name filter | Topics with display name filter |
| 5 | **Curated Assets Widget** - Test ML Model with display name filter | ML Model with display name filter |
| 6 | **Curated Assets Widget** - Test Containers with display name filter | Containers with display name filter |
| 7 | **Curated Assets Widget** - Test Search Indexes with display name filter | Search Indexes with display name filter |
| 8 | **Curated Assets Widget** - Test Charts with display name filter | Charts with display name filter |
| 9 | **Curated Assets Widget** - Test Stored Procedures with display name filter | Stored Procedures with display name filter |
| 10 | **Curated Assets Widget** - Test Data Model with display name filter | Data Model with display name filter |
| 11 | **Curated Assets Widget** - Test Glossary Terms with display name filter | Glossary Terms with display name filter |
| 12 | **Curated Assets Widget** - Test Metrics with display name filter | Metrics with display name filter |
| 13 | **Curated Assets Widget** - Test Databases with display name filter | Databases with display name filter |
| 14 | **Curated Assets Widget** - Test Database Schemas with display name filter | Database Schemas with display name filter |
| 15 | **Curated Assets Widget** - Test API Collections with display name filter | API Collections with display name filter |
| 16 | **Curated Assets Widget** - Test API Endpoints with display name filter | API Endpoints with display name filter |
| 17 | **Curated Assets Widget** - Test Data Products with display name filter | Data Products with display name filter |
| 18 | **Curated Assets Widget** - Test Knowledge Pages with display name filter | Knowledge Pages with display name filter |
| 19 | **Curated Assets Widget** - Entity type "ALL" with basic filter | Entity type "ALL" with basic filter |
| 20 | **Curated Assets Widget** - Multiple entity types with OR conditions | Multiple entity types with OR conditions |
| 21 | **Curated Assets Widget** - Multiple entity types with AND conditions | Multiple entity types with AND conditions |
| 22 | **Curated Assets Widget** - Complex nested groups | Complex nested groups |
| 23 | **Curated Assets Widget** - Placeholder validation - widget not visible without configuration | Placeholder validation - widget not visible without configuration |

</details>


---

<div id="explore"></div>

## Explore

<details open>
<summary>📄 <b>ExplorePageRightPanel.spec.ts</b> (326 tests, 436 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ExplorePageRightPanel.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExplorePageRightPanel.spec.ts)

### Right Panel Test Suite

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for table | Perform CRUD and Removal operations for table |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 2 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for dashboard | Perform CRUD and Removal operations for dashboard |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 3 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for pipeline | Perform CRUD and Removal operations for pipeline |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 4 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for topic | Perform CRUD and Removal operations for topic |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 5 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for database | Perform CRUD and Removal operations for database |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 6 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for databaseSchema | Perform CRUD and Removal operations for databaseSchema |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 7 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for dashboardDataModel | Perform CRUD and Removal operations for dashboardDataModel |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 8 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for mlmodel | Perform CRUD and Removal operations for mlmodel |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 9 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for container | Perform CRUD and Removal operations for container |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 10 | **Right Panel Test Suite** - Should perform CRUD and Removal operations for searchIndex | Perform CRUD and Removal operations for searchIndex |
| | ↳ *Navigate to entity* | |
| | ↳ *Update description* | |
| | ↳ *Update/edit tags* | |
| | ↳ *Update/edit tier* | |
| | ↳ *Update/edit glossary terms* | |
| | ↳ *Update owners* | |
| | ↳ *Update domain* | |
| | ↳ *Remove tag* | |
| | ↳ *Remove tier* | |
| | ↳ *Remove glossary term* | |
| | ↳ *Remove domain* | |
| | ↳ *Remove user owner* | |
| 11 | **Right Panel Test Suite** - Should display and verify schema fields for table | Display and verify schema fields for table |
| 12 | **Right Panel Test Suite** - Should display and verify schema fields for dashboard | Display and verify schema fields for dashboard |
| 13 | **Right Panel Test Suite** - Should display and verify schema fields for pipeline | Display and verify schema fields for pipeline |
| 14 | **Right Panel Test Suite** - Should display and verify schema fields for topic | Display and verify schema fields for topic |
| 15 | **Right Panel Test Suite** - Should display and verify schema fields for database | Display and verify schema fields for database |
| 16 | **Right Panel Test Suite** - Should display and verify schema fields for databaseSchema | Display and verify schema fields for databaseSchema |
| 17 | **Right Panel Test Suite** - Should display and verify schema fields for dashboardDataModel | Display and verify schema fields for dashboardDataModel |
| 18 | **Right Panel Test Suite** - Should display and verify schema fields for mlmodel | Display and verify schema fields for mlmodel |
| 19 | **Right Panel Test Suite** - Should display and verify schema fields for container | Display and verify schema fields for container |
| 20 | **Right Panel Test Suite** - Should display and verify schema fields for searchIndex | Display and verify schema fields for searchIndex |
| 21 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for table | Validates visible/hidden tabs and tab content for table |
| 22 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for dashboard | Validates visible/hidden tabs and tab content for dashboard |
| 23 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for pipeline | Validates visible/hidden tabs and tab content for pipeline |
| 24 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for topic | Validates visible/hidden tabs and tab content for topic |
| 25 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for database | Validates visible/hidden tabs and tab content for database |
| 26 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for databaseSchema | Validates visible/hidden tabs and tab content for databaseSchema |
| 27 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for dashboardDataModel | Validates visible/hidden tabs and tab content for dashboardDataModel |
| 28 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for mlmodel | Validates visible/hidden tabs and tab content for mlmodel |
| 29 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for container | Validates visible/hidden tabs and tab content for container |
| 30 | **Right Panel Test Suite** - validates visible/hidden tabs and tab content for searchIndex | Validates visible/hidden tabs and tab content for searchIndex |
| 31 | **Right Panel Test Suite** - Should navigate to lineage and test controls for table | Navigate to lineage and test controls for table |
| 32 | **Right Panel Test Suite** - Should handle lineage expansion buttons for table | Handle lineage expansion buttons for table |
| 33 | **Right Panel Test Suite** - Should navigate to lineage and test controls for dashboard | Navigate to lineage and test controls for dashboard |
| 34 | **Right Panel Test Suite** - Should handle lineage expansion buttons for dashboard | Handle lineage expansion buttons for dashboard |
| 35 | **Right Panel Test Suite** - Should navigate to lineage and test controls for pipeline | Navigate to lineage and test controls for pipeline |
| 36 | **Right Panel Test Suite** - Should handle lineage expansion buttons for pipeline | Handle lineage expansion buttons for pipeline |
| 37 | **Right Panel Test Suite** - Should navigate to lineage and test controls for topic | Navigate to lineage and test controls for topic |
| 38 | **Right Panel Test Suite** - Should handle lineage expansion buttons for topic | Handle lineage expansion buttons for topic |
| 39 | **Right Panel Test Suite** - Should navigate to lineage and test controls for database | Navigate to lineage and test controls for database |
| 40 | **Right Panel Test Suite** - Should handle lineage expansion buttons for database | Handle lineage expansion buttons for database |
| 41 | **Right Panel Test Suite** - Should navigate to lineage and test controls for databaseSchema | Navigate to lineage and test controls for databaseSchema |
| 42 | **Right Panel Test Suite** - Should handle lineage expansion buttons for databaseSchema | Handle lineage expansion buttons for databaseSchema |
| 43 | **Right Panel Test Suite** - Should navigate to lineage and test controls for dashboardDataModel | Navigate to lineage and test controls for dashboardDataModel |
| 44 | **Right Panel Test Suite** - Should handle lineage expansion buttons for dashboardDataModel | Handle lineage expansion buttons for dashboardDataModel |
| 45 | **Right Panel Test Suite** - Should navigate to lineage and test controls for mlmodel | Navigate to lineage and test controls for mlmodel |
| 46 | **Right Panel Test Suite** - Should handle lineage expansion buttons for mlmodel | Handle lineage expansion buttons for mlmodel |
| 47 | **Right Panel Test Suite** - Should navigate to lineage and test controls for container | Navigate to lineage and test controls for container |
| 48 | **Right Panel Test Suite** - Should handle lineage expansion buttons for container | Handle lineage expansion buttons for container |
| 49 | **Right Panel Test Suite** - Should navigate to lineage and test controls for searchIndex | Navigate to lineage and test controls for searchIndex |
| 50 | **Right Panel Test Suite** - Should handle lineage expansion buttons for searchIndex | Handle lineage expansion buttons for searchIndex |
| 51 | **Right Panel Test Suite** - Should show lineage connections created via API in the lineage tab | Show lineage connections created via API in the lineage tab |
| 52 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for table | Navigate to data quality and verify tab structure for table |
| 53 | **Right Panel Test Suite** - Should display incidents tab for table | Display incidents tab for table |
| 54 | **Right Panel Test Suite** - Should verify empty state when no test cases for table | Empty state when no test cases for table |
| 55 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for dashboard | Navigate to data quality and verify tab structure for dashboard |
| 56 | **Right Panel Test Suite** - Should display incidents tab for dashboard | Display incidents tab for dashboard |
| 57 | **Right Panel Test Suite** - Should verify empty state when no test cases for dashboard | Empty state when no test cases for dashboard |
| 58 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for pipeline | Navigate to data quality and verify tab structure for pipeline |
| 59 | **Right Panel Test Suite** - Should display incidents tab for pipeline | Display incidents tab for pipeline |
| 60 | **Right Panel Test Suite** - Should verify empty state when no test cases for pipeline | Empty state when no test cases for pipeline |
| 61 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for topic | Navigate to data quality and verify tab structure for topic |
| 62 | **Right Panel Test Suite** - Should display incidents tab for topic | Display incidents tab for topic |
| 63 | **Right Panel Test Suite** - Should verify empty state when no test cases for topic | Empty state when no test cases for topic |
| 64 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for database | Navigate to data quality and verify tab structure for database |
| 65 | **Right Panel Test Suite** - Should display incidents tab for database | Display incidents tab for database |
| 66 | **Right Panel Test Suite** - Should verify empty state when no test cases for database | Empty state when no test cases for database |
| 67 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for databaseSchema | Navigate to data quality and verify tab structure for databaseSchema |
| 68 | **Right Panel Test Suite** - Should display incidents tab for databaseSchema | Display incidents tab for databaseSchema |
| 69 | **Right Panel Test Suite** - Should verify empty state when no test cases for databaseSchema | Empty state when no test cases for databaseSchema |
| 70 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for dashboardDataModel | Navigate to data quality and verify tab structure for dashboardDataModel |
| 71 | **Right Panel Test Suite** - Should display incidents tab for dashboardDataModel | Display incidents tab for dashboardDataModel |
| 72 | **Right Panel Test Suite** - Should verify empty state when no test cases for dashboardDataModel | Empty state when no test cases for dashboardDataModel |
| 73 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for mlmodel | Navigate to data quality and verify tab structure for mlmodel |
| 74 | **Right Panel Test Suite** - Should display incidents tab for mlmodel | Display incidents tab for mlmodel |
| 75 | **Right Panel Test Suite** - Should verify empty state when no test cases for mlmodel | Empty state when no test cases for mlmodel |
| 76 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for container | Navigate to data quality and verify tab structure for container |
| 77 | **Right Panel Test Suite** - Should display incidents tab for container | Display incidents tab for container |
| 78 | **Right Panel Test Suite** - Should verify empty state when no test cases for container | Empty state when no test cases for container |
| 79 | **Right Panel Test Suite** - Should navigate to data quality and verify tab structure for searchIndex | Navigate to data quality and verify tab structure for searchIndex |
| 80 | **Right Panel Test Suite** - Should display incidents tab for searchIndex | Display incidents tab for searchIndex |
| 81 | **Right Panel Test Suite** - Should verify empty state when no test cases for searchIndex | Empty state when no test cases for searchIndex |
| 82 | **Right Panel Test Suite** - Should display stat cards and filterable test case cards when runs exist | Display stat cards and filterable test case cards when runs exist |
| 83 | **Right Panel Test Suite** - Should search and filter test cases in Data Quality tab | Search and filter test cases in Data Quality tab |
| 84 | **Right Panel Test Suite** - Should show incidents tab content and verify incident details when a failed test case exists | Show incidents tab content and verify incident details when a failed test case exists |
| 85 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for table | Navigate to custom properties and show interface for table |
| 86 | **Right Panel Test Suite** - Should display custom properties for table | Display custom properties for table |
| 87 | **Right Panel Test Suite** - Should search custom properties for table | Search custom properties for table |
| 88 | **Right Panel Test Suite** - Should clear search and show all properties for table | Clear search and show all properties for table |
| 89 | **Right Panel Test Suite** - Should show no results for invalid search for table | Show no results for invalid search for table |
| 90 | **Right Panel Test Suite** - Should verify property name is visible for table | Property name is visible for table |
| 91 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for dashboard | Navigate to custom properties and show interface for dashboard |
| 92 | **Right Panel Test Suite** - Should display custom properties for dashboard | Display custom properties for dashboard |
| 93 | **Right Panel Test Suite** - Should search custom properties for dashboard | Search custom properties for dashboard |
| 94 | **Right Panel Test Suite** - Should clear search and show all properties for dashboard | Clear search and show all properties for dashboard |
| 95 | **Right Panel Test Suite** - Should show no results for invalid search for dashboard | Show no results for invalid search for dashboard |
| 96 | **Right Panel Test Suite** - Should verify property name is visible for dashboard | Property name is visible for dashboard |
| 97 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for pipeline | Navigate to custom properties and show interface for pipeline |
| 98 | **Right Panel Test Suite** - Should display custom properties for pipeline | Display custom properties for pipeline |
| 99 | **Right Panel Test Suite** - Should search custom properties for pipeline | Search custom properties for pipeline |
| 100 | **Right Panel Test Suite** - Should clear search and show all properties for pipeline | Clear search and show all properties for pipeline |
| 101 | **Right Panel Test Suite** - Should show no results for invalid search for pipeline | Show no results for invalid search for pipeline |
| 102 | **Right Panel Test Suite** - Should verify property name is visible for pipeline | Property name is visible for pipeline |
| 103 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for topic | Navigate to custom properties and show interface for topic |
| 104 | **Right Panel Test Suite** - Should display custom properties for topic | Display custom properties for topic |
| 105 | **Right Panel Test Suite** - Should search custom properties for topic | Search custom properties for topic |
| 106 | **Right Panel Test Suite** - Should clear search and show all properties for topic | Clear search and show all properties for topic |
| 107 | **Right Panel Test Suite** - Should show no results for invalid search for topic | Show no results for invalid search for topic |
| 108 | **Right Panel Test Suite** - Should verify property name is visible for topic | Property name is visible for topic |
| 109 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for database | Navigate to custom properties and show interface for database |
| 110 | **Right Panel Test Suite** - Should display custom properties for database | Display custom properties for database |
| 111 | **Right Panel Test Suite** - Should search custom properties for database | Search custom properties for database |
| 112 | **Right Panel Test Suite** - Should clear search and show all properties for database | Clear search and show all properties for database |
| 113 | **Right Panel Test Suite** - Should show no results for invalid search for database | Show no results for invalid search for database |
| 114 | **Right Panel Test Suite** - Should verify property name is visible for database | Property name is visible for database |
| 115 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for databaseSchema | Navigate to custom properties and show interface for databaseSchema |
| 116 | **Right Panel Test Suite** - Should display custom properties for databaseSchema | Display custom properties for databaseSchema |
| 117 | **Right Panel Test Suite** - Should search custom properties for databaseSchema | Search custom properties for databaseSchema |
| 118 | **Right Panel Test Suite** - Should clear search and show all properties for databaseSchema | Clear search and show all properties for databaseSchema |
| 119 | **Right Panel Test Suite** - Should show no results for invalid search for databaseSchema | Show no results for invalid search for databaseSchema |
| 120 | **Right Panel Test Suite** - Should verify property name is visible for databaseSchema | Property name is visible for databaseSchema |
| 121 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for dashboardDataModel | Navigate to custom properties and show interface for dashboardDataModel |
| 122 | **Right Panel Test Suite** - Should display custom properties for dashboardDataModel | Display custom properties for dashboardDataModel |
| 123 | **Right Panel Test Suite** - Should search custom properties for dashboardDataModel | Search custom properties for dashboardDataModel |
| 124 | **Right Panel Test Suite** - Should clear search and show all properties for dashboardDataModel | Clear search and show all properties for dashboardDataModel |
| 125 | **Right Panel Test Suite** - Should show no results for invalid search for dashboardDataModel | Show no results for invalid search for dashboardDataModel |
| 126 | **Right Panel Test Suite** - Should verify property name is visible for dashboardDataModel | Property name is visible for dashboardDataModel |
| 127 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for mlmodel | Navigate to custom properties and show interface for mlmodel |
| 128 | **Right Panel Test Suite** - Should display custom properties for mlmodel | Display custom properties for mlmodel |
| 129 | **Right Panel Test Suite** - Should search custom properties for mlmodel | Search custom properties for mlmodel |
| 130 | **Right Panel Test Suite** - Should clear search and show all properties for mlmodel | Clear search and show all properties for mlmodel |
| 131 | **Right Panel Test Suite** - Should show no results for invalid search for mlmodel | Show no results for invalid search for mlmodel |
| 132 | **Right Panel Test Suite** - Should verify property name is visible for mlmodel | Property name is visible for mlmodel |
| 133 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for container | Navigate to custom properties and show interface for container |
| 134 | **Right Panel Test Suite** - Should display custom properties for container | Display custom properties for container |
| 135 | **Right Panel Test Suite** - Should search custom properties for container | Search custom properties for container |
| 136 | **Right Panel Test Suite** - Should clear search and show all properties for container | Clear search and show all properties for container |
| 137 | **Right Panel Test Suite** - Should show no results for invalid search for container | Show no results for invalid search for container |
| 138 | **Right Panel Test Suite** - Should verify property name is visible for container | Property name is visible for container |
| 139 | **Right Panel Test Suite** - Should navigate to custom properties and show interface for searchIndex | Navigate to custom properties and show interface for searchIndex |
| 140 | **Right Panel Test Suite** - Should display custom properties for searchIndex | Display custom properties for searchIndex |
| 141 | **Right Panel Test Suite** - Should search custom properties for searchIndex | Search custom properties for searchIndex |
| 142 | **Right Panel Test Suite** - Should clear search and show all properties for searchIndex | Clear search and show all properties for searchIndex |
| 143 | **Right Panel Test Suite** - Should show no results for invalid search for searchIndex | Show no results for invalid search for searchIndex |
| 144 | **Right Panel Test Suite** - Should verify property name is visible for searchIndex | Property name is visible for searchIndex |
| 145 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for table | Deleted user not visible in owner selection for table |
| 146 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for table | Deleted tag not visible in tag selection for table |
| 147 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for table | Deleted glossary term not visible in selection for table |
| 148 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for dashboard | Deleted user not visible in owner selection for dashboard |
| 149 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for dashboard | Deleted tag not visible in tag selection for dashboard |
| 150 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for dashboard | Deleted glossary term not visible in selection for dashboard |
| 151 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for pipeline | Deleted user not visible in owner selection for pipeline |
| 152 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for pipeline | Deleted tag not visible in tag selection for pipeline |
| 153 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for pipeline | Deleted glossary term not visible in selection for pipeline |
| 154 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for topic | Deleted user not visible in owner selection for topic |
| 155 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for topic | Deleted tag not visible in tag selection for topic |
| 156 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for topic | Deleted glossary term not visible in selection for topic |
| 157 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for database | Deleted user not visible in owner selection for database |
| 158 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for database | Deleted tag not visible in tag selection for database |
| 159 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for database | Deleted glossary term not visible in selection for database |
| 160 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for databaseSchema | Deleted user not visible in owner selection for databaseSchema |
| 161 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for databaseSchema | Deleted tag not visible in tag selection for databaseSchema |
| 162 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for databaseSchema | Deleted glossary term not visible in selection for databaseSchema |
| 163 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for dashboardDataModel | Deleted user not visible in owner selection for dashboardDataModel |
| 164 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for dashboardDataModel | Deleted tag not visible in tag selection for dashboardDataModel |
| 165 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for dashboardDataModel | Deleted glossary term not visible in selection for dashboardDataModel |
| 166 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for mlmodel | Deleted user not visible in owner selection for mlmodel |
| 167 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for mlmodel | Deleted tag not visible in tag selection for mlmodel |
| 168 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for mlmodel | Deleted glossary term not visible in selection for mlmodel |
| 169 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for container | Deleted user not visible in owner selection for container |
| 170 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for container | Deleted tag not visible in tag selection for container |
| 171 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for container | Deleted glossary term not visible in selection for container |
| 172 | **Right Panel Test Suite** - Should verify deleted user not visible in owner selection for searchIndex | Deleted user not visible in owner selection for searchIndex |
| 173 | **Right Panel Test Suite** - Should verify deleted tag not visible in tag selection for searchIndex | Deleted tag not visible in tag selection for searchIndex |
| 174 | **Right Panel Test Suite** - Should verify deleted glossary term not visible in selection for searchIndex | Deleted glossary term not visible in selection for searchIndex |
| 175 | **Right Panel Test Suite** - Should allow Data Steward to edit description for table | Allow Data Steward to edit description for table |
| 176 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for table | Allow Data Steward to edit owners for table |
| 177 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for table | Allow Data Steward to edit tags for table |
| 178 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for table | Allow Data Steward to edit glossary terms for table |
| 179 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for table | Allow Data Steward to edit tier for table |
| 180 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for table | Allow Data Steward to view all tabs for table |
| 181 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for table | NOT show restricted edit buttons for Data Steward for table |
| 182 | **Right Panel Test Suite** - Should allow Data Steward to edit description for dashboard | Allow Data Steward to edit description for dashboard |
| 183 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for dashboard | Allow Data Steward to edit owners for dashboard |
| 184 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for dashboard | Allow Data Steward to edit tags for dashboard |
| 185 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for dashboard | Allow Data Steward to edit glossary terms for dashboard |
| 186 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for dashboard | Allow Data Steward to edit tier for dashboard |
| 187 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for dashboard | Allow Data Steward to view all tabs for dashboard |
| 188 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for dashboard | NOT show restricted edit buttons for Data Steward for dashboard |
| 189 | **Right Panel Test Suite** - Should allow Data Steward to edit description for pipeline | Allow Data Steward to edit description for pipeline |
| 190 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for pipeline | Allow Data Steward to edit owners for pipeline |
| 191 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for pipeline | Allow Data Steward to edit tags for pipeline |
| 192 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for pipeline | Allow Data Steward to edit glossary terms for pipeline |
| 193 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for pipeline | Allow Data Steward to edit tier for pipeline |
| 194 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for pipeline | Allow Data Steward to view all tabs for pipeline |
| 195 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for pipeline | NOT show restricted edit buttons for Data Steward for pipeline |
| 196 | **Right Panel Test Suite** - Should allow Data Steward to edit description for topic | Allow Data Steward to edit description for topic |
| 197 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for topic | Allow Data Steward to edit owners for topic |
| 198 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for topic | Allow Data Steward to edit tags for topic |
| 199 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for topic | Allow Data Steward to edit glossary terms for topic |
| 200 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for topic | Allow Data Steward to edit tier for topic |
| 201 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for topic | Allow Data Steward to view all tabs for topic |
| 202 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for topic | NOT show restricted edit buttons for Data Steward for topic |
| 203 | **Right Panel Test Suite** - Should allow Data Steward to edit description for database | Allow Data Steward to edit description for database |
| 204 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for database | Allow Data Steward to edit owners for database |
| 205 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for database | Allow Data Steward to edit tags for database |
| 206 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for database | Allow Data Steward to edit glossary terms for database |
| 207 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for database | Allow Data Steward to edit tier for database |
| 208 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for database | Allow Data Steward to view all tabs for database |
| 209 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for database | NOT show restricted edit buttons for Data Steward for database |
| 210 | **Right Panel Test Suite** - Should allow Data Steward to edit description for databaseSchema | Allow Data Steward to edit description for databaseSchema |
| 211 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for databaseSchema | Allow Data Steward to edit owners for databaseSchema |
| 212 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for databaseSchema | Allow Data Steward to edit tags for databaseSchema |
| 213 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for databaseSchema | Allow Data Steward to edit glossary terms for databaseSchema |
| 214 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for databaseSchema | Allow Data Steward to edit tier for databaseSchema |
| 215 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for databaseSchema | Allow Data Steward to view all tabs for databaseSchema |
| 216 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for databaseSchema | NOT show restricted edit buttons for Data Steward for databaseSchema |
| 217 | **Right Panel Test Suite** - Should allow Data Steward to edit description for dashboardDataModel | Allow Data Steward to edit description for dashboardDataModel |
| 218 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for dashboardDataModel | Allow Data Steward to edit owners for dashboardDataModel |
| 219 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for dashboardDataModel | Allow Data Steward to edit tags for dashboardDataModel |
| 220 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for dashboardDataModel | Allow Data Steward to edit glossary terms for dashboardDataModel |
| 221 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for dashboardDataModel | Allow Data Steward to edit tier for dashboardDataModel |
| 222 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for dashboardDataModel | Allow Data Steward to view all tabs for dashboardDataModel |
| 223 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for dashboardDataModel | NOT show restricted edit buttons for Data Steward for dashboardDataModel |
| 224 | **Right Panel Test Suite** - Should allow Data Steward to edit description for mlmodel | Allow Data Steward to edit description for mlmodel |
| 225 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for mlmodel | Allow Data Steward to edit owners for mlmodel |
| 226 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for mlmodel | Allow Data Steward to edit tags for mlmodel |
| 227 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for mlmodel | Allow Data Steward to edit glossary terms for mlmodel |
| 228 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for mlmodel | Allow Data Steward to edit tier for mlmodel |
| 229 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for mlmodel | Allow Data Steward to view all tabs for mlmodel |
| 230 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for mlmodel | NOT show restricted edit buttons for Data Steward for mlmodel |
| 231 | **Right Panel Test Suite** - Should allow Data Steward to edit description for container | Allow Data Steward to edit description for container |
| 232 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for container | Allow Data Steward to edit owners for container |
| 233 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for container | Allow Data Steward to edit tags for container |
| 234 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for container | Allow Data Steward to edit glossary terms for container |
| 235 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for container | Allow Data Steward to edit tier for container |
| 236 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for container | Allow Data Steward to view all tabs for container |
| 237 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for container | NOT show restricted edit buttons for Data Steward for container |
| 238 | **Right Panel Test Suite** - Should allow Data Steward to edit description for searchIndex | Allow Data Steward to edit description for searchIndex |
| 239 | **Right Panel Test Suite** - Should allow Data Steward to edit owners for searchIndex | Allow Data Steward to edit owners for searchIndex |
| 240 | **Right Panel Test Suite** - Should allow Data Steward to edit tags for searchIndex | Allow Data Steward to edit tags for searchIndex |
| 241 | **Right Panel Test Suite** - Should allow Data Steward to edit glossary terms for searchIndex | Allow Data Steward to edit glossary terms for searchIndex |
| 242 | **Right Panel Test Suite** - Should allow Data Steward to edit tier for searchIndex | Allow Data Steward to edit tier for searchIndex |
| 243 | **Right Panel Test Suite** - Should allow Data Steward to view all tabs for searchIndex | Allow Data Steward to view all tabs for searchIndex |
| 244 | **Right Panel Test Suite** - Should NOT show restricted edit buttons for Data Steward for searchIndex | NOT show restricted edit buttons for Data Steward for searchIndex |
| 245 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for table | Allow Data Consumer to edit description for table |
| 246 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for table | Allow Data Consumer to edit tags for table |
| 247 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for table | Allow Data Consumer to edit glossary terms for table |
| 248 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for table | Allow Data Consumer to edit tier for table |
| 249 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for table | Allow Data Consumer to view all tabs for table |
| 250 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless table | Follow Data Consumer role policies for ownerless table |
| 251 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for dashboard | Allow Data Consumer to edit description for dashboard |
| 252 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for dashboard | Allow Data Consumer to edit tags for dashboard |
| 253 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for dashboard | Allow Data Consumer to edit glossary terms for dashboard |
| 254 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for dashboard | Allow Data Consumer to edit tier for dashboard |
| 255 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for dashboard | Allow Data Consumer to view all tabs for dashboard |
| 256 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless dashboard | Follow Data Consumer role policies for ownerless dashboard |
| 257 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for pipeline | Allow Data Consumer to edit description for pipeline |
| 258 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for pipeline | Allow Data Consumer to edit tags for pipeline |
| 259 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for pipeline | Allow Data Consumer to edit glossary terms for pipeline |
| 260 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for pipeline | Allow Data Consumer to edit tier for pipeline |
| 261 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for pipeline | Allow Data Consumer to view all tabs for pipeline |
| 262 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless pipeline | Follow Data Consumer role policies for ownerless pipeline |
| 263 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for topic | Allow Data Consumer to edit description for topic |
| 264 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for topic | Allow Data Consumer to edit tags for topic |
| 265 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for topic | Allow Data Consumer to edit glossary terms for topic |
| 266 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for topic | Allow Data Consumer to edit tier for topic |
| 267 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for topic | Allow Data Consumer to view all tabs for topic |
| 268 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless topic | Follow Data Consumer role policies for ownerless topic |
| 269 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for database | Allow Data Consumer to edit description for database |
| 270 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for database | Allow Data Consumer to edit tags for database |
| 271 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for database | Allow Data Consumer to edit glossary terms for database |
| 272 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for database | Allow Data Consumer to edit tier for database |
| 273 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for database | Allow Data Consumer to view all tabs for database |
| 274 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless database | Follow Data Consumer role policies for ownerless database |
| 275 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for databaseSchema | Allow Data Consumer to edit description for databaseSchema |
| 276 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for databaseSchema | Allow Data Consumer to edit tags for databaseSchema |
| 277 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for databaseSchema | Allow Data Consumer to edit glossary terms for databaseSchema |
| 278 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for databaseSchema | Allow Data Consumer to edit tier for databaseSchema |
| 279 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for databaseSchema | Allow Data Consumer to view all tabs for databaseSchema |
| 280 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless databaseSchema | Follow Data Consumer role policies for ownerless databaseSchema |
| 281 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for dashboardDataModel | Allow Data Consumer to edit description for dashboardDataModel |
| 282 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for dashboardDataModel | Allow Data Consumer to edit tags for dashboardDataModel |
| 283 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for dashboardDataModel | Allow Data Consumer to edit glossary terms for dashboardDataModel |
| 284 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for dashboardDataModel | Allow Data Consumer to edit tier for dashboardDataModel |
| 285 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for dashboardDataModel | Allow Data Consumer to view all tabs for dashboardDataModel |
| 286 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless dashboardDataModel | Follow Data Consumer role policies for ownerless dashboardDataModel |
| 287 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for mlmodel | Allow Data Consumer to edit description for mlmodel |
| 288 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for mlmodel | Allow Data Consumer to edit tags for mlmodel |
| 289 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for mlmodel | Allow Data Consumer to edit glossary terms for mlmodel |
| 290 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for mlmodel | Allow Data Consumer to edit tier for mlmodel |
| 291 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for mlmodel | Allow Data Consumer to view all tabs for mlmodel |
| 292 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless mlmodel | Follow Data Consumer role policies for ownerless mlmodel |
| 293 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for container | Allow Data Consumer to edit description for container |
| 294 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for container | Allow Data Consumer to edit tags for container |
| 295 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for container | Allow Data Consumer to edit glossary terms for container |
| 296 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for container | Allow Data Consumer to edit tier for container |
| 297 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for container | Allow Data Consumer to view all tabs for container |
| 298 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless container | Follow Data Consumer role policies for ownerless container |
| 299 | **Right Panel Test Suite** - Should allow Data Consumer to edit description for searchIndex | Allow Data Consumer to edit description for searchIndex |
| 300 | **Right Panel Test Suite** - Should allow Data Consumer to edit tags for searchIndex | Allow Data Consumer to edit tags for searchIndex |
| 301 | **Right Panel Test Suite** - Should allow Data Consumer to edit glossary terms for searchIndex | Allow Data Consumer to edit glossary terms for searchIndex |
| 302 | **Right Panel Test Suite** - Should allow Data Consumer to edit tier for searchIndex | Allow Data Consumer to edit tier for searchIndex |
| 303 | **Right Panel Test Suite** - Should allow Data Consumer to view all tabs for searchIndex | Allow Data Consumer to view all tabs for searchIndex |
| 304 | **Right Panel Test Suite** - Should follow Data Consumer role policies for ownerless searchIndex | Follow Data Consumer role policies for ownerless searchIndex |
| 305 | **Right Panel Test Suite** - Should NOT allow Data Consumer to edit owners when entity has owner | NOT allow Data Consumer to edit owners when entity has owner |
| 306 | **Right Panel Test Suite** - Should show appropriate message when no owners assigned | Show appropriate message when no owners assigned |
| 307 | **Right Panel Test Suite** - Should show appropriate message when no tags assigned | Show appropriate message when no tags assigned |
| 308 | **Right Panel Test Suite** - Should show appropriate message when no tier assigned | Show appropriate message when no tier assigned |
| 309 | **Right Panel Test Suite** - Should show appropriate message when no domain assigned | Show appropriate message when no domain assigned |
| 310 | **Right Panel Test Suite** - Should show appropriate message when no glossary terms assigned | Show appropriate message when no glossary terms assigned |
| 311 | **Right Panel Test Suite** - Should show lineage not found when no lineage exists | Show lineage not found when no lineage exists |
| 312 | **Right Panel Test Suite** - Should show no test cases message when data quality tab is empty | Show no test cases message when data quality tab is empty |
| 313 | **Right Panel Test Suite** - Should clear description for table | Clear description for table |
| 314 | **Right Panel Test Suite** - Should clear description for dashboard | Clear description for dashboard |
| 315 | **Right Panel Test Suite** - Should clear description for pipeline | Clear description for pipeline |
| 316 | **Right Panel Test Suite** - Should clear description for topic | Clear description for topic |
| 317 | **Right Panel Test Suite** - Should clear description for database | Clear description for database |
| 318 | **Right Panel Test Suite** - Should clear description for databaseSchema | Clear description for databaseSchema |
| 319 | **Right Panel Test Suite** - Should clear description for dashboardDataModel | Clear description for dashboardDataModel |
| 320 | **Right Panel Test Suite** - Should clear description for mlmodel | Clear description for mlmodel |
| 321 | **Right Panel Test Suite** - Should clear description for container | Clear description for container |
| 322 | **Right Panel Test Suite** - Should clear description for searchIndex | Clear description for searchIndex |
| 323 | **Right Panel Test Suite** - Should update panel content when switching between entities | Update panel content when switching between entities |
| 324 | **Right Panel Test Suite** - Should add multiple tags simultaneously | Add multiple tags simultaneously |
| 325 | **Right Panel Test Suite** - Data Quality tab should show permission placeholder for ViewBasic-only user in column detail panel | Data Quality tab should show permission placeholder for ViewBasic-only user in column detail panel |
| 326 | **Right Panel Test Suite** - Should not make forbidden API calls when ViewBasic-only user opens column detail panel | Not make forbidden API calls when ViewBasic-only user opens column detail panel |

</details>

<details open>
<summary>📄 <b>ExploreTree.spec.ts</b> (32 tests, 41 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts)

### Explore Tree scenarios

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Explore Tree scenarios** - Explore Tree | Explore Tree |
| | ↳ *Check the explore tree* | |
| | ↳ *Check the quick filters* | |
| | ↳ *Click on tree item and check quick filter* | |
| | ↳ *Click on tree item metrics and check quick filter* | |
| 2 | **Explore Tree scenarios** - Verify Tags navigation via Governance tree and breadcrumb renders page correctly | Tags navigation via Governance tree and breadcrumb renders page correctly |
| | ↳ *Expand Governance node in explore tree* | |
| | ↳ *Click on Tags under Governance* | |
| | ↳ *Click parent classification breadcrumb from a tag result* | |
| | ↳ *Verify full Tags page renders with left panel, table and headers* | |
| 3 | **Explore Tree scenarios** - Verify Database and Database Schema available in explore tree | Database and Database Schema available in explore tree |
| | ↳ *Verify first table database and schema* | |
| | ↳ *Verify second table database and schema* | |
| 4 | **Explore Tree scenarios** - Verify Database and Database schema after rename | Database and Database schema after rename |
| | ↳ *Visit explore page and verify existing values* | |
| | ↳ *Rename schema and database* | |
| | ↳ *Verify renamed values in explore page* | |

### Explore page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Explore page** - Check the listing of tags | The listing of tags |
| 2 | **Explore page** - Check listing of entities when index is dataAsset | Listing of entities when index is dataAsset |
| 3 | **Explore page** - Check listing of entities when index is all | Listing of entities when index is all |
| 4 | **Explore page** - Verify charts are visible in explore tree | Charts are visible in explore tree |
| 5 | **Explore page** - Check listing of table when sort is descending | Listing of table when sort is descending |
| 6 | **Explore page** - Check listing of storedProcedure when sort is descending | Listing of storedProcedure when sort is descending |
| 7 | **Explore page** - Check listing of database when sort is descending | Listing of database when sort is descending |
| 8 | **Explore page** - Check listing of databaseSchema when sort is descending | Listing of databaseSchema when sort is descending |
| 9 | **Explore page** - Check listing of dashboard when sort is descending | Listing of dashboard when sort is descending |
| 10 | **Explore page** - Check listing of dashboardDataModel when sort is descending | Listing of dashboardDataModel when sort is descending |
| 11 | **Explore page** - Check listing of pipeline when sort is descending | Listing of pipeline when sort is descending |
| 12 | **Explore page** - Check listing of topic when sort is descending | Listing of topic when sort is descending |
| 13 | **Explore page** - Check listing of mlmodel when sort is descending | Listing of mlmodel when sort is descending |
| 14 | **Explore page** - Check listing of container when sort is descending | Listing of container when sort is descending |
| 15 | **Explore page** - Check listing of searchIndex when sort is descending | Listing of searchIndex when sort is descending |
| 16 | **Explore page** - Check listing of glossaryTerm when sort is descending | Listing of glossaryTerm when sort is descending |
| 17 | **Explore page** - Check listing of tag when sort is descending | Listing of tag when sort is descending |
| 18 | **Explore page** - Check listing of dataProduct when sort is descending | Listing of dataProduct when sort is descending |
| 19 | **Explore page** - Check listing of apiCollection when sort is descending | Listing of apiCollection when sort is descending |
| 20 | **Explore page** - Check listing of apiEndpoint when sort is descending | Listing of apiEndpoint when sort is descending |
| 21 | **Explore page** - Check listing of directory when sort is descending | Listing of directory when sort is descending |
| 22 | **Explore page** - Check listing of file when sort is descending | Listing of file when sort is descending |
| 23 | **Explore page** - Check listing of spreadsheet when sort is descending | Listing of spreadsheet when sort is descending |
| 24 | **Explore page** - Check listing of worksheet when sort is descending | Listing of worksheet when sort is descending |
| 25 | **Explore page** - Copy field link button should copy the field URL to clipboard for SearchIndex | Copy field link button should copy the field URL to clipboard for SearchIndex |
| 26 | **Explore page** - Copy field link button should copy the field URL to clipboard for APIEndpoint | Copy field link button should copy the field URL to clipboard for APIEndpoint |
| 27 | **Explore page** - Copy field link should have valid URL format for SearchIndex | Copy field link should have valid URL format for SearchIndex |
| 28 | **Explore page** - Copy field link should have valid URL format for APIEndpoint | Copy field link should have valid URL format for APIEndpoint |

</details>

<details open>
<summary>📄 <b>ExploreSortOrderFilter.spec.ts</b> (16 tests, 16 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ExploreSortOrderFilter.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreSortOrderFilter.spec.ts)

### Explore Sort Order Filter

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Explore Sort Order Filter** - Table | Table |
| 2 | **Explore Sort Order Filter** - Database | Database |
| 3 | **Explore Sort Order Filter** - Database Schema | Database Schema |
| 4 | **Explore Sort Order Filter** - Dashboard | Dashboard |
| 5 | **Explore Sort Order Filter** - Dashboard Data Model | Dashboard Data Model |
| 6 | **Explore Sort Order Filter** - Pipeline | Pipeline |
| 7 | **Explore Sort Order Filter** - Topic | Topic |
| 8 | **Explore Sort Order Filter** - ML Model | ML Model |
| 9 | **Explore Sort Order Filter** - Container | Container |
| 10 | **Explore Sort Order Filter** - Search Index | Search Index |
| 11 | **Explore Sort Order Filter** - API Endpoint | API Endpoint |
| 12 | **Explore Sort Order Filter** - API Collection | API Collection |
| 13 | **Explore Sort Order Filter** - Stored Procedure | Stored Procedure |
| 14 | **Explore Sort Order Filter** - Glossary Term | Glossary Term |
| 15 | **Explore Sort Order Filter** - Tags | Tags |
| 16 | **Explore Sort Order Filter** - Metrics | Metrics |

</details>

<details open>
<summary>📄 <b>ExploreDiscovery.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ExploreDiscovery.spec.ts)

### Explore Assets Discovery

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Explore Assets Discovery** - Should not display deleted assets when showDeleted is not checked and deleted is not present in queryFilter | Not display deleted assets when showDeleted is not checked and deleted is not present in queryFilter |
| 2 | **Explore Assets Discovery** - Should display deleted assets when showDeleted is not checked but deleted is true in queryFilter | Display deleted assets when showDeleted is not checked but deleted is true in queryFilter |
| 3 | **Explore Assets Discovery** - Should not display deleted assets when showDeleted is not checked but deleted is false in queryFilter | Not display deleted assets when showDeleted is not checked but deleted is false in queryFilter |
| 4 | **Explore Assets Discovery** - Should display deleted assets when showDeleted is checked and deleted is not present in queryFilter | Display deleted assets when showDeleted is checked and deleted is not present in queryFilter |
| 5 | **Explore Assets Discovery** - Should display deleted assets when showDeleted is checked and deleted is true in queryFilter | Display deleted assets when showDeleted is checked and deleted is true in queryFilter |
| 6 | **Explore Assets Discovery** - Should not display deleted assets when showDeleted is checked but deleted is false in queryFilter | Not display deleted assets when showDeleted is checked but deleted is false in queryFilter |
| 7 | **Explore Assets Discovery** - Should not display soft deleted assets in search suggestions | Not display soft deleted assets in search suggestions |
| 8 | **Explore Assets Discovery** - Should not display domain and owner of deleted asset in suggestions when showDeleted is off | Not display domain and owner of deleted asset in suggestions when showDeleted is off |
| 9 | **Explore Assets Discovery** - Should display domain and owner of deleted asset in suggestions when showDeleted is on | Display domain and owner of deleted asset in suggestions when showDeleted is on |

</details>

<details open>
<summary>📄 <b>ExploreQuickFilters.spec.ts</b> (5 tests, 5 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ExploreQuickFilters.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | search dropdown should work properly for quick filters | Search dropdown should work properly for quick filters |
| 2 | should search for empty or null filters | Search for empty or null filters |
| 3 | should show correct count for initial options | Show correct count for initial options |
| 4 | should search for multiple values along with null filters | Search for multiple values along with null filters |
| 5 | should persist quick filter on global search | Persist quick filter on global search |

</details>


---

<div id="home-page"></div>

## Home Page

<details open>
<summary>📄 <b>FollowingWidget.spec.ts</b> (11 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/FollowingWidget.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/FollowingWidget.spec.ts)

### Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Table** - Check followed entity present in following widget | Followed entity present in following widget |

### Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Dashboard** - Check followed entity present in following widget | Followed entity present in following widget |

### Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Pipeline** - Check followed entity present in following widget | Followed entity present in following widget |

### Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Topic** - Check followed entity present in following widget | Followed entity present in following widget |

### Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Container** - Check followed entity present in following widget | Followed entity present in following widget |

### MlModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **MlModel** - Check followed entity present in following widget | Followed entity present in following widget |

### SearchIndex

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SearchIndex** - Check followed entity present in following widget | Followed entity present in following widget |

### ApiEndpoint

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **ApiEndpoint** - Check followed entity present in following widget | Followed entity present in following widget |

### DashboardDataModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **DashboardDataModel** - Check followed entity present in following widget | Followed entity present in following widget |

### Store Procedure

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Store Procedure** - Check followed entity present in following widget | Followed entity present in following widget |

### Metric

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric** - Check followed entity present in following widget | Followed entity present in following widget |

</details>

<details open>
<summary>📄 <b>RecentlyViewed.spec.ts</b> (11 tests, 11 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/RecentlyViewed.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/RecentlyViewed.spec.ts)

### Recently viewed data assets

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Recently viewed data assets** - Check ApiEndpoint in recently viewed | ApiEndpoint in recently viewed |
| 2 | **Recently viewed data assets** - Check Table in recently viewed | Table in recently viewed |
| 3 | **Recently viewed data assets** - Check Store Procedure in recently viewed | Store Procedure in recently viewed |
| 4 | **Recently viewed data assets** - Check Dashboard in recently viewed | Dashboard in recently viewed |
| 5 | **Recently viewed data assets** - Check Pipeline in recently viewed | Pipeline in recently viewed |
| 6 | **Recently viewed data assets** - Check Topic in recently viewed | Topic in recently viewed |
| 7 | **Recently viewed data assets** - Check MlModel in recently viewed | MlModel in recently viewed |
| 8 | **Recently viewed data assets** - Check Container in recently viewed | Container in recently viewed |
| 9 | **Recently viewed data assets** - Check SearchIndex in recently viewed | SearchIndex in recently viewed |
| 10 | **Recently viewed data assets** - Check DashboardDataModel in recently viewed | DashboardDataModel in recently viewed |
| 11 | **Recently viewed data assets** - Check Metric in recently viewed | Metric in recently viewed |

</details>


---

<div id="data-insights"></div>

## Data Insights

<details open>
<summary>📄 <b>DataInsight.spec.ts</b> (8 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataInsight.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataInsight.spec.ts)

### Data Insight Page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Insight Page** - Create description and owner KPI | Create description and owner KPI |
| 2 | **Data Insight Page** - Verifying Data assets tab | Verifying Data assets tab |
| 3 | **Data Insight Page** - Verify No owner and description redirection to explore page | No owner and description redirection to explore page |
| 4 | **Data Insight Page** - Verifying App analytics tab | Verifying App analytics tab |
| 5 | **Data Insight Page** - Verifying KPI tab | Verifying KPI tab |
| 6 | **Data Insight Page** - Update KPI | Update KPI |
| 7 | **Data Insight Page** - Verify KPI widget in Landing page | KPI widget in Landing page |
| 8 | **Data Insight Page** - Delete Kpi | Delete Kpi |

</details>


---

