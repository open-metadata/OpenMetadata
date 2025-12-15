---
layout: default
title: Home
nav_order: 1
description: "Comprehensive E2E test documentation for OpenMetadata"
---

# OpenMetadata E2E Test Documentation
{: .fs-9 }

Comprehensive documentation of all Playwright end-to-end tests organized by component.
{: .fs-6 .fw-300 }

---

## Summary

| Metric | Count |
|--------|-------|
| **Components** | 15 |
| **Test Files** | 148 |
| **Test Definitions** | 915 |
| **Test Steps** | 639 |
| **Total Definitions** | 1554 |
| **Runtime Tests** | ~2,100+ |

{: .note }
> **Runtime Tests** represents actual test executions reported by Playwright. This is higher than definitions because many tests are parameterized (run multiple times with different entities/data).
> For example, entity tests run once per entity type (Table, Dashboard, Pipeline, Topic, etc.).

---

## Components Overview

| Component | Files | Tests | Steps | Total |
|-----------|-------|-------|-------|-------|
| [Glossary](./components/glossary) | 21 | 288 | 60 | 348 |
| [Data Quality & Observability](./components/data-quality-observability) | 14 | 75 | 231 | 306 |
| [Data Assets](./components/data-assets) | 28 | 180 | 74 | 254 |
| [Users & Teams](./components/users-teams) | 13 | 89 | 45 | 134 |
| [Settings & Configuration](./components/settings-configuration) | 14 | 57 | 72 | 129 |
| [Search & Discovery](./components/search-discovery) | 14 | 47 | 28 | 75 |
| [Domains & Data Products](./components/domains-data-products) | 4 | 35 | 33 | 68 |
| [Tags & Classification](./components/tags-classification) | 6 | 28 | 21 | 49 |
| [Lineage](./components/lineage) | 4 | 23 | 25 | 48 |
| [Activity & Collaboration](./components/activity-collaboration) | 3 | 20 | 24 | 44 |
| [Other](./components/other) | 10 | 19 | 12 | 31 |
| [Access Control](./components/access-control) | 5 | 8 | 14 | 22 |
| [Data Insights](./components/data-insights) | 3 | 17 | 0 | 17 |
| [UI Components](./components/ui-components) | 5 | 16 | 0 | 16 |
| [Services & Ingestion](./components/services-ingestion) | 4 | 13 | 0 | 13 |


---

## Test Categories

### 🏠 Core Features
- **[Glossary](./components/glossary)** - Glossary and Glossary Term management, workflows, hierarchy
- **[Data Assets](./components/data-assets)** - Tables, Topics, Dashboards, Pipelines, Containers
- **[Domains & Data Products](./components/domains-data-products)** - Domain hierarchy and data products

### 📊 Data Quality
- **[Data Quality & Observability](./components/data-quality-observability)** - Test suites, profiler, incident management

### 🔍 Discovery & Governance
- **[Search & Discovery](./components/search-discovery)** - Search, filters, and exploration
- **[Tags & Classification](./components/tags-classification)** - Tags, tiers, and classification
- **[Lineage](./components/lineage)** - Data lineage tracking and impact analysis

### 👥 Administration
- **[Users & Teams](./components/users-teams)** - User and team management
- **[Access Control](./components/access-control)** - Roles, policies, and permissions
- **[Services & Ingestion](./components/services-ingestion)** - Service connections and ingestion pipelines
- **[Settings & Configuration](./components/settings-configuration)** - Application settings and customization

### 📈 Insights & Collaboration
- **[Data Insights](./components/data-insights)** - KPIs and data insights dashboards
- **[Activity & Collaboration](./components/activity-collaboration)** - Activity feeds, tasks, and announcements

### 🎨 UI Components
- **[UI Components](./components/ui-components)** - Widgets, navigation, and UI elements

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ⏭️ | Skipped test |
| ↳ | Test step (sub-test within a test case) |

---

*Last updated: 2025-12-15*

*Generated automatically from Playwright test files*
