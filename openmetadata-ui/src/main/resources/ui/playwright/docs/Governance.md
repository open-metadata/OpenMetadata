[🏠 Home](./README.md) > **Governance**

# Governance

> **6 Components** | **26 Files** | **503 Tests** | **933 Scenarios** 🚀

## Table of Contents
- [Custom Properties](#custom-properties)
- [Metrics](#metrics)
- [Glossary](#glossary)
- [Domains & Data Products](#domains-data-products)
- [Tags](#tags)
- [Data Contracts](#data-contracts)

---

<div id="custom-properties"></div>

## Custom Properties

<details open>
<summary>📄 <b>Customproperties-part1.spec.ts</b> (162 tests, 162 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Customproperties-part1.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part1.spec.ts)

### Custom properties without custom property config

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Custom properties without custom property config** - Add Integer custom property for container | Add Integer custom property for container |
| 2 | **Custom properties without custom property config** - Add Integer custom property for dashboard | Add Integer custom property for dashboard |
| 3 | **Custom properties without custom property config** - Add Integer custom property for database | Add Integer custom property for database |
| 4 | **Custom properties without custom property config** - Add Integer custom property for databaseSchema | Add Integer custom property for databaseSchema |
| 5 | **Custom properties without custom property config** - Add Integer custom property for glossaryTerm | Add Integer custom property for glossaryTerm |
| 6 | **Custom properties without custom property config** - Add Integer custom property for mlmodel | Add Integer custom property for mlmodel |
| 7 | **Custom properties without custom property config** - Add Integer custom property for pipeline | Add Integer custom property for pipeline |
| 8 | **Custom properties without custom property config** - Add Integer custom property for searchIndex | Add Integer custom property for searchIndex |
| 9 | **Custom properties without custom property config** - Add Integer custom property for storedProcedure | Add Integer custom property for storedProcedure |
| 10 | **Custom properties without custom property config** - Add Integer custom property for table | Add Integer custom property for table |
| 11 | **Custom properties without custom property config** - Add Integer custom property for topic | Add Integer custom property for topic |
| 12 | **Custom properties without custom property config** - Add Integer custom property for apiCollection | Add Integer custom property for apiCollection |
| 13 | **Custom properties without custom property config** - Add Integer custom property for apiEndpoint | Add Integer custom property for apiEndpoint |
| 14 | **Custom properties without custom property config** - Add Integer custom property for dataProduct | Add Integer custom property for dataProduct |
| 15 | **Custom properties without custom property config** - Add Integer custom property for domain | Add Integer custom property for domain |
| 16 | **Custom properties without custom property config** - Add Integer custom property for dashboardDataModel | Add Integer custom property for dashboardDataModel |
| 17 | **Custom properties without custom property config** - Add Integer custom property for metric | Add Integer custom property for metric |
| 18 | **Custom properties without custom property config** - Add Integer custom property for chart | Add Integer custom property for chart |
| 19 | **Custom properties without custom property config** - Add String custom property for container | Add String custom property for container |
| 20 | **Custom properties without custom property config** - Add String custom property for dashboard | Add String custom property for dashboard |
| 21 | **Custom properties without custom property config** - Add String custom property for database | Add String custom property for database |
| 22 | **Custom properties without custom property config** - Add String custom property for databaseSchema | Add String custom property for databaseSchema |
| 23 | **Custom properties without custom property config** - Add String custom property for glossaryTerm | Add String custom property for glossaryTerm |
| 24 | **Custom properties without custom property config** - Add String custom property for mlmodel | Add String custom property for mlmodel |
| 25 | **Custom properties without custom property config** - Add String custom property for pipeline | Add String custom property for pipeline |
| 26 | **Custom properties without custom property config** - Add String custom property for searchIndex | Add String custom property for searchIndex |
| 27 | **Custom properties without custom property config** - Add String custom property for storedProcedure | Add String custom property for storedProcedure |
| 28 | **Custom properties without custom property config** - Add String custom property for table | Add String custom property for table |
| 29 | **Custom properties without custom property config** - Add String custom property for topic | Add String custom property for topic |
| 30 | **Custom properties without custom property config** - Add String custom property for apiCollection | Add String custom property for apiCollection |
| 31 | **Custom properties without custom property config** - Add String custom property for apiEndpoint | Add String custom property for apiEndpoint |
| 32 | **Custom properties without custom property config** - Add String custom property for dataProduct | Add String custom property for dataProduct |
| 33 | **Custom properties without custom property config** - Add String custom property for domain | Add String custom property for domain |
| 34 | **Custom properties without custom property config** - Add String custom property for dashboardDataModel | Add String custom property for dashboardDataModel |
| 35 | **Custom properties without custom property config** - Add String custom property for metric | Add String custom property for metric |
| 36 | **Custom properties without custom property config** - Add String custom property for chart | Add String custom property for chart |
| 37 | **Custom properties without custom property config** - Add Markdown custom property for container | Add Markdown custom property for container |
| 38 | **Custom properties without custom property config** - Add Markdown custom property for dashboard | Add Markdown custom property for dashboard |
| 39 | **Custom properties without custom property config** - Add Markdown custom property for database | Add Markdown custom property for database |
| 40 | **Custom properties without custom property config** - Add Markdown custom property for databaseSchema | Add Markdown custom property for databaseSchema |
| 41 | **Custom properties without custom property config** - Add Markdown custom property for glossaryTerm | Add Markdown custom property for glossaryTerm |
| 42 | **Custom properties without custom property config** - Add Markdown custom property for mlmodel | Add Markdown custom property for mlmodel |
| 43 | **Custom properties without custom property config** - Add Markdown custom property for pipeline | Add Markdown custom property for pipeline |
| 44 | **Custom properties without custom property config** - Add Markdown custom property for searchIndex | Add Markdown custom property for searchIndex |
| 45 | **Custom properties without custom property config** - Add Markdown custom property for storedProcedure | Add Markdown custom property for storedProcedure |
| 46 | **Custom properties without custom property config** - Add Markdown custom property for table | Add Markdown custom property for table |
| 47 | **Custom properties without custom property config** - Add Markdown custom property for topic | Add Markdown custom property for topic |
| 48 | **Custom properties without custom property config** - Add Markdown custom property for apiCollection | Add Markdown custom property for apiCollection |
| 49 | **Custom properties without custom property config** - Add Markdown custom property for apiEndpoint | Add Markdown custom property for apiEndpoint |
| 50 | **Custom properties without custom property config** - Add Markdown custom property for dataProduct | Add Markdown custom property for dataProduct |
| 51 | **Custom properties without custom property config** - Add Markdown custom property for domain | Add Markdown custom property for domain |
| 52 | **Custom properties without custom property config** - Add Markdown custom property for dashboardDataModel | Add Markdown custom property for dashboardDataModel |
| 53 | **Custom properties without custom property config** - Add Markdown custom property for metric | Add Markdown custom property for metric |
| 54 | **Custom properties without custom property config** - Add Markdown custom property for chart | Add Markdown custom property for chart |
| 55 | **Custom properties without custom property config** - Add Duration custom property for container | Add Duration custom property for container |
| 56 | **Custom properties without custom property config** - Add Duration custom property for dashboard | Add Duration custom property for dashboard |
| 57 | **Custom properties without custom property config** - Add Duration custom property for database | Add Duration custom property for database |
| 58 | **Custom properties without custom property config** - Add Duration custom property for databaseSchema | Add Duration custom property for databaseSchema |
| 59 | **Custom properties without custom property config** - Add Duration custom property for glossaryTerm | Add Duration custom property for glossaryTerm |
| 60 | **Custom properties without custom property config** - Add Duration custom property for mlmodel | Add Duration custom property for mlmodel |
| 61 | **Custom properties without custom property config** - Add Duration custom property for pipeline | Add Duration custom property for pipeline |
| 62 | **Custom properties without custom property config** - Add Duration custom property for searchIndex | Add Duration custom property for searchIndex |
| 63 | **Custom properties without custom property config** - Add Duration custom property for storedProcedure | Add Duration custom property for storedProcedure |
| 64 | **Custom properties without custom property config** - Add Duration custom property for table | Add Duration custom property for table |
| 65 | **Custom properties without custom property config** - Add Duration custom property for topic | Add Duration custom property for topic |
| 66 | **Custom properties without custom property config** - Add Duration custom property for apiCollection | Add Duration custom property for apiCollection |
| 67 | **Custom properties without custom property config** - Add Duration custom property for apiEndpoint | Add Duration custom property for apiEndpoint |
| 68 | **Custom properties without custom property config** - Add Duration custom property for dataProduct | Add Duration custom property for dataProduct |
| 69 | **Custom properties without custom property config** - Add Duration custom property for domain | Add Duration custom property for domain |
| 70 | **Custom properties without custom property config** - Add Duration custom property for dashboardDataModel | Add Duration custom property for dashboardDataModel |
| 71 | **Custom properties without custom property config** - Add Duration custom property for metric | Add Duration custom property for metric |
| 72 | **Custom properties without custom property config** - Add Duration custom property for chart | Add Duration custom property for chart |
| 73 | **Custom properties without custom property config** - Add Email custom property for container | Add Email custom property for container |
| 74 | **Custom properties without custom property config** - Add Email custom property for dashboard | Add Email custom property for dashboard |
| 75 | **Custom properties without custom property config** - Add Email custom property for database | Add Email custom property for database |
| 76 | **Custom properties without custom property config** - Add Email custom property for databaseSchema | Add Email custom property for databaseSchema |
| 77 | **Custom properties without custom property config** - Add Email custom property for glossaryTerm | Add Email custom property for glossaryTerm |
| 78 | **Custom properties without custom property config** - Add Email custom property for mlmodel | Add Email custom property for mlmodel |
| 79 | **Custom properties without custom property config** - Add Email custom property for pipeline | Add Email custom property for pipeline |
| 80 | **Custom properties without custom property config** - Add Email custom property for searchIndex | Add Email custom property for searchIndex |
| 81 | **Custom properties without custom property config** - Add Email custom property for storedProcedure | Add Email custom property for storedProcedure |
| 82 | **Custom properties without custom property config** - Add Email custom property for table | Add Email custom property for table |
| 83 | **Custom properties without custom property config** - Add Email custom property for topic | Add Email custom property for topic |
| 84 | **Custom properties without custom property config** - Add Email custom property for apiCollection | Add Email custom property for apiCollection |
| 85 | **Custom properties without custom property config** - Add Email custom property for apiEndpoint | Add Email custom property for apiEndpoint |
| 86 | **Custom properties without custom property config** - Add Email custom property for dataProduct | Add Email custom property for dataProduct |
| 87 | **Custom properties without custom property config** - Add Email custom property for domain | Add Email custom property for domain |
| 88 | **Custom properties without custom property config** - Add Email custom property for dashboardDataModel | Add Email custom property for dashboardDataModel |
| 89 | **Custom properties without custom property config** - Add Email custom property for metric | Add Email custom property for metric |
| 90 | **Custom properties without custom property config** - Add Email custom property for chart | Add Email custom property for chart |
| 91 | **Custom properties without custom property config** - Add Number custom property for container | Add Number custom property for container |
| 92 | **Custom properties without custom property config** - Add Number custom property for dashboard | Add Number custom property for dashboard |
| 93 | **Custom properties without custom property config** - Add Number custom property for database | Add Number custom property for database |
| 94 | **Custom properties without custom property config** - Add Number custom property for databaseSchema | Add Number custom property for databaseSchema |
| 95 | **Custom properties without custom property config** - Add Number custom property for glossaryTerm | Add Number custom property for glossaryTerm |
| 96 | **Custom properties without custom property config** - Add Number custom property for mlmodel | Add Number custom property for mlmodel |
| 97 | **Custom properties without custom property config** - Add Number custom property for pipeline | Add Number custom property for pipeline |
| 98 | **Custom properties without custom property config** - Add Number custom property for searchIndex | Add Number custom property for searchIndex |
| 99 | **Custom properties without custom property config** - Add Number custom property for storedProcedure | Add Number custom property for storedProcedure |
| 100 | **Custom properties without custom property config** - Add Number custom property for table | Add Number custom property for table |
| 101 | **Custom properties without custom property config** - Add Number custom property for topic | Add Number custom property for topic |
| 102 | **Custom properties without custom property config** - Add Number custom property for apiCollection | Add Number custom property for apiCollection |
| 103 | **Custom properties without custom property config** - Add Number custom property for apiEndpoint | Add Number custom property for apiEndpoint |
| 104 | **Custom properties without custom property config** - Add Number custom property for dataProduct | Add Number custom property for dataProduct |
| 105 | **Custom properties without custom property config** - Add Number custom property for domain | Add Number custom property for domain |
| 106 | **Custom properties without custom property config** - Add Number custom property for dashboardDataModel | Add Number custom property for dashboardDataModel |
| 107 | **Custom properties without custom property config** - Add Number custom property for metric | Add Number custom property for metric |
| 108 | **Custom properties without custom property config** - Add Number custom property for chart | Add Number custom property for chart |
| 109 | **Custom properties without custom property config** - Add Sql Query custom property for container | Add Sql Query custom property for container |
| 110 | **Custom properties without custom property config** - Add Sql Query custom property for dashboard | Add Sql Query custom property for dashboard |
| 111 | **Custom properties without custom property config** - Add Sql Query custom property for database | Add Sql Query custom property for database |
| 112 | **Custom properties without custom property config** - Add Sql Query custom property for databaseSchema | Add Sql Query custom property for databaseSchema |
| 113 | **Custom properties without custom property config** - Add Sql Query custom property for glossaryTerm | Add Sql Query custom property for glossaryTerm |
| 114 | **Custom properties without custom property config** - Add Sql Query custom property for mlmodel | Add Sql Query custom property for mlmodel |
| 115 | **Custom properties without custom property config** - Add Sql Query custom property for pipeline | Add Sql Query custom property for pipeline |
| 116 | **Custom properties without custom property config** - Add Sql Query custom property for searchIndex | Add Sql Query custom property for searchIndex |
| 117 | **Custom properties without custom property config** - Add Sql Query custom property for storedProcedure | Add Sql Query custom property for storedProcedure |
| 118 | **Custom properties without custom property config** - Add Sql Query custom property for table | Add Sql Query custom property for table |
| 119 | **Custom properties without custom property config** - Add Sql Query custom property for topic | Add Sql Query custom property for topic |
| 120 | **Custom properties without custom property config** - Add Sql Query custom property for apiCollection | Add Sql Query custom property for apiCollection |
| 121 | **Custom properties without custom property config** - Add Sql Query custom property for apiEndpoint | Add Sql Query custom property for apiEndpoint |
| 122 | **Custom properties without custom property config** - Add Sql Query custom property for dataProduct | Add Sql Query custom property for dataProduct |
| 123 | **Custom properties without custom property config** - Add Sql Query custom property for domain | Add Sql Query custom property for domain |
| 124 | **Custom properties without custom property config** - Add Sql Query custom property for dashboardDataModel | Add Sql Query custom property for dashboardDataModel |
| 125 | **Custom properties without custom property config** - Add Sql Query custom property for metric | Add Sql Query custom property for metric |
| 126 | **Custom properties without custom property config** - Add Sql Query custom property for chart | Add Sql Query custom property for chart |
| 127 | **Custom properties without custom property config** - Add Time Interval custom property for container | Add Time Interval custom property for container |
| 128 | **Custom properties without custom property config** - Add Time Interval custom property for dashboard | Add Time Interval custom property for dashboard |
| 129 | **Custom properties without custom property config** - Add Time Interval custom property for database | Add Time Interval custom property for database |
| 130 | **Custom properties without custom property config** - Add Time Interval custom property for databaseSchema | Add Time Interval custom property for databaseSchema |
| 131 | **Custom properties without custom property config** - Add Time Interval custom property for glossaryTerm | Add Time Interval custom property for glossaryTerm |
| 132 | **Custom properties without custom property config** - Add Time Interval custom property for mlmodel | Add Time Interval custom property for mlmodel |
| 133 | **Custom properties without custom property config** - Add Time Interval custom property for pipeline | Add Time Interval custom property for pipeline |
| 134 | **Custom properties without custom property config** - Add Time Interval custom property for searchIndex | Add Time Interval custom property for searchIndex |
| 135 | **Custom properties without custom property config** - Add Time Interval custom property for storedProcedure | Add Time Interval custom property for storedProcedure |
| 136 | **Custom properties without custom property config** - Add Time Interval custom property for table | Add Time Interval custom property for table |
| 137 | **Custom properties without custom property config** - Add Time Interval custom property for topic | Add Time Interval custom property for topic |
| 138 | **Custom properties without custom property config** - Add Time Interval custom property for apiCollection | Add Time Interval custom property for apiCollection |
| 139 | **Custom properties without custom property config** - Add Time Interval custom property for apiEndpoint | Add Time Interval custom property for apiEndpoint |
| 140 | **Custom properties without custom property config** - Add Time Interval custom property for dataProduct | Add Time Interval custom property for dataProduct |
| 141 | **Custom properties without custom property config** - Add Time Interval custom property for domain | Add Time Interval custom property for domain |
| 142 | **Custom properties without custom property config** - Add Time Interval custom property for dashboardDataModel | Add Time Interval custom property for dashboardDataModel |
| 143 | **Custom properties without custom property config** - Add Time Interval custom property for metric | Add Time Interval custom property for metric |
| 144 | **Custom properties without custom property config** - Add Time Interval custom property for chart | Add Time Interval custom property for chart |
| 145 | **Custom properties without custom property config** - Add Timestamp custom property for container | Add Timestamp custom property for container |
| 146 | **Custom properties without custom property config** - Add Timestamp custom property for dashboard | Add Timestamp custom property for dashboard |
| 147 | **Custom properties without custom property config** - Add Timestamp custom property for database | Add Timestamp custom property for database |
| 148 | **Custom properties without custom property config** - Add Timestamp custom property for databaseSchema | Add Timestamp custom property for databaseSchema |
| 149 | **Custom properties without custom property config** - Add Timestamp custom property for glossaryTerm | Add Timestamp custom property for glossaryTerm |
| 150 | **Custom properties without custom property config** - Add Timestamp custom property for mlmodel | Add Timestamp custom property for mlmodel |
| 151 | **Custom properties without custom property config** - Add Timestamp custom property for pipeline | Add Timestamp custom property for pipeline |
| 152 | **Custom properties without custom property config** - Add Timestamp custom property for searchIndex | Add Timestamp custom property for searchIndex |
| 153 | **Custom properties without custom property config** - Add Timestamp custom property for storedProcedure | Add Timestamp custom property for storedProcedure |
| 154 | **Custom properties without custom property config** - Add Timestamp custom property for table | Add Timestamp custom property for table |
| 155 | **Custom properties without custom property config** - Add Timestamp custom property for topic | Add Timestamp custom property for topic |
| 156 | **Custom properties without custom property config** - Add Timestamp custom property for apiCollection | Add Timestamp custom property for apiCollection |
| 157 | **Custom properties without custom property config** - Add Timestamp custom property for apiEndpoint | Add Timestamp custom property for apiEndpoint |
| 158 | **Custom properties without custom property config** - Add Timestamp custom property for dataProduct | Add Timestamp custom property for dataProduct |
| 159 | **Custom properties without custom property config** - Add Timestamp custom property for domain | Add Timestamp custom property for domain |
| 160 | **Custom properties without custom property config** - Add Timestamp custom property for dashboardDataModel | Add Timestamp custom property for dashboardDataModel |
| 161 | **Custom properties without custom property config** - Add Timestamp custom property for metric | Add Timestamp custom property for metric |
| 162 | **Custom properties without custom property config** - Add Timestamp custom property for chart | Add Timestamp custom property for chart |

</details>

<details open>
<summary>📄 <b>Customproperties-part2.spec.ts</b> (126 tests, 126 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Customproperties-part2.spec.ts)

### Custom properties with custom property config

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Custom properties with custom property config** - Add Enum custom property for container | Add Enum custom property for container |
| 2 | **Custom properties with custom property config** - Add Enum custom property for dashboard | Add Enum custom property for dashboard |
| 3 | **Custom properties with custom property config** - Add Enum custom property for database | Add Enum custom property for database |
| 4 | **Custom properties with custom property config** - Add Enum custom property for databaseSchema | Add Enum custom property for databaseSchema |
| 5 | **Custom properties with custom property config** - Add Enum custom property for glossaryTerm | Add Enum custom property for glossaryTerm |
| 6 | **Custom properties with custom property config** - Add Enum custom property for mlmodel | Add Enum custom property for mlmodel |
| 7 | **Custom properties with custom property config** - Add Enum custom property for pipeline | Add Enum custom property for pipeline |
| 8 | **Custom properties with custom property config** - Add Enum custom property for searchIndex | Add Enum custom property for searchIndex |
| 9 | **Custom properties with custom property config** - Add Enum custom property for storedProcedure | Add Enum custom property for storedProcedure |
| 10 | **Custom properties with custom property config** - Add Enum custom property for table | Add Enum custom property for table |
| 11 | **Custom properties with custom property config** - Add Enum custom property for topic | Add Enum custom property for topic |
| 12 | **Custom properties with custom property config** - Add Enum custom property for apiCollection | Add Enum custom property for apiCollection |
| 13 | **Custom properties with custom property config** - Add Enum custom property for apiEndpoint | Add Enum custom property for apiEndpoint |
| 14 | **Custom properties with custom property config** - Add Enum custom property for dataProduct | Add Enum custom property for dataProduct |
| 15 | **Custom properties with custom property config** - Add Enum custom property for domain | Add Enum custom property for domain |
| 16 | **Custom properties with custom property config** - Add Enum custom property for dashboardDataModel | Add Enum custom property for dashboardDataModel |
| 17 | **Custom properties with custom property config** - Add Enum custom property for metric | Add Enum custom property for metric |
| 18 | **Custom properties with custom property config** - Add Enum custom property for chart | Add Enum custom property for chart |
| 19 | **Custom properties with custom property config** - Add Table custom property for container | Add Table custom property for container |
| 20 | **Custom properties with custom property config** - Add Table custom property for dashboard | Add Table custom property for dashboard |
| 21 | **Custom properties with custom property config** - Add Table custom property for database | Add Table custom property for database |
| 22 | **Custom properties with custom property config** - Add Table custom property for databaseSchema | Add Table custom property for databaseSchema |
| 23 | **Custom properties with custom property config** - Add Table custom property for glossaryTerm | Add Table custom property for glossaryTerm |
| 24 | **Custom properties with custom property config** - Add Table custom property for mlmodel | Add Table custom property for mlmodel |
| 25 | **Custom properties with custom property config** - Add Table custom property for pipeline | Add Table custom property for pipeline |
| 26 | **Custom properties with custom property config** - Add Table custom property for searchIndex | Add Table custom property for searchIndex |
| 27 | **Custom properties with custom property config** - Add Table custom property for storedProcedure | Add Table custom property for storedProcedure |
| 28 | **Custom properties with custom property config** - Add Table custom property for table | Add Table custom property for table |
| 29 | **Custom properties with custom property config** - Add Table custom property for topic | Add Table custom property for topic |
| 30 | **Custom properties with custom property config** - Add Table custom property for apiCollection | Add Table custom property for apiCollection |
| 31 | **Custom properties with custom property config** - Add Table custom property for apiEndpoint | Add Table custom property for apiEndpoint |
| 32 | **Custom properties with custom property config** - Add Table custom property for dataProduct | Add Table custom property for dataProduct |
| 33 | **Custom properties with custom property config** - Add Table custom property for domain | Add Table custom property for domain |
| 34 | **Custom properties with custom property config** - Add Table custom property for dashboardDataModel | Add Table custom property for dashboardDataModel |
| 35 | **Custom properties with custom property config** - Add Table custom property for metric | Add Table custom property for metric |
| 36 | **Custom properties with custom property config** - Add Table custom property for chart | Add Table custom property for chart |
| 37 | **Custom properties with custom property config** - Add Entity Reference custom property for container | Add Entity Reference custom property for container |
| 38 | **Custom properties with custom property config** - Add Entity Reference custom property for dashboard | Add Entity Reference custom property for dashboard |
| 39 | **Custom properties with custom property config** - Add Entity Reference custom property for database | Add Entity Reference custom property for database |
| 40 | **Custom properties with custom property config** - Add Entity Reference custom property for databaseSchema | Add Entity Reference custom property for databaseSchema |
| 41 | **Custom properties with custom property config** - Add Entity Reference custom property for glossaryTerm | Add Entity Reference custom property for glossaryTerm |
| 42 | **Custom properties with custom property config** - Add Entity Reference custom property for mlmodel | Add Entity Reference custom property for mlmodel |
| 43 | **Custom properties with custom property config** - Add Entity Reference custom property for pipeline | Add Entity Reference custom property for pipeline |
| 44 | **Custom properties with custom property config** - Add Entity Reference custom property for searchIndex | Add Entity Reference custom property for searchIndex |
| 45 | **Custom properties with custom property config** - Add Entity Reference custom property for storedProcedure | Add Entity Reference custom property for storedProcedure |
| 46 | **Custom properties with custom property config** - Add Entity Reference custom property for table | Add Entity Reference custom property for table |
| 47 | **Custom properties with custom property config** - Add Entity Reference custom property for topic | Add Entity Reference custom property for topic |
| 48 | **Custom properties with custom property config** - Add Entity Reference custom property for apiCollection | Add Entity Reference custom property for apiCollection |
| 49 | **Custom properties with custom property config** - Add Entity Reference custom property for apiEndpoint | Add Entity Reference custom property for apiEndpoint |
| 50 | **Custom properties with custom property config** - Add Entity Reference custom property for dataProduct | Add Entity Reference custom property for dataProduct |
| 51 | **Custom properties with custom property config** - Add Entity Reference custom property for domain | Add Entity Reference custom property for domain |
| 52 | **Custom properties with custom property config** - Add Entity Reference custom property for dashboardDataModel | Add Entity Reference custom property for dashboardDataModel |
| 53 | **Custom properties with custom property config** - Add Entity Reference custom property for metric | Add Entity Reference custom property for metric |
| 54 | **Custom properties with custom property config** - Add Entity Reference custom property for chart | Add Entity Reference custom property for chart |
| 55 | **Custom properties with custom property config** - Add Entity Reference list custom property for container | Add Entity Reference list custom property for container |
| 56 | **Custom properties with custom property config** - Add Entity Reference list custom property for dashboard | Add Entity Reference list custom property for dashboard |
| 57 | **Custom properties with custom property config** - Add Entity Reference list custom property for database | Add Entity Reference list custom property for database |
| 58 | **Custom properties with custom property config** - Add Entity Reference list custom property for databaseSchema | Add Entity Reference list custom property for databaseSchema |
| 59 | **Custom properties with custom property config** - Add Entity Reference list custom property for glossaryTerm | Add Entity Reference list custom property for glossaryTerm |
| 60 | **Custom properties with custom property config** - Add Entity Reference list custom property for mlmodel | Add Entity Reference list custom property for mlmodel |
| 61 | **Custom properties with custom property config** - Add Entity Reference list custom property for pipeline | Add Entity Reference list custom property for pipeline |
| 62 | **Custom properties with custom property config** - Add Entity Reference list custom property for searchIndex | Add Entity Reference list custom property for searchIndex |
| 63 | **Custom properties with custom property config** - Add Entity Reference list custom property for storedProcedure | Add Entity Reference list custom property for storedProcedure |
| 64 | **Custom properties with custom property config** - Add Entity Reference list custom property for table | Add Entity Reference list custom property for table |
| 65 | **Custom properties with custom property config** - Add Entity Reference list custom property for topic | Add Entity Reference list custom property for topic |
| 66 | **Custom properties with custom property config** - Add Entity Reference list custom property for apiCollection | Add Entity Reference list custom property for apiCollection |
| 67 | **Custom properties with custom property config** - Add Entity Reference list custom property for apiEndpoint | Add Entity Reference list custom property for apiEndpoint |
| 68 | **Custom properties with custom property config** - Add Entity Reference list custom property for dataProduct | Add Entity Reference list custom property for dataProduct |
| 69 | **Custom properties with custom property config** - Add Entity Reference list custom property for domain | Add Entity Reference list custom property for domain |
| 70 | **Custom properties with custom property config** - Add Entity Reference list custom property for dashboardDataModel | Add Entity Reference list custom property for dashboardDataModel |
| 71 | **Custom properties with custom property config** - Add Entity Reference list custom property for metric | Add Entity Reference list custom property for metric |
| 72 | **Custom properties with custom property config** - Add Entity Reference list custom property for chart | Add Entity Reference list custom property for chart |
| 73 | **Custom properties with custom property config** - Add Date custom property for container | Add Date custom property for container |
| 74 | **Custom properties with custom property config** - Add Date custom property for dashboard | Add Date custom property for dashboard |
| 75 | **Custom properties with custom property config** - Add Date custom property for database | Add Date custom property for database |
| 76 | **Custom properties with custom property config** - Add Date custom property for databaseSchema | Add Date custom property for databaseSchema |
| 77 | **Custom properties with custom property config** - Add Date custom property for glossaryTerm | Add Date custom property for glossaryTerm |
| 78 | **Custom properties with custom property config** - Add Date custom property for mlmodel | Add Date custom property for mlmodel |
| 79 | **Custom properties with custom property config** - Add Date custom property for pipeline | Add Date custom property for pipeline |
| 80 | **Custom properties with custom property config** - Add Date custom property for searchIndex | Add Date custom property for searchIndex |
| 81 | **Custom properties with custom property config** - Add Date custom property for storedProcedure | Add Date custom property for storedProcedure |
| 82 | **Custom properties with custom property config** - Add Date custom property for table | Add Date custom property for table |
| 83 | **Custom properties with custom property config** - Add Date custom property for topic | Add Date custom property for topic |
| 84 | **Custom properties with custom property config** - Add Date custom property for apiCollection | Add Date custom property for apiCollection |
| 85 | **Custom properties with custom property config** - Add Date custom property for apiEndpoint | Add Date custom property for apiEndpoint |
| 86 | **Custom properties with custom property config** - Add Date custom property for dataProduct | Add Date custom property for dataProduct |
| 87 | **Custom properties with custom property config** - Add Date custom property for domain | Add Date custom property for domain |
| 88 | **Custom properties with custom property config** - Add Date custom property for dashboardDataModel | Add Date custom property for dashboardDataModel |
| 89 | **Custom properties with custom property config** - Add Date custom property for metric | Add Date custom property for metric |
| 90 | **Custom properties with custom property config** - Add Date custom property for chart | Add Date custom property for chart |
| 91 | **Custom properties with custom property config** - Add Time custom property for container | Add Time custom property for container |
| 92 | **Custom properties with custom property config** - Add Time custom property for dashboard | Add Time custom property for dashboard |
| 93 | **Custom properties with custom property config** - Add Time custom property for database | Add Time custom property for database |
| 94 | **Custom properties with custom property config** - Add Time custom property for databaseSchema | Add Time custom property for databaseSchema |
| 95 | **Custom properties with custom property config** - Add Time custom property for glossaryTerm | Add Time custom property for glossaryTerm |
| 96 | **Custom properties with custom property config** - Add Time custom property for mlmodel | Add Time custom property for mlmodel |
| 97 | **Custom properties with custom property config** - Add Time custom property for pipeline | Add Time custom property for pipeline |
| 98 | **Custom properties with custom property config** - Add Time custom property for searchIndex | Add Time custom property for searchIndex |
| 99 | **Custom properties with custom property config** - Add Time custom property for storedProcedure | Add Time custom property for storedProcedure |
| 100 | **Custom properties with custom property config** - Add Time custom property for table | Add Time custom property for table |
| 101 | **Custom properties with custom property config** - Add Time custom property for topic | Add Time custom property for topic |
| 102 | **Custom properties with custom property config** - Add Time custom property for apiCollection | Add Time custom property for apiCollection |
| 103 | **Custom properties with custom property config** - Add Time custom property for apiEndpoint | Add Time custom property for apiEndpoint |
| 104 | **Custom properties with custom property config** - Add Time custom property for dataProduct | Add Time custom property for dataProduct |
| 105 | **Custom properties with custom property config** - Add Time custom property for domain | Add Time custom property for domain |
| 106 | **Custom properties with custom property config** - Add Time custom property for dashboardDataModel | Add Time custom property for dashboardDataModel |
| 107 | **Custom properties with custom property config** - Add Time custom property for metric | Add Time custom property for metric |
| 108 | **Custom properties with custom property config** - Add Time custom property for chart | Add Time custom property for chart |
| 109 | **Custom properties with custom property config** - Add DateTime custom property for container | Add DateTime custom property for container |
| 110 | **Custom properties with custom property config** - Add DateTime custom property for dashboard | Add DateTime custom property for dashboard |
| 111 | **Custom properties with custom property config** - Add DateTime custom property for database | Add DateTime custom property for database |
| 112 | **Custom properties with custom property config** - Add DateTime custom property for databaseSchema | Add DateTime custom property for databaseSchema |
| 113 | **Custom properties with custom property config** - Add DateTime custom property for glossaryTerm | Add DateTime custom property for glossaryTerm |
| 114 | **Custom properties with custom property config** - Add DateTime custom property for mlmodel | Add DateTime custom property for mlmodel |
| 115 | **Custom properties with custom property config** - Add DateTime custom property for pipeline | Add DateTime custom property for pipeline |
| 116 | **Custom properties with custom property config** - Add DateTime custom property for searchIndex | Add DateTime custom property for searchIndex |
| 117 | **Custom properties with custom property config** - Add DateTime custom property for storedProcedure | Add DateTime custom property for storedProcedure |
| 118 | **Custom properties with custom property config** - Add DateTime custom property for table | Add DateTime custom property for table |
| 119 | **Custom properties with custom property config** - Add DateTime custom property for topic | Add DateTime custom property for topic |
| 120 | **Custom properties with custom property config** - Add DateTime custom property for apiCollection | Add DateTime custom property for apiCollection |
| 121 | **Custom properties with custom property config** - Add DateTime custom property for apiEndpoint | Add DateTime custom property for apiEndpoint |
| 122 | **Custom properties with custom property config** - Add DateTime custom property for dataProduct | Add DateTime custom property for dataProduct |
| 123 | **Custom properties with custom property config** - Add DateTime custom property for domain | Add DateTime custom property for domain |
| 124 | **Custom properties with custom property config** - Add DateTime custom property for dashboardDataModel | Add DateTime custom property for dashboardDataModel |
| 125 | **Custom properties with custom property config** - Add DateTime custom property for metric | Add DateTime custom property for metric |
| 126 | **Custom properties with custom property config** - Add DateTime custom property for chart | Add DateTime custom property for chart |

</details>

<details open>
<summary>📄 <b>CustomPropertySearchSettings.spec.ts</b> (3 tests, 10 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomPropertySearchSettings.spec.ts)

### Custom Property Search Settings

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Custom Property Search Settings** - Create custom properties and configure search for Dashboard | Create custom properties and configure search for Dashboard |
| | ↳ *Create and assign custom property to Dashboard* | |
| | ↳ *Configure search settings for Dashboard custom property* | |
| | ↳ *Search for Dashboard using custom property value* | |
| | ↳ *Verify dashboard is indexed* | |
| | ↳ *Search for Dashboard using custom property value* | |
| 2 | **Custom Property Search Settings** - Create custom properties and configure search for Pipeline | Create custom properties and configure search for Pipeline |
| | ↳ *Create and assign custom property to Pipeline* | |
| | ↳ *Configure search settings for Pipeline custom property* | |
| | ↳ *Search for Pipeline using custom property value* | |
| 3 | **Custom Property Search Settings** - Verify custom property fields are persisted in search settings | Custom property fields are persisted in search settings |
| | ↳ *Verify Dashboard custom property persists* | |
| | ↳ *Verify Pipeline custom property persists* | |

</details>

<details open>
<summary>📄 <b>AdvanceSearchCustomProperty.spec.ts</b> (1 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AdvanceSearchCustomProperty.spec.ts)

### Advanced Search Custom Property

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Advanced Search Custom Property** - Create, Assign and Test Advance Search for Duration | Create, Assign and Test Advance Search for Duration |
| | ↳ *Create and Assign Custom Property Value* | |
| | ↳ *Verify Duration Type in Advance Search * | |

</details>

<details open>
<summary>📄 <b>CustomPropertyAdvanceSeach.spec.ts</b> (1 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/AdvanceSearchFilter/CustomPropertyAdvanceSeach.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/AdvanceSearchFilter/CustomPropertyAdvanceSeach.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | CustomProperty Dashboard Filter | CustomProperty Dashboard Filter |
| | ↳ *Create Dashboard Custom Property* | |
| | ↳ *Add Custom Property in Dashboard* | |
| | ↳ *Filter Dashboard using AdvanceSearch Custom Property* | |
| | ↳ *Delete Custom Property * | |

</details>


---

<div id="metrics"></div>

## Metrics

<details open>
<summary>📄 <b>Metric.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/Metric.spec.ts)

### Metric Entity Special Test Cases

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric Entity Special Test Cases** - Verify Metric Type Update | Metric Type Update |
| 2 | **Metric Entity Special Test Cases** - Verify Unit of Measurement Update | Unit of Measurement Update |
| 3 | **Metric Entity Special Test Cases** - Verify Granularity Update | Granularity Update |
| 4 | **Metric Entity Special Test Cases** - verify metric expression update | Metric expression update |
| 5 | **Metric Entity Special Test Cases** - Verify Related Metrics Update | Related Metrics Update |

### Listing page and add Metric flow should work

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Listing page and add Metric flow should work** - Metric listing page and add metric from the "Add button" | Metric listing page and add metric from the "Add button" |

</details>

<details open>
<summary>📄 <b>CustomMetric.spec.ts</b> (2 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/CustomMetric.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Table custom metric | Table custom metric |
| | ↳ *Create* | |
| | ↳ *Delete* | |
| 2 | Column custom metric | Column custom metric |
| | ↳ *Create* | |
| | ↳ *Delete* | |

</details>

<details open>
<summary>📄 <b>MetricCustomUnitFlow.spec.ts</b> (1 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MetricCustomUnitFlow.spec.ts)

### Metric Custom Unit of Measurement Flow

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metric Custom Unit of Measurement Flow** - Should create metric and test unit of measurement updates | Create metric and test unit of measurement updates |
| | ↳ *Navigate to Metrics and create a metric* | |
| | ↳ *Verify initial unit of measurement is displayed* | |
| | ↳ *Update unit of measurement to Dollars* | |
| | ↳ *Remove unit of measurement* | |
| | ↳ *Set unit back to Percentage* | |
| | ↳ *Clean up - delete the metric* | |

</details>


---

<div id="glossary"></div>

## Glossary

<details open>
<summary>📄 <b>Glossary.spec.ts</b> (35 tests, 59 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts)

### Glossary tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary tests** - Glossary & terms creation for reviewer as user | Glossary & terms creation for reviewer as user |
| | ↳ *Create Glossary* | |
| | ↳ *Create Glossary Terms* | |
| | ↳ *Approve Glossary Term from Glossary Listing for reviewer user* | |
| 2 | **Glossary tests** - Glossary & terms creation for reviewer as team | Glossary & terms creation for reviewer as team |
| | ↳ *Create Glossary* | |
| | ↳ *Create Glossary Terms* | |
| | ↳ *Approve Glossary Term from Glossary Listing for reviewer team* | |
| 3 | **Glossary tests** - Update Glossary and Glossary Term | Update Glossary and Glossary Term |
| | ↳ *Update Glossary* | |
| | ↳ *Update Glossary Term* | |
| 4 | **Glossary tests** - Add, Update and Verify Data Glossary Term | Add, Update and Verify Data Glossary Term |
| 5 | **Glossary tests** - Approve and reject glossary term from Glossary Listing | Approve and reject glossary term from Glossary Listing |
| | ↳ *Create Glossary and Terms* | |
| | ↳ *Approve and Reject Glossary Term* | |
| 6 | **Glossary tests** - Add and Remove Assets | Add and Remove Assets |
| | ↳ *Add asset to glossary term using entity* | |
| 7 | **Glossary tests** - Rename Glossary Term and verify assets | Rename Glossary Term and verify assets |
| | ↳ *Assign Glossary Term to table column* | |
| | ↳ *Rename Glossary Term* | |
| | ↳ *Verify the entity page by clicking on asset* | |
| | ↳ *Rename the same entity again* | |
| 8 | **Glossary tests** - Verify asset selection modal filters are shown upfront | Asset selection modal filters are shown upfront |
| | ↳ *Verify filters are visible upfront and can be applied* | |
| 9 | **Glossary tests** - Drag and Drop Glossary Term | Drag and Drop Glossary Term |
| | ↳ *Drag and Drop Glossary Term* | |
| | ↳ *Drag and Drop Glossary Term back at parent level* | |
| 10 | **Glossary tests** - Drag and Drop Glossary Term Approved Terms having reviewer | Drag and Drop Glossary Term Approved Terms having reviewer |
| | ↳ *Update Glossary Term Reviewer* | |
| | ↳ *Drag and Drop Glossary Term* | |
| 11 | **Glossary tests** - Change glossary term hierarchy using menu options | Change glossary term hierarchy using menu options |
| 12 | **Glossary tests** - Change glossary term hierarchy using menu options across glossary | Change glossary term hierarchy using menu options across glossary |
| | ↳ *Delete glossary to verify broken relation* | |
| 13 | **Glossary tests** - Assign Glossary Term to entity and check assets | Assign Glossary Term to entity and check assets |
| 14 | **Glossary tests** - Request description task for Glossary | Request description task for Glossary |
| 15 | **Glossary tests** - Request description task for Glossary Term | Request description task for Glossary Term |
| 16 | **Glossary tests** - Request tags for Glossary | Request tags for Glossary |
| 17 | **Glossary tests** - Delete Glossary and Glossary Term using Delete Modal | Delete Glossary and Glossary Term using Delete Modal |
| 18 | **Glossary tests** - Async Delete - single delete success | Async Delete - single delete success |
| 19 | **Glossary tests** - Async Delete - WebSocket failure triggers recovery | Async Delete - WebSocket failure triggers recovery |
| 20 | **Glossary tests** - Async Delete - multiple deletes all succeed | Async Delete - multiple deletes all succeed |
| 21 | **Glossary tests** - Async Delete - multiple deletes with mixed results | Async Delete - multiple deletes with mixed results |
| 22 | **Glossary tests** - Verify Expand All For Nested Glossary Terms | Expand All For Nested Glossary Terms |
| 23 | **Glossary tests** - Column selection and visibility for Glossary Terms table | Column selection and visibility for Glossary Terms table |
| | ↳ *Open column dropdown and select columns and check if they are visible* | |
| | ↳ *Open column dropdown and deselect columns and check if they are hidden* | |
| | ↳ *View All columns selection* | |
| | ↳ *Hide All columns selection* | |
| 24 | **Glossary tests** - Glossary Terms Table Status filtering | Glossary Terms Table Status filtering |
| | ↳ *Deselect status and check if the table has filtered rows* | |
| | ↳ *Re-select the status and check if it appears again* | |
| 25 | **Glossary tests** - Column dropdown drag-and-drop functionality for Glossary Terms table | Column dropdown drag-and-drop functionality for Glossary Terms table |
| 26 | **Glossary tests** - Glossary Term Update in Glossary Page should persist tree | Glossary Term Update in Glossary Page should persist tree |
| 27 | **Glossary tests** - Add Glossary Term inside another Term | Add Glossary Term inside another Term |
| 28 | **Glossary tests** - Check for duplicate Glossary Term | For duplicate Glossary Term |
| | ↳ *Create Glossary Term One* | |
| | ↳ *Create Glossary Term Two* | |
| 29 | **Glossary tests** - Verify Glossary Deny Permission | Glossary Deny Permission |
| 30 | **Glossary tests** - Verify Glossary Term Deny Permission | Glossary Term Deny Permission |
| 31 | **Glossary tests** - Term should stay approved when changes made by reviewer | Term should stay approved when changes made by reviewer |
| | ↳ *Navigate to glossary and verify workflow widget* | |
| | ↳ *Perform Changes by reviewer* | |
| 32 | **Glossary tests** - Glossary creation with domain selection | Glossary creation with domain selection |
| | ↳ *Create domain* | |
| | ↳ *Navigate to Glossary page* | |
| | ↳ *Open Add Glossary form* | |
| | ↳ *Save glossary and verify creation with domain* | |
| 33 | **Glossary tests** - Create glossary, change language to Dutch, and delete glossary | Create glossary, change language to Dutch, and delete glossary |
| | ↳ *Create Glossary via API* | |
| | ↳ *Navigate to Glossary page* | |
| | ↳ *Change application language to German* | |
| | ↳ *Open delete modal and verify delete confirmation* | |
| | ↳ *Change language back to English* | |
| 34 | **Glossary tests** - should handle glossary after description is deleted | Tests that verify UI handles entities with deleted descriptions gracefully. The issue occurs when: 1. An entity is created with a description 2. The description is later deleted/cleared via API patch 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL)) 4. UI should handle this gracefully instead of crashing |
| 35 | **Glossary tests** - should handle glossary term after description is deleted | Handle glossary term after description is deleted |

</details>

<details open>
<summary>📄 <b>LargeGlossaryPerformance.spec.ts</b> (9 tests, 9 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/LargeGlossaryPerformance.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LargeGlossaryPerformance.spec.ts)

### Large Glossary Performance Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Large Glossary Performance Tests** - should handle large number of glossary terms with pagination | Handle large number of glossary terms with pagination |
| 2 | **Large Glossary Performance Tests** - should search and filter glossary terms | Search and filter glossary terms |
| 3 | **Large Glossary Performance Tests** - should expand and collapse all terms | Expand and collapse all terms |
| 4 | **Large Glossary Performance Tests** - should expand individual terms | Expand individual terms |
| 5 | **Large Glossary Performance Tests** - should maintain scroll position when loading more terms | Maintain scroll position when loading more terms |
| 6 | **Large Glossary Performance Tests** - should handle status filtering | Handle status filtering |
| 7 | **Large Glossary Performance Tests** - should show term count in glossary listing | Show term count in glossary listing |
| 8 | **Large Glossary Performance Tests** - should handle drag and drop for term reordering | Handle drag and drop for term reordering |

### Large Glossary Child Term Performace

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Large Glossary Child Term Performace** - should handle large number of glossary child term with pagination | Handle large number of glossary child term with pagination |

</details>

<details open>
<summary>📄 <b>GlossaryPagination.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/GlossaryPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/GlossaryPagination.spec.ts)

### Glossary tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary tests** - should check for glossary term search | For glossary term search |
| 2 | **Glossary tests** - should check for nested glossary term search | For nested glossary term search |

</details>

<details open>
<summary>📄 <b>GlossaryPermissions.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/GlossaryPermissions.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Glossary allow operations | Glossary allow operations |
| 2 | Glossary deny operations | Glossary deny operations |

</details>

<details open>
<summary>📄 <b>GlossaryImportExport.spec.ts</b> (2 tests, 8 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/GlossaryImportExport.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/GlossaryImportExport.spec.ts)

### Glossary Bulk Import Export

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Glossary Bulk Import Export** - Glossary Bulk Import Export | Glossary Bulk Import Export |
| | ↳ *create custom properties for extension edit* | |
| | ↳ *should export data glossary term details* | |
| | ↳ *should import and edit with one additional glossaryTerm* | |
| | ↳ *should have term in review state* | |
| | ↳ *delete custom properties* | |
| 2 | **Glossary Bulk Import Export** - Check for Circular Reference in Glossary Import | For Circular Reference in Glossary Import |
| | ↳ *Create glossary for circular reference test* | |
| | ↳ *Import initial glossary terms* | |
| | ↳ *Import CSV with circular reference and verify error* | |

</details>

<details open>
<summary>📄 <b>GlossaryVersionPage.spec.ts</b> (2 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/GlossaryVersionPage.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Glossary | Glossary |
| | ↳ *Version changes* | |
| | ↳ *Should display the owner & reviewer changes* | |
| 2 | GlossaryTerm | GlossaryTerm |
| | ↳ *Version changes* | |
| | ↳ *Should display the owner & reviewer changes* | |

</details>


---

<div id="domains-data-products"></div>

## Domains & Data Products

<details open>
<summary>📄 <b>Domains.spec.ts</b> (26 tests, 45 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Domains.spec.ts)

### Domains

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domains** - Create domains and add assets | Create domains and add assets |
| | ↳ *Create domain* | |
| | ↳ *Add assets to domain* | |
| | ↳ *Delete domain using delete modal* | |
| 2 | **Domains** - Create DataProducts and add remove assets | Create DataProducts and add remove assets |
| | ↳ *Add assets to domain* | |
| | ↳ *Create DataProducts* | |
| | ↳ *Follow & Un-follow DataProducts* | |
| | ↳ *Verify empty assets message and Add Asset button* | |
| | ↳ *Add assets to DataProducts* | |
| | ↳ *Remove assets from DataProducts* | |
| 3 | **Domains** - Follow & Un-follow domain | Follow & Un-follow domain |
| 4 | **Domains** - Add, Update custom properties for data product | Add, Update custom properties for data product |
| | ↳ *Create DataProduct and custom properties for it* | |
| | ↳ *Set ${...} Custom Property* | |
| | ↳ *Update ${...} Custom Property* | |
| 5 | **Domains** - Switch domain from navbar and check domain query call wrap in quotes | Switch domain from navbar and check domain query call wrap in quotes |
| 6 | **Domains** - Rename domain | Rename domain |
| 7 | **Domains** - Follow/unfollow subdomain and create nested sub domain | Follow/unfollow subdomain and create nested sub domain |
| 8 | **Domains** - Should clear assets from data products after deletion of data product in Domain | Clear assets from data products after deletion of data product in Domain |
| | ↳ *Delete domain & recreate the same domain and data product* | |
| 9 | **Domains** - Should inherit owners and experts from parent domain | Inherit owners and experts from parent domain |
| 10 | **Domains** - Domain owner should able to edit description of domain | Domain owner should able to edit description of domain |
| 11 | **Domains** - Verify domain and subdomain asset count accuracy | Domain and subdomain asset count accuracy |
| | ↳ *Create domain and subdomain via API* | |
| | ↳ *Add assets to domain* | |
| | ↳ *Add assets to subdomain* | |
| | ↳ *Verify domain asset count matches displayed cards* | |
| | ↳ *Verify subdomain asset count matches displayed cards* | |
| 12 | **Domains** - Verify domain tags and glossary terms | Domain tags and glossary terms |
| 13 | **Domains** - Verify data product tags and glossary terms | Data product tags and glossary terms |
| 14 | **Domains** - Verify clicking All Domains sets active domain to default value | Clicking All Domains sets active domain to default value |
| 15 | **Domains** - Verify redirect path on data product delete | Redirect path on data product delete |
| 16 | **Domains** - Verify duplicate domain creation | Duplicate domain creation |
| 17 | **Domains** - Create domain custom property and verify value persistence | Create domain custom property and verify value persistence |
| | ↳ *Create custom property for domain entity* | |
| | ↳ *Navigate to domain and assign custom property value* | |
| | ↳ *Reload and verify custom property value persists* | |
| | ↳ *Cleanup custom property* | |
| 18 | **Domains** - Domain announcement create, edit & delete | Domain announcement create, edit & delete |
| 19 | **Domains** - Data Product announcement create, edit & delete | Data Product announcement create, edit & delete |
| 20 | **Domains** - should handle domain after description is deleted | Tests that verify UI handles entities with deleted descriptions gracefully. The issue occurs when: 1. An entity is created with a description 2. The description is later deleted/cleared via API patch 3. The API returns the entity without a description field (due to @JsonInclude(NON_NULL)) 4. UI should handle this gracefully instead of crashing |
| 21 | **Domains** - should handle data product after description is deleted | Handle data product after description is deleted |

### Domains Rbac

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domains Rbac** - Domain Rbac | Domain Rbac |
| | ↳ *Assign assets to domains* | |
| | ↳ *User with access to multiple domains* | |

### Data Consumer Domain Ownership

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Consumer Domain Ownership** - Data consumer can manage domain as owner | Data consumer can manage domain as owner |
| | ↳ *Check domain management permissions for data consumer owner* | |

### Domain Access with hasDomain() Rule

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Access with hasDomain() Rule** - User with hasDomain() rule can access domain and subdomain assets | User with hasDomain() rule can access domain and subdomain assets |
| | ↳ *Verify user can access domain assets* | |
| | ↳ *Verify user can access subdomain assets* | |

### Domain Access with noDomain() Rule

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Access with noDomain() Rule** - User with noDomain() rule cannot access tables without domain | User with noDomain() rule cannot access tables without domain |
| | ↳ *Verify user can access domain-assigned table* | |
| | ↳ *Verify user gets permission error for table without domain* | |

### Domain Tree View Functionality

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain Tree View Functionality** - should render the domain tree view with correct details | Render the domain tree view with correct details |

</details>

<details open>
<summary>📄 <b>DomainDataProductsWidgets.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts)

### Domain and Data Product Asset Counts

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Domain and Data Product Asset Counts** - Assign Widgets | Assign Widgets |
| 2 | **Domain and Data Product Asset Counts** - Verify Widgets are having 0 count initially | Widgets are having 0 count initially |
| 3 | **Domain and Data Product Asset Counts** - Domain asset count should update when assets are added | Domain asset count should update when assets are added |
| 4 | **Domain and Data Product Asset Counts** - Data Product asset count should update when assets are added | Data Product asset count should update when assets are added |
| 5 | **Domain and Data Product Asset Counts** - Domain asset count should update when assets are removed | Domain asset count should update when assets are removed |
| 6 | **Domain and Data Product Asset Counts** - Data Product asset count should update when assets are removed | Data Product asset count should update when assets are removed |

</details>

<details open>
<summary>📄 <b>DomainPermissions.spec.ts</b> (2 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Permissions/DomainPermissions.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Domain allow operations | Domain allow operations |
| 2 | Domain deny operations | Domain deny operations |

</details>

<details open>
<summary>📄 <b>SubDomainPagination.spec.ts</b> (1 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/SubDomainPagination.spec.ts)

### SubDomain Pagination

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **SubDomain Pagination** - Verify subdomain count and pagination functionality | Subdomain count and pagination functionality |
| | ↳ *Verify subdomain count in tab label* | |
| | ↳ *Navigate to subdomains tab and verify initial data load* | |
| | ↳ *Test pagination navigation* | |
| | ↳ *Create new subdomain and verify count updates* | |

</details>


---

<div id="tags"></div>

## Tags

<details open>
<summary>📄 <b>Tag.spec.ts</b> (18 tests, 22 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tag.spec.ts)

### Tag Page with Admin Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Admin Roles** - Verify Tag UI | Tag UI |
| 2 | **Tag Page with Admin Roles** - Certification Page should not have Asset button | Certification Page should not have Asset button |
| 3 | **Tag Page with Admin Roles** - Rename Tag name | Rename Tag name |
| 4 | **Tag Page with Admin Roles** - Restyle Tag | Restyle Tag |
| 5 | **Tag Page with Admin Roles** - Edit Tag Description | Edit Tag Description |
| 6 | **Tag Page with Admin Roles** - Delete a Tag | Delete a Tag |
| 7 | **Tag Page with Admin Roles** - Add and Remove Assets | Add and Remove Assets |
| | ↳ *Add Asset * | |
| | ↳ *Delete Asset* | |
| 8 | **Tag Page with Admin Roles** - Create tag with domain | Create tag with domain |
| 9 | **Tag Page with Admin Roles** - Verify Owner Add Delete | Owner Add Delete |

### Tag Page with Data Consumer Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Data Consumer Roles** - Verify Tag UI for Data Consumer | Tag UI for Data Consumer |
| 2 | **Tag Page with Data Consumer Roles** - Certification Page should not have Asset button for Data Consumer | Certification Page should not have Asset button for Data Consumer |
| 3 | **Tag Page with Data Consumer Roles** - Edit Tag Description for Data Consumer | Edit Tag Description for Data Consumer |
| 4 | **Tag Page with Data Consumer Roles** - Add and Remove Assets for Data Consumer | Add and Remove Assets for Data Consumer |
| | ↳ *Add Asset * | |
| | ↳ *Delete Asset* | |

### Tag Page with Data Steward Roles

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Data Steward Roles** - Verify Tag UI for Data Steward | Tag UI for Data Steward |
| 2 | **Tag Page with Data Steward Roles** - Certification Page should not have Asset button for Data Steward | Certification Page should not have Asset button for Data Steward |
| 3 | **Tag Page with Data Steward Roles** - Edit Tag Description for Data Steward | Edit Tag Description for Data Steward |
| 4 | **Tag Page with Data Steward Roles** - Add and Remove Assets for Data Steward | Add and Remove Assets for Data Steward |
| | ↳ *Add Asset * | |
| | ↳ *Delete Asset* | |

### Tag Page with Limited EditTag Permission

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tag Page with Limited EditTag Permission** - Add and Remove Assets and Check Restricted Entity | Add and Remove Assets and Check Restricted Entity |
| | ↳ *Add Asset * | |
| | ↳ *Delete Asset* | |

</details>

<details open>
<summary>📄 <b>Tags.spec.ts</b> (4 tests, 12 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Tags.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Classification Page | Classification Page |
| | ↳ *Should render basic elements on page* | |
| | ↳ *Disabled system tags should not render* | |
| | ↳ *Create classification with validation checks* | |
| | ↳ *Create tag with validation checks* | |
| | ↳ *Verify classification term count* | |
| | ↳ *Assign tag to table* | |
| | ↳ *Assign tag using Task & Suggestion flow to DatabaseSchema* | |
| | ↳ *Delete tag* | |
| | ↳ *Remove classification* | |
| 2 | Search tag using classification display name should work | Search tag using classification display name should work |
| 3 | Verify system classification term counts | System classification term counts |
| 4 | Verify Owner Add Delete | Owner Add Delete |

</details>

<details open>
<summary>📄 <b>TagsSuggestion.spec.ts</b> (3 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/TagsSuggestion.spec.ts)

### Tags Suggestions Table Entity

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Tags Suggestions Table Entity** - View, Close, Reject and Accept the Suggestions | View, Close, Reject and Accept the Suggestions |
| | ↳ *View and Open the Suggestions* | |
| | ↳ *Accept Single Suggestion* | |
| | ↳ *Reject Single Suggestion* | |
| | ↳ *Accept all Suggestion* | |
| 2 | **Tags Suggestions Table Entity** - Accept the Suggestions for Tier Card | Accept the Suggestions for Tier Card |
| 3 | **Tags Suggestions Table Entity** - Reject All Suggestions | Reject All Suggestions |

</details>

<details open>
<summary>📄 <b>MutuallyExclusiveColumnTags.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/MutuallyExclusiveColumnTags.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Should show error toast when adding mutually exclusive tags to column | Show error toast when adding mutually exclusive tags to column |

</details>

<details open>
<summary>📄 <b>AutoClassification.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/AutoClassification.spec.ts)

### Auto Classification

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Auto Classification** - should be able to auto classify data | Be able to auto classify data |

</details>

<details open>
<summary>📄 <b>ClassificationVersionPage.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/ClassificationVersionPage.spec.ts)

### Standalone Tests

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | Classification version page | Classification version page |

</details>


---

<div id="data-contracts"></div>

## Data Contracts

<details open>
<summary>📄 <b>DataContracts.spec.ts</b> (46 tests, 309 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContracts.spec.ts)

### Data Contracts

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts** - Create Data Contract and validate for Table | Create Data Contract and validate for Table |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 2 | **Data Contracts** - Create Data Contract and validate for Topic | Create Data Contract and validate for Topic |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 3 | **Data Contracts** - Create Data Contract and validate for Dashboard | Create Data Contract and validate for Dashboard |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 4 | **Data Contracts** - Create Data Contract and validate for DashboardDataModel | Create Data Contract and validate for DashboardDataModel |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 5 | **Data Contracts** - Create Data Contract and validate for Pipeline | Create Data Contract and validate for Pipeline |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 6 | **Data Contracts** - Create Data Contract and validate for MlModel | Create Data Contract and validate for MlModel |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 7 | **Data Contracts** - Create Data Contract and validate for Container | Create Data Contract and validate for Container |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 8 | **Data Contracts** - Create Data Contract and validate for SearchIndex | Create Data Contract and validate for SearchIndex |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 9 | **Data Contracts** - Create Data Contract and validate for Store Procedure | Create Data Contract and validate for Store Procedure |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 10 | **Data Contracts** - Create Data Contract and validate for ApiEndpoint | Create Data Contract and validate for ApiEndpoint |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 11 | **Data Contracts** - Create Data Contract and validate for Api Collection | Create Data Contract and validate for Api Collection |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 12 | **Data Contracts** - Create Data Contract and validate for Chart | Create Data Contract and validate for Chart |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 13 | **Data Contracts** - Create Data Contract and validate for Directory | Create Data Contract and validate for Directory |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 14 | **Data Contracts** - Create Data Contract and validate for File | Create Data Contract and validate for File |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 15 | **Data Contracts** - Create Data Contract and validate for Spreadsheet | Create Data Contract and validate for Spreadsheet |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 16 | **Data Contracts** - Create Data Contract and validate for Worksheet | Create Data Contract and validate for Worksheet |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 17 | **Data Contracts** - Create Data Contract and validate for Database | Create Data Contract and validate for Database |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 18 | **Data Contracts** - Create Data Contract and validate for Database Schema | Create Data Contract and validate for Database Schema |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill the Terms of Service Detail* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Fill first Contract Semantics form* | |
| | ↳ *Add second semantic and delete it* | |
| | ↳ *Save contract and validate for semantics* | |
| | ↳ *Add table test case and validate for quality* | |
| | ↳ *Validate inside the Observability, bundle test suites, that data contract test suite is present* | |
| | ↳ *Edit quality expectations from the data contract and validate* | |
| | ↳ *Verify YAML view* | |
| | ↳ *Export YAML* | |
| | ↳ *Edit and Validate Contract data* | |
| | ↳ *Delete contract* | |
| 19 | **Data Contracts** - Pagination in Schema Tab with Selection Persistent | Pagination in Schema Tab with Selection Persistent |
| | ↳ *Redirect to Home Page and visit entity* | |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Fill Contract Details form* | |
| | ↳ *Fill Contract Schema form* | |
| | ↳ *Save contract and validate for schema* | |
| | ↳ *Update the Schema and Validate* | |
| | ↳ *Re-select some columns on page 1, save and validate* | |
| | ↳ *Delete contract* | |
| 20 | **Data Contracts** - Semantic with Contains Operator should work for Tier, Tag and Glossary | Semantic with Contains Operator should work for Tier, Tag and Glossary |
| 21 | **Data Contracts** - Semantic with Not_Contains Operator should work for Tier, Tag and Glossary | Semantic with Not_Contains Operator should work for Tier, Tag and Glossary |
| 22 | **Data Contracts** - Nested Column should not be selectable | Nested Column should not be selectable |
| 23 | **Data Contracts** - Operation on Old Schema Columns Contract | Operation on Old Schema Columns Contract |
| 24 | **Data Contracts** - should allow adding a semantic with multiple rules | Allow adding a semantic with multiple rules |
| 25 | **Data Contracts** - should allow adding a second semantic and verify its rule | Allow adding a second semantic and verify its rule |
| 26 | **Data Contracts** - should allow editing a semantic and reflect changes | Allow editing a semantic and reflect changes |
| 27 | **Data Contracts** - should allow deleting a semantic and remove it from the list | Allow deleting a semantic and remove it from the list |
| 28 | **Data Contracts** - Add and update Security and SLA tabs | Add and update Security and SLA tabs |
| | ↳ *Add Security and SLA Details* | |
| | ↳ *Validate Security and SLA Details* | |
| | ↳ *Update Security and SLA Details* | |
| | ↳ *Validate the updated values Security and SLA Details* | |
| | ↳ *Validate after removing security policies* | |

### Data Contracts With Persona Table

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Table** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Topic

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Topic** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Dashboard

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Dashboard** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona DashboardDataModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona DashboardDataModel** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Pipeline

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Pipeline** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona MlModel

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona MlModel** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Container

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Container** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona SearchIndex

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona SearchIndex** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Store Procedure

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Store Procedure** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona ApiEndpoint

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona ApiEndpoint** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Api Collection

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Api Collection** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Chart

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Chart** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Directory

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Directory** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona File

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona File** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Spreadsheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Spreadsheet** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Worksheet

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Worksheet** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Database

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Database** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

### Data Contracts With Persona Database Schema

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts With Persona Database Schema** - Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona | Contract Status badge should be visible on condition if Contract Tab is present/hidden by Persona |

</details>

<details open>
<summary>📄 <b>DataContractsSemanticRules.spec.ts</b> (40 tests, 120 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DataContractsSemanticRules.spec.ts)

### Data Contracts Semantics Rule Owner

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is | Validate Owner Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Owner with is condition should passed with same team owner* | |
| | ↳ *Owner with is condition should failed with different owner* | |
| 2 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is_Not | Validate Owner Rule Is_Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Owner with is not condition should passed with different owner* | |
| | ↳ *Owner with is not condition should failed with same owner* | |
| 3 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Any_In | Validate Owner Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Failed since entity owner doesn't make the list of any_in* | |
| | ↳ *Should Passed since entity owner present in the list of any_in* | |
| 4 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Not_In | Validate Owner Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Passed since entity owner doesn't make the list of not_in* | |
| | ↳ *Should Failed since entity owner present in the list of not_in* | |
| 5 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is_Set | Validate Owner Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Failed since entity don't have owner* | |
| | ↳ *Should Passed since entity has owner* | |
| 6 | **Data Contracts Semantics Rule Owner** - Validate Owner Rule Is_Not_Set | Validate Owner Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Should Passed since entity don't have owner* | |
| | ↳ *Should Failed since entity has owner* | |

### Data Contracts Semantics Rule Description

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Description** - Validate Description Rule Contains | Validate Description Rule Contains |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with contains condition should passed* | |
| | ↳ *Description with contains and wrong value should failed* | |
| 2 | **Data Contracts Semantics Rule Description** - Validate Description Rule Not Contains | Validate Description Rule Not Contains |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with not_contains condition should failed* | |
| | ↳ *Description with not_contains condition should passed* | |
| 3 | **Data Contracts Semantics Rule Description** - Validate Description Rule Is_Set | Validate Description Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with is_set condition should passed* | |
| | ↳ *Description with is_set condition should failed* | |
| 4 | **Data Contracts Semantics Rule Description** - Validate Description Rule Is_Not_Set | Validate Description Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Description with is_not_set condition should failed* | |
| | ↳ *Description with is_not_set condition should passed* | |

### Data Contracts Semantics Rule Domain

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is | Validate Domain Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with Is condition should passed* | |
| | ↳ *Domain with Is condition should failed* | |
| 2 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is Not | Validate Domain Rule Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with IsNot condition should passed* | |
| | ↳ *Domain with IsNot condition should failed* | |
| 3 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Any_In | Validate Domain Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with AnyIn condition should passed* | |
| | ↳ *Domain with AnyIn condition should failed* | |
| 4 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Not_In | Validate Domain Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with NotIn condition should passed* | |
| | ↳ *Domain with NotIn condition should failed* | |
| 5 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is_Set | Validate Domain Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with IsSet condition should passed* | |
| | ↳ *Domain with IsSet condition should failed* | |
| 6 | **Data Contracts Semantics Rule Domain** - Validate Domain Rule Is_Not_Set | Validate Domain Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Domain with IsNotSet condition should passed* | |
| | ↳ *Domain with IsNotSet condition should failed* | |

### Data Contracts Semantics Rule Version

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Version** - Validate Entity Version Is | Validate Entity Version Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Correct entity version should passed* | |
| | ↳ *Non-Correct entity version should failed* | |
| 2 | **Data Contracts Semantics Rule Version** - Validate Entity Version Is Not | Validate Entity Version Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with is_not condition for version should passed* | |
| | ↳ *Contract with is_not condition for version should failed* | |
| 3 | **Data Contracts Semantics Rule Version** - Validate Entity Version Less than < | Validate Entity Version Less than < |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with < condition for version should passed* | |
| | ↳ *Contract with < condition for version should failed* | |
| 4 | **Data Contracts Semantics Rule Version** - Validate Entity Version Greater than > | Validate Entity Version Greater than > |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with > condition for version should failed* | |
| | ↳ *Contract with > condition for version should passed* | |
| 5 | **Data Contracts Semantics Rule Version** - Validate Entity Version Less than equal <= | Validate Entity Version Less than equal <= |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with <= condition for version should passed* | |
| | ↳ *Contract with <= condition for version should failed* | |
| 6 | **Data Contracts Semantics Rule Version** - Validate Entity Version Greater than equal >= | Validate Entity Version Greater than equal >= |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *Contract with >= condition for version should passed* | |
| | ↳ *Contract with >= condition for version should failed* | |

### Data Contracts Semantics Rule DataProduct

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is | Validate DataProduct Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Is condition should passed* | |
| | ↳ *DataProduct with Is condition should failed* | |
| 2 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is Not | Validate DataProduct Rule Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Is Not condition should passed* | |
| | ↳ *DataProduct with Is Not condition should passed* | |
| 3 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Any_In | Validate DataProduct Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Any In condition should failed* | |
| | ↳ *DataProduct with Any In condition should passed* | |
| 4 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Not_In | Validate DataProduct Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with Not In condition should passed* | |
| | ↳ *DataProduct with Any In condition should passed* | |
| 5 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is_Set | Validate DataProduct Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with IsSet condition should passed* | |
| | ↳ *Domain with IsSet condition should failed* | |
| 6 | **Data Contracts Semantics Rule DataProduct** - Validate DataProduct Rule Is_Not_Set | Validate DataProduct Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DataProduct with IsNotSet condition should passed* | |
| | ↳ *DataProduct with IsNotSet condition should failed* | |

### Data Contracts Semantics Rule DisplayName

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is | Validate DisplayName Rule Is |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Is condition should passed* | |
| | ↳ *DisplayName with Is condition should failed* | |
| 2 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is Not | Validate DisplayName Rule Is Not |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Is Not condition should failed* | |
| | ↳ *DisplayName with Is Not condition should passed* | |
| 3 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Any_In | Validate DisplayName Rule Any_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Any In condition should passed* | |
| | ↳ *DisplayName with Any In condition should failed* | |
| 4 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Not_In | Validate DisplayName Rule Not_In |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with Not In condition should failed* | |
| | ↳ *DisplayName with Not In condition should passed* | |
| 5 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is_Set | Validate DisplayName Rule Is_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with IsSet condition should passed* | |
| | ↳ *DisplayName with IsSet condition should failed* | |
| 6 | **Data Contracts Semantics Rule DisplayName** - Validate DisplayName Rule Is_Not_Set | Validate DisplayName Rule Is_Not_Set |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *DisplayName with IsNotSet condition should failed* | |
| | ↳ *DisplayName with IsNotSet condition should passed* | |

### Data Contracts Semantics Rule Updated on

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Between | Validate UpdatedOn Rule Between |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Between condition should passed* | |
| | ↳ *UpdatedOn with Between condition should failed* | |
| 2 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Not_Between | Validate UpdatedOn Rule Not_Between |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Between condition should failed* | |
| | ↳ *UpdatedOn with Between condition should passed* | |
| 3 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Less than | Validate UpdatedOn Rule Less than |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Less than condition should failed* | |
| | ↳ *UpdatedOn with Less than condition should passed* | |
| 4 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Greater than | Validate UpdatedOn Rule Greater than |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with Greater than condition should failed* | |
| | ↳ *UpdatedOn with Greater than condition should passed* | |
| 5 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Less than Equal | Validate UpdatedOn Rule Less than Equal |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with LessThanEqual condition should passed* | |
| | ↳ *UpdatedOn with Less than condition should failed* | |
| 6 | **Data Contracts Semantics Rule Updated on** - Validate UpdatedOn Rule Greater Than Equal | Validate UpdatedOn Rule Greater Than Equal |
| | ↳ *Open contract section and start adding contract* | |
| | ↳ *UpdatedOn with GreaterThanEqual condition should passed* | |
| | ↳ *UpdatedOn with GreaterThanEqual condition should failed* | |

</details>


---

