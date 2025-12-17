[🏠 Home](./README.md) > **Integration**

# Integration

> **1 Components** | **7 Files** | **175 Tests**

## Table of Contents
- [Connectors](#connectors)

---

<div id="connectors"></div>

## Connectors

<details open>
<summary>📄 <b>ServiceEntity.spec.ts</b> (140 tests)</summary>

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
| 2 | Delete Api Collection | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 3 | Delete Database Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 4 | Delete Dashboard Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 5 | Delete Messaging Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 6 | Delete Mlmodel Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 7 | Delete Pipeline Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 8 | Delete Search Index Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 9 | Delete Storage Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 10 | Delete Database | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 11 | Delete Database Schema | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |
| 12 | Delete Drive Service | Tests service deletion  Soft deletes the service and then hard deletes it to remove it permanently |

</details>

<details open>
<summary>📄 <b>ServiceEntityPermissions.spec.ts</b> (16 tests)</summary>

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
<summary>📄 <b>ServiceEntityVersionPage.spec.ts</b> (12 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ServiceEntityVersionPage.spec.ts)

### Service Version pages

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service Version pages** - Api Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 2 | **Service Version pages** - Api Collection | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 3 | **Service Version pages** - Dashboard Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 4 | **Service Version pages** - Database Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 5 | **Service Version pages** - Messaging Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 6 | **Service Version pages** - Mlmodel Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 7 | **Service Version pages** - Pipeline Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 8 | **Service Version pages** - SearchIndex Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 9 | **Service Version pages** - Storage Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 10 | **Service Version pages** - Database | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 11 | **Service Version pages** - Database Schema | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |
| 12 | **Service Version pages** - Drive Service | Tests comprehensive version history tracking for service entities  This test validates the version history feature for service entities across multiple version increments. It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for: - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive) - Version 0.3: Owner assignments showing user ownership changes - Version 0.3: Tier assignments displaying tier classification updates - Version 0.4: Soft deletion state with appropriate deleted badge visibility The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered in the UI to highlight what changed between versions |

</details>

<details open>
<summary>📄 <b>ServiceForm.spec.ts</b> (4 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts)

### Service form functionality

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service form functionality** - Verify form selects are working properly | Form selects are working properly |
| 2 | **Service form functionality** - Verify SSL cert upload with long filename and UI overflow handling | SSL cert upload with long filename and UI overflow handling |
| 3 | **Service form functionality** - Verify service name field validation errors | Service name field validation errors |
| 4 | **Service form functionality** - Verify if string input inside oneOf config works properly | If string input inside oneOf config works properly |

</details>

<details open>
<summary>📄 <b>ApiServiceRest.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts)

### API service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **API service** - add update and delete api service type REST | Add update and delete api service type REST |

</details>

<details open>
<summary>📄 <b>IngestionBot.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts)

### Ingestion Bot 

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Ingestion Bot ** - Ingestion bot should be able to access domain specific domain | Ingestion bot should be able to access domain specific domain |

</details>

<details open>
<summary>📄 <b>ServiceListing.spec.ts</b> (1 tests)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts)

### Service Listing

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service Listing** - should render the service listing page | Render the service listing page |

</details>


---

