[🏠 Home](./README.md) > **Discovery**

# Discovery

> **7 Components** | **27 Files** | **367 Tests** | **384 Scenarios** 🚀

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
<summary>📄 <b>Table.spec.ts</b> (11 tests, 11 scenarios)</summary>

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
<summary>📄 <b>ExploreTree.spec.ts</b> (30 tests, 36 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ExploreTree.spec.ts)

### Explore Tree scenarios

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Explore Tree scenarios** - Explore Tree | Explore Tree |
| | ↳ *Check the explore tree* | |
| | ↳ *Check the quick filters* | |
| | ↳ *Click on tree item and check quick filter* | |
| | ↳ *Click on tree item metrics and check quick filter* | |
| 2 | **Explore Tree scenarios** - Verify Database and Database Schema available in explore tree | Database and Database Schema available in explore tree |
| | ↳ *Verify first table database and schema* | |
| | ↳ *Verify second table database and schema* | |
| 3 | **Explore Tree scenarios** - Verify Database and Database schema after rename | Database and Database schema after rename |
| | ↳ *Visit explore page and verify existing values* | |
| | ↳ *Rename schema and database* | |
| | ↳ *Verify renamed values in explore page* | |

### Explore page

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Explore page** - Check the listing of tags | The listing of tags |
| 2 | **Explore page** - Check listing of entities when index is dataAsset | Listing of entities when index is dataAsset |
| 3 | **Explore page** - Check listing of entities when index is all | Listing of entities when index is all |
| 4 | **Explore page** - Check listing of table when sort is descending | Listing of table when sort is descending |
| 5 | **Explore page** - Check listing of storedProcedure when sort is descending | Listing of storedProcedure when sort is descending |
| 6 | **Explore page** - Check listing of database when sort is descending | Listing of database when sort is descending |
| 7 | **Explore page** - Check listing of databaseSchema when sort is descending | Listing of databaseSchema when sort is descending |
| 8 | **Explore page** - Check listing of dashboard when sort is descending | Listing of dashboard when sort is descending |
| 9 | **Explore page** - Check listing of dashboardDataModel when sort is descending | Listing of dashboardDataModel when sort is descending |
| 10 | **Explore page** - Check listing of pipeline when sort is descending | Listing of pipeline when sort is descending |
| 11 | **Explore page** - Check listing of topic when sort is descending | Listing of topic when sort is descending |
| 12 | **Explore page** - Check listing of mlmodel when sort is descending | Listing of mlmodel when sort is descending |
| 13 | **Explore page** - Check listing of container when sort is descending | Listing of container when sort is descending |
| 14 | **Explore page** - Check listing of searchIndex when sort is descending | Listing of searchIndex when sort is descending |
| 15 | **Explore page** - Check listing of glossaryTerm when sort is descending | Listing of glossaryTerm when sort is descending |
| 16 | **Explore page** - Check listing of tag when sort is descending | Listing of tag when sort is descending |
| 17 | **Explore page** - Check listing of dataProduct when sort is descending | Listing of dataProduct when sort is descending |
| 18 | **Explore page** - Check listing of apiCollection when sort is descending | Listing of apiCollection when sort is descending |
| 19 | **Explore page** - Check listing of apiEndpoint when sort is descending | Listing of apiEndpoint when sort is descending |
| 20 | **Explore page** - Check listing of directory when sort is descending | Listing of directory when sort is descending |
| 21 | **Explore page** - Check listing of file when sort is descending | Listing of file when sort is descending |
| 22 | **Explore page** - Check listing of spreadsheet when sort is descending | Listing of spreadsheet when sort is descending |
| 23 | **Explore page** - Check listing of worksheet when sort is descending | Listing of worksheet when sort is descending |
| 24 | **Explore page** - Copy field link button should copy the field URL to clipboard for SearchIndex | Copy field link button should copy the field URL to clipboard for SearchIndex |
| 25 | **Explore page** - Copy field link button should copy the field URL to clipboard for APIEndpoint | Copy field link button should copy the field URL to clipboard for APIEndpoint |
| 26 | **Explore page** - Copy field link should have valid URL format for SearchIndex | Copy field link should have valid URL format for SearchIndex |
| 27 | **Explore page** - Copy field link should have valid URL format for APIEndpoint | Copy field link should have valid URL format for APIEndpoint |

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

