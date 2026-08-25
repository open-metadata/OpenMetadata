# Learning Resources System - Design Document

**Date:** 2025-12-26
**Status:** Production Ready
**Version:** 1.0 - Simplified (No Progress Tracking)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [User Experience](#user-experience)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Data Model](#data-model)
7. [API Endpoints](#api-endpoints)
8. [Sample Resources](#sample-resources)
9. [Integration Points](#integration-points)
10. [What Was Removed](#what-was-removed)
11. [Next Steps](#next-steps)

---

## Overview

The Learning Resources system provides contextual, in-product learning materials to help users understand and use OpenMetadata features. Resources are matched to specific pages/components and displayed on-demand when users click a lightbulb icon.

### Key Principles

- **User-Initiated:** Resources only appear when users click the lightbulb (💡) icon - no automatic inline display
- **Contextual:** Resources are matched to specific pages (glossary, domain, data products, etc.) and optional component IDs
- **Multi-Format:** Supports Articles (markdown), Videos (YouTube/Vimeo), and Interactive Demos (Storylane)
- **Simple:** No progress tracking, no badges, no gamification - just content delivery
- **Admin-Managed:** Full CRUD interface for creating and managing learning resources

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Page Header                                                 │
│  ┌──────────────────────────────────────────────────┐       │
│  │  [Page Title]              💡 (3) [Other Btns]   │       │
│  └──────────────────────────────────────────────────┘       │
│         │                                                     │
│         │ Click                                               │
│         ▼                                                     │
│  ┌─────────────────────┐                                     │
│  │  LearningDrawer     │◄──── Fetches resources by pageId   │
│  │  (Side Panel)       │                                     │
│  ├─────────────────────┤                                     │
│  │ 📚 Learning         │                                     │
│  │    Resources        │                                     │
│  ├─────────────────────┤                                     │
│  │ • Resource 1        │                                     │
│  │ • Resource 2        │                                     │
│  │ • Resource 3        │                                     │
│  └─────────────────────┘                                     │
│         │                                                     │
│         │ Click Resource                                     │
│         ▼                                                     │
│  ┌────────────────────────────────────┐                     │
│  │  ResourcePlayerModal (Full Screen) │                     │
│  ├────────────────────────────────────┤                     │
│  │  [Article|Video|Storylane Player]  │                     │
│  │                                     │                     │
│  │  Content displayed here...          │                     │
│  │                                     │                     │
│  └────────────────────────────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## User Experience

### Workflow

1. **User browses** Glossary, Domain, or Data Product page
2. **Sees lightbulb (💡) icon** in page header with badge count (e.g., "3")
3. **Clicks lightbulb** → Side drawer opens from right
4. **Sees list** of relevant learning resources (filtered by page context)
5. **Clicks a resource** → Full modal opens with content player
6. **Views content:**
   - Article: Markdown rendered with full formatting
   - Video: YouTube/Vimeo embedded player
   - Storylane: Interactive demo iframe
7. **Closes modal** when done
8. **Can access** other resources from drawer

### Key UX Decisions

- ✅ **No automatic display** - Resources never appear without user action
- ✅ **Badge count** - Shows number of available resources (e.g., 💡 with "3" badge)
- ✅ **Side drawer pattern** - Non-intrusive, can stay open while browsing
- ✅ **Full modal for content** - Immersive viewing experience
- ✅ **No progress tracking** - Simple, no pressure to complete

---

## Backend Implementation

### Entity: LearningResource

**Location:** `openmetadata-spec/src/main/resources/json/schema/entity/learning/learningResource.json`

**Key Fields:**
- `name` (required): Unique identifier (e.g., "Intro_GlossaryBasics")
- `displayName`: Human-readable title
- `description`: Brief summary
- `resourceType`: `Article` | `Video` | `Storylane`
- `categories`: Array of categories (Discovery, DataGovernance, DataQuality, Administration, Observability)
- `difficulty`: `Intro` | `Intermediate` | `Advanced`
- `source`:
  - `url`: Link to external content or video
  - `provider`: Source name (e.g., "Collate", "OpenMetadata", "YouTube")
  - `embedConfig`: Optional object for embedded content (used for Article markdown)
- `estimatedDuration`: Duration in seconds
- `contexts`: Array of page/component contexts where this resource applies
  - `pageId`: Page identifier (e.g., "glossary", "domain", "dataProduct")
  - `componentId`: Optional component identifier (e.g., "glossary-header", "metrics-tab")
- `status`: `Draft` | `Active` | `Deprecated`
- `owners`: Entity references for owners
- `reviewers`: Entity references for reviewers

**Example:**
```json
{
  "name": "Intro_GlossaryBasics",
  "displayName": "Glossary Basics: Building Your Business Vocabulary",
  "description": "Learn the fundamentals of creating and managing glossaries...",
  "resourceType": "Article",
  "categories": ["Discovery", "DataGovernance"],
  "difficulty": "Intro",
  "source": {
    "url": "https://www.getcollate.io/learning-center/resource/Intro_GlossaryBasics",
    "provider": "Collate",
    "embedConfig": {
      "content": "# Glossary Basics\n\nMarkdown content here..."
    }
  },
  "estimatedDuration": 720,
  "contexts": [
    {
      "pageId": "glossary",
      "componentId": "glossary-header"
    }
  ],
  "status": "Active"
}
```

### Repository

**File:** `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/LearningResourceRepository.java`

**Key Methods:**
- `prepare()`: Validates source URL, categories, contexts, and duration
- `validateSource()`: Ensures valid URL format
- `ensureCategories()`: Sets default Discovery category if none provided
- `validateContexts()`: Ensures at least one context is provided
- `validateDuration()`: Ensures non-negative duration
- `listByContext()`: Filters resources by pageId and optional componentId

**Validation Rules:**
- Source URL is required and must be valid
- At least one category required
- At least one context (pageId) required
- Duration must be >= 0 or null
- ComponentId is optional within context

### REST Resource

**File:** `openmetadata-service/src/main/java/org/openmetadata/service/resources/learning/LearningResourceResource.java`

**Endpoints:**
- `POST /api/v1/learning/resources` - Create resource
- `GET /api/v1/learning/resources` - List resources (with filtering)
- `GET /api/v1/learning/resources/{id}` - Get by ID
- `GET /api/v1/learning/resources/name/{fqn}` - Get by name
- `PATCH /api/v1/learning/resources/{id}` - Update resource
- `DELETE /api/v1/learning/resources/{id}` - Delete resource
- `GET /api/v1/learning/resources/context/{pageId}` - Get by context (with optional componentId param)

**Query Parameters for Context Filtering:**
- `pageId`: Required - filter by page (e.g., "glossary")
- `componentId`: Optional - further filter by component
- `limit`: Max results to return
- `fields`: Additional fields to include

### Database Schema

**Table:** `learning_resource_entity`

**Migrations:**
- MySQL: `bootstrap/sql/migrations/native/1.12.0/mysql/schemaChanges.sql`
- PostgreSQL: `bootstrap/sql/migrations/native/1.12.0/postgres/schemaChanges.sql`

**Note:** Badge and Progress tables were removed - they're in schema files but never created.

---

## Frontend Implementation

### Components

#### 1. LearningIcon (Lightbulb Button)

**File:** `src/components/Learning/LearningIcon/LearningIcon.component.tsx`

**Purpose:** Clickable lightbulb icon with resource count badge

**Features:**
- Shows badge with count of available resources
- Lazy loads count on hover (optimization)
- Opens LearningDrawer on click
- Supports different sizes (small, medium, large)
- Optional label text

**Props:**
```typescript
interface LearningIconProps {
  pageId: string;
  componentId?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  label?: string;
  tooltip?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}
```

**Usage:**
```tsx
<LearningIcon
  pageId="glossary"
  size="small"
/>
```

#### 2. LearningDrawer (Side Panel)

**File:** `src/components/Learning/LearningDrawer/LearningDrawer.component.tsx`

**Purpose:** Side drawer that lists available resources

**Features:**
- Opens from right side
- Shows title: "Learning Resources for {page}"
- Lists resources as cards
- Click card → opens ResourcePlayerModal
- Auto-fetches resources when opened
- Shows loading spinner while fetching
- Shows empty state if no resources

**Props:**
```typescript
interface LearningDrawerProps {
  open: boolean;
  pageId: string;
  componentId?: string;
  onClose: () => void;
}
```

#### 3. ResourcePlayerModal (Content Viewer)

**File:** `src/components/Learning/ResourcePlayer/ResourcePlayerModal.component.tsx`

**Purpose:** Full-screen modal for displaying resource content

**Features:**
- Routes to correct player based on resourceType
- Shows resource metadata (title, description, difficulty, duration, categories)
- Clean close button
- Responsive sizing

**Player Routing:**
```typescript
switch (resource.resourceType) {
  case 'Video':     return <VideoPlayer resource={resource} />;
  case 'Storylane': return <StorylaneTour resource={resource} />;
  case 'Article':   return <ArticleViewer resource={resource} />;
}
```

#### 4. VideoPlayer (YouTube/Vimeo)

**File:** `src/components/Learning/ResourcePlayer/VideoPlayer.component.tsx`

**Purpose:** Embeds YouTube and Vimeo videos

**Features:**
- **Smart URL conversion:**
  - `youtube.com/watch?v=abc123` → `youtube.com/embed/abc123`
  - `youtu.be/abc123` → `youtube.com/embed/abc123`
  - `vimeo.com/123456` → `player.vimeo.com/video/123456`
- **16:9 responsive aspect ratio** (56.25% padding-bottom technique)
- Loading spinner while video loads
- Full permissions for video features (autoplay, fullscreen, etc.)

**Styling:** `VideoPlayer.less` - Responsive container with padding-bottom aspect ratio

#### 5. StorylaneTour (Interactive Demos)

**File:** `src/components/Learning/ResourcePlayer/StorylaneTour.component.tsx`

**Purpose:** Embeds Storylane interactive product demos

**Features:**
- Simple iframe embed
- Fixed height (600px) suitable for demos
- Loading spinner while demo loads
- Fullscreen support
- Clean, borderless presentation

**URL Format:** `https://app.storylane.io/share/xxxxxxxxxx`

**Styling:** `StorylaneTour.less` - Fixed height container

#### 6. ArticleViewer (Markdown Content)

**File:** `src/components/Learning/ResourcePlayer/ArticleViewer.component.tsx`

**Purpose:** Renders markdown article content

**Features:**
- Uses existing `RichTextEditorPreviewer` component
- Reads content from `resource.source.embedConfig.content`
- No truncation (`enableSeeMoreVariant={false}`)
- Full markdown support (headers, lists, code blocks, links, etc.)

#### 7. LearningResourceCard

**File:** `src/components/Learning/LearningResourceCard/LearningResourceCard.component.tsx`

**Purpose:** Card UI for individual resource in lists

**Features:**
- Shows resource type icon
- Displays title, description
- Shows difficulty badge
- Shows estimated duration
- Shows categories as tags
- Clickable to open resource

### Admin UI

#### 1. LearningResourcesPage (Management Table)

**File:** `src/pages/LearningResourcesPage/LearningResourcesPage.tsx`

**Purpose:** Admin interface for managing all learning resources

**Features:**
- **Table view** with columns:
  - Name (displayName or name)
  - Type (Article/Video/Storylane with colored tag)
  - Difficulty (Intro/Intermediate/Advanced)
  - Categories (multiple tags)
  - Contexts (pageId:componentId pairs)
  - Duration (converted to minutes)
  - Status (Active/Draft/Deprecated)
  - Actions (Preview, Edit, Delete buttons)
- **Pagination** (20 per page, configurable)
- **Create button** to add new resources
- **Preview** - Opens ResourcePlayerModal to view resource
- **Edit** - Opens LearningResourceForm with resource data
- **Delete** - Shows confirmation modal before deletion

**Access:** Need to add route to admin section

#### 2. LearningResourceForm (Create/Edit Form)

**File:** `src/pages/LearningResourcesPage/LearningResourceForm.component.tsx`

**Purpose:** Modal form for creating or editing learning resources

**Features:**
- **Form Fields:**
  - Name (required, unique identifier)
  - Display Name
  - Description (textarea)
  - Resource Type (select: Article/Video/Storylane)
  - Categories (multi-select)
  - Difficulty (select: Intro/Intermediate/Advanced)
  - Source URL (required, validated)
  - Source Provider (text)
  - **Embedded Content** (only for Article type) - Rich text editor for markdown
  - Estimated Duration (number in minutes, converted to seconds)
  - **Contexts** (dynamic Form.List):
    - Page ID (select from predefined list)
    - Component ID (optional text input)
    - Add/Remove buttons for multiple contexts
  - Status (select: Draft/Active/Deprecated)
- **Validation:**
  - Required fields enforced
  - URL format validated
  - At least one context required
- **Submission:**
  - Creates new resource or updates existing
  - Converts duration minutes → seconds
  - Handles embedded content for articles
  - Shows success/error toasts

**Constants in Form:**
```typescript
const RESOURCE_TYPES = ['Article', 'Video', 'Storylane'];
const DIFFICULTIES = ['Intro', 'Intermediate', 'Advanced'];
const CATEGORIES = ['Discovery', 'Administration', 'DataGovernance',
                    'DataQuality', 'Observability'];
const STATUSES = ['Draft', 'Active', 'Deprecated'];
const PAGE_IDS = ['glossary', 'glossaryTerm', 'domain', 'dataProduct',
                  'dataQuality', 'table', 'dashboard', 'pipeline', 'topic',
                  'explore', 'governance'];
```

### API Integration

**File:** `src/rest/learningResourceAPI.ts`

**Key Functions:**
```typescript
// Create new resource
export const createLearningResource = (data: CreateLearningResource): Promise<LearningResource>

// Get all resources (with optional filters)
export const getLearningResourcesList = (params?: {
  limit?: number;
  fields?: string;
  category?: string;
  difficulty?: string;
}): Promise<{ data: LearningResource[]; paging: Paging }>

// Get resources by context
export const getLearningResourcesByContext = (
  pageId: string,
  params?: {
    componentId?: string;
    limit?: number;
    fields?: string;
  }
): Promise<{ data: LearningResource[]; paging: Paging }>

// Update existing resource
export const updateLearningResource = (id: string, data: CreateLearningResource): Promise<LearningResource>

// Delete resource
export const deleteLearningResource = (id: string): Promise<void>
```

---

## Data Model

### TypeScript Interfaces

**File:** `src/rest/learningResourceAPI.ts`

```typescript
export interface LearningResource {
  id: string;
  name: string;
  fullyQualifiedName?: string;
  displayName?: string;
  description?: string;
  resourceType: 'Article' | 'Video' | 'Storylane';
  categories: string[];
  difficulty?: 'Intro' | 'Intermediate' | 'Advanced';
  source: {
    url: string;
    provider?: string;
    embedConfig?: {
      content?: string;  // For Article type - markdown content
      [key: string]: unknown;
    };
  };
  estimatedDuration?: number;  // In seconds
  contexts: Array<{
    pageId: string;
    componentId?: string;
  }>;
  status?: 'Draft' | 'Active' | 'Deprecated';
  owners?: EntityReference[];
  reviewers?: EntityReference[];
  version?: number;
  updatedAt?: number;
  updatedBy?: string;
  href?: string;
}

export interface CreateLearningResource {
  name: string;
  displayName?: string;
  description?: string;
  resourceType: 'Article' | 'Video' | 'Storylane';
  categories: string[];
  difficulty?: 'Intro' | 'Intermediate' | 'Advanced';
  source: {
    url: string;
    provider?: string;
    embedConfig?: {
      content?: string;
      [key: string]: unknown;
    };
  };
  estimatedDuration?: number;
  contexts: Array<{
    pageId: string;
    componentId?: string;
  }>;
  status?: 'Draft' | 'Active' | 'Deprecated';
  owners?: EntityReference[];
  reviewers?: EntityReference[];
}
```

### Context Matching Logic

Resources are matched to pages using a hierarchical system:

1. **Exact match:** `pageId` + `componentId` both match
2. **Page match:** `pageId` matches, no `componentId` specified in resource
3. **Broad match:** Resource applies to entire page

**Example:**
- Resource with `pageId: "glossary", componentId: "glossary-header"` → Only shows in glossary header
- Resource with `pageId: "glossary"` (no componentId) → Shows anywhere on glossary pages

---

## API Endpoints

### Base URL
`/api/v1/learning/resources`

### Endpoints

#### Create Resource
```http
POST /api/v1/learning/resources
Content-Type: application/json

{
  "name": "Intro_GlossaryBasics",
  "displayName": "Glossary Basics",
  "resourceType": "Article",
  "categories": ["Discovery"],
  "source": {
    "url": "https://example.com/resource",
    "provider": "Collate"
  },
  "contexts": [
    { "pageId": "glossary" }
  ]
}
```

#### List All Resources
```http
GET /api/v1/learning/resources?limit=100&fields=categories,contexts,difficulty
```

#### Get by Context
```http
GET /api/v1/learning/resources/context/glossary?componentId=glossary-header&limit=10
```

#### Get by ID
```http
GET /api/v1/learning/resources/{uuid}
```

#### Get by Name
```http
GET /api/v1/learning/resources/name/Intro_GlossaryBasics
```

#### Update Resource
```http
PATCH /api/v1/learning/resources/{uuid}
Content-Type: application/json-patch+json

[
  {
    "op": "replace",
    "path": "/difficulty",
    "value": "Advanced"
  }
]
```

#### Delete Resource
```http
DELETE /api/v1/learning/resources/{uuid}
```

---

## Sample Resources

### Current Resources (15 total)

**Location:** `openmetadata-service/src/main/resources/json/data/learningResource/`

#### Articles (14)

**Intro Level (5):**
1. `Intro_GlossaryBasics.json` - Glossary fundamentals
2. `Intro_DomainManagement.json` - Domain organization
3. `Intro_DataCatalogBasics.json` - Data catalog basics
4. `Intro_DataLineage2025.json` - Understanding lineage
5. `QuickStart_TableDiscovery.json` - Quick table discovery

**Intermediate Level (5):**
1. `Intermediate_GlossaryTerms.json` - Advanced glossary usage
2. `Intermediate_DataGovernance.json` - Governance frameworks
3. `Intermediate_DataGovernance2025.json` - Updated governance
4. `Intermediate_DataProducts.json` - Data product patterns
5. `Intermediate_DataQuality2025.json` - Data quality practices

**Advanced Level (4):**
1. `Advanced_DataQuality.json` - Data quality testing
2. `Advanced_DataProductMetrics.json` - Product metrics
3. `Advanced_DataObservability2025.json` - Observability patterns
4. `Advanced_DomainStrategies.json` - Domain strategies

#### Storylane Demos (1)

1. `Demo_GettingStartedCollate.json` - **PLACEHOLDER** - needs actual Storylane URL

### Resource Distribution by Category

- **Discovery:** 5 resources
- **DataGovernance:** 7 resources
- **DataQuality:** 3 resources
- **Administration:** 1 resource
- **Observability:** 1 resource

### Resource Distribution by Page Context

- **glossary:** 6 resources
- **glossaryTerm:** 4 resources
- **domain:** 3 resources
- **dataProduct:** 2 resources
- **dataQuality:** 1 resource
- **governance:** 1 resource
- **explore:** 2 resources
- **table:** 3 resources

---

## Integration Points

### Current Integrations

The LearningIcon is integrated in multiple components:

#### 1. Data Assets Header (All Entity Pages)
**File:** `src/components/DataAssets/DataAssetsHeader/DataAssetsHeader.component.tsx`

```tsx
<ButtonGroup className="spaced" size="small">
  {/* Other buttons */}
  <LearningIcon pageId={entityType} size="small" />
</ButtonGroup>
```

**Applies to all data asset types:**
- Table (`table`)
- Pipeline (`pipeline`)
- Dashboard (`dashboard`)
- Topic (`topic`)
- Container (`container`)
- MlModel (`mlmodel`)
- SearchIndex (`searchIndex`)
- And other entity types...

#### 2. Glossary Pages
**File:** `src/components/Glossary/GlossaryHeader/GlossaryHeader.component.tsx`

```tsx
<ButtonGroup className="spaced" size="small">
  <LearningIcon
    pageId={isGlossary ? 'glossary' : 'glossaryTerm'}
    size="small"
  />
  {/* Other buttons */}
</ButtonGroup>
```

**Resources shown:**
- Glossary-related articles and tutorials
- Dynamically switches between `glossary` and `glossaryTerm` context

#### 3. Domain Pages
**File:** `src/components/Domain/DomainDetails/DomainDetails.component.tsx`

```tsx
<ButtonGroup className="spaced" size="small">
  <LearningIcon pageId="domain" size="small" />
  {/* Other buttons */}
</ButtonGroup>
```

**Resources shown:**
- Domain management guides
- Domain strategy documents

#### 4. Data Product Pages
**File:** `src/components/DataProducts/DataProductsDetailsPage/DataProductsDetailsPage.component.tsx`

```tsx
<ButtonGroup className="spaced" size="small">
  <LearningIcon pageId="dataProduct" size="small" />
  {/* Other buttons */}
</ButtonGroup>
```

**Resources shown:**
- Data product creation guides
- Data product metrics tutorials

### Admin UI Route

**Path:** `/settings/preferences/learning-resources`

**File:** `src/components/AppRouter/SettingsRouter.tsx`

**Menu Location:** Settings → Preferences → Learning Resources

**Features:**
- Full CRUD for learning resources
- Preview resources in player modal
- Manage contexts, categories, difficulty levels

---

## What Was Removed

This section documents features that were removed during the simplification.

### Removed Entities

1. **LearningBadge**
   - Schema: `openmetadata-spec/.../entity/learning/learningBadge.json`
   - Repository: `LearningBadgeRepository.java`
   - Resource: `LearningBadgeResource.java`
   - Tests: `LearningBadgeResourceTest.java`
   - Purpose: Gamification badges awarded for completing resources

2. **LearningResourceProgress**
   - Schema: `openmetadata-spec/.../entity/learning/learningResourceProgress.json`
   - Repository: `LearningResourceProgressRepository.java`
   - Resource: `LearningResourceProgressResource.java`
   - Tests: `LearningResourceProgressResourceTest.java`
   - Purpose: Track user progress through resources

### Removed Fields from LearningResource

- **completionThreshold** (Double) - Percentage required to mark as complete
  - Removed from schema
  - Removed from repository validation
  - Removed from resource conversion
  - Removed from tests
  - Removed from all 14 sample JSON files

### Removed Frontend Components/Features

1. **Progress Tracking from Players:**
   - VideoPlayer: Removed YouTube API message handlers, time tracking, progress intervals
   - ArticleViewer: Removed scroll tracking, container refs, progress calculation
   - StorylaneTour: Removed time-based progress tracking

2. **Progress UI Components:**
   - ResourcePlayerModal: Removed progress bar, completion percentage, "Mark Complete" button
   - Removed `useLearningResourcePlayer` hook (entire file)

3. **Inline Display Components:**
   - LearningCenterBadge (created then removed - not needed)
   - InlineLearningPanel (created then removed - not needed)

### Removed Database Tables

**Note:** These tables were defined in migration files but never actually created in the schema:
- `learning_badge_entity`
- `learning_resource_progress_entity`

They were removed from migration files:
- `bootstrap/sql/migrations/native/1.10.5/mysql/schemaChanges.sql`
- `bootstrap/sql/migrations/native/1.10.5/postgres/schemaChanges.sql`

### Removed API Endpoints

- All badge-related endpoints (`/api/v1/learning/badges/*`)
- All progress-related endpoints (`/api/v1/learning/progress/*`)

---

## Next Steps

### Immediate (When Ready)

1. **Add Storylane URLs**
   - Get actual Storylane embed URLs from Collate learning center
   - Replace `PLACEHOLDER_URL` in `Demo_GettingStartedCollate.json`
   - Format: `https://app.storylane.io/share/xxxxxxxxxx`

2. **Add More Demos**
   - Create additional Storylane resources from learning center:
     - Data Governance demo
     - Data Lineage demo
     - Data Quality demo
     - Table Discovery demo
   - Use `Demo_GettingStartedCollate.json` as template

### Completed ✅

1. **Admin Route Added**
   - Route: `/settings/preferences/learning-resources`
   - Location: Settings → Preferences → Learning Resources
   - Admin-only access

2. **LearningIcon Coverage Expanded**
   - Added to DataAssetsHeader (covers all data asset entity pages)
   - Now shows on: Table, Pipeline, Dashboard, Topic, Container, etc.

### Optional Enhancements

2. **Resource Management**
   - Review and update article content as needed
   - Ensure external links remain valid
   - Update descriptions for clarity
   - Add more resources for underserved contexts

3. **Metrics (Future)**
   - Track which resources are viewed most
   - Identify popular topics
   - Inform content creation priorities
   - (Can be done via backend logging, no UI changes needed)

4. **Search (Future)**
   - Add search box in LearningDrawer
   - Filter resources by keyword
   - Search across title, description, categories

5. **Resource Suggestions (Future)**
   - Recommend related resources
   - "If you liked X, try Y"
   - Based on category/difficulty

---

## Technical Notes

### Build Commands

```bash
# Backend
mvn clean compile -pl openmetadata-service -DskipTests
mvn spotless:apply -pl openmetadata-service
mvn test-compile -pl openmetadata-service

# Frontend
cd openmetadata-ui/src/main/resources/ui
yarn lint:fix
yarn build
```

### File Locations Reference

**Backend:**
- Entity schema: `openmetadata-spec/src/main/resources/json/schema/entity/learning/learningResource.json`
- Repository: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/LearningResourceRepository.java`
- Resource: `openmetadata-service/src/main/java/org/openmetadata/service/resources/learning/LearningResourceResource.java`
- Tests: `openmetadata-service/src/test/java/org/openmetadata/service/resources/learning/LearningResourceResourceTest.java`
- Sample data: `openmetadata-service/src/main/resources/json/data/learningResource/*.json`
- Migrations: `bootstrap/sql/migrations/native/1.12.0/{mysql,postgres}/schemaChanges.sql`

**Frontend:**
- API client: `src/rest/learningResourceAPI.ts`
- LearningIcon: `src/components/Learning/LearningIcon/`
- LearningDrawer: `src/components/Learning/LearningDrawer/`
- ResourcePlayerModal: `src/components/Learning/ResourcePlayer/ResourcePlayerModal.component.tsx`
- VideoPlayer: `src/components/Learning/ResourcePlayer/VideoPlayer.component.tsx`
- StorylaneTour: `src/components/Learning/ResourcePlayer/StorylaneTour.component.tsx`
- ArticleViewer: `src/components/Learning/ResourcePlayer/ArticleViewer.component.tsx`
- ResourceCard: `src/components/Learning/LearningResourceCard/`
- Admin UI: `src/pages/LearningResourcesPage/`

### Dependencies

**Backend:**
- Standard OpenMetadata entity framework
- JDBI3 for database access
- Jackson for JSON serialization
- Standard REST resource patterns

**Frontend:**
- React + TypeScript
- Ant Design (Table, Form, Modal, Drawer, Badge, Button, etc.)
- react-i18next for translations
- RichTextEditorPreviewer for markdown (existing OM component)

### Translation Keys Used

**Existing Keys (already in codebase):**
- `label.learning-resources`
- `label.learning-resource`
- `label.difficulty`
- `label.category-plural`
- `label.context-plural`
- `label.duration`
- `label.status`
- `label.create`
- `label.update`
- `label.delete`
- `label.preview`
- `label.close`
- `message.learning-resources-available` (with count parameter)
- `message.resources-available` (with count parameter)
- `message.no-learning-resources-available`

**May Need to Add:**
- `label.resource-lowercase-plural`
- `label.learning-resources-for` (with context parameter)
- `label.component-id-optional`
- `label.page-id`
- `label.embedded-content`
- `label.source-url`
- `label.source-provider`
- `label.estimated-duration-minutes`
- `message.optional-markdown-content`
- `message.write-markdown-content`
- `server.learning-resources-fetch-error`

---

## Design Decisions & Rationale

### Why No Progress Tracking?

**Original Design:** Complex system with progress tracking, completion thresholds, badges, gamification.

**Simplified Design:** Just content delivery.

**Reasons:**
1. **Complexity vs Value:** Progress tracking added significant complexity with unclear value
2. **User Pressure:** Users felt pressured to "complete" resources rather than learn
3. **Privacy Concerns:** Tracking user behavior can raise privacy issues
4. **Simplicity:** Easier to maintain, easier to understand, easier to use
5. **Content Focus:** Focus on quality content, not gamification

### Why Lightbulb Icon (User-Initiated)?

**Alternatives considered:**
- Auto-show banner at top of page
- Inline panels in page content
- Floating widget in corner

**Chosen: Lightbulb in header**

**Reasons:**
1. **Non-intrusive:** Doesn't block or clutter the main content
2. **Discoverable:** Visible but not annoying
3. **User Control:** Users choose when to learn
4. **Familiar Pattern:** Similar to help/docs icons
5. **Badge Count:** Shows availability without requiring click

### Why Side Drawer vs Modal?

**For resource list:** Side drawer
**For content:** Full modal

**Reasons:**
1. **Drawer Benefits:**
   - Can stay open while user browses
   - Non-blocking for main content
   - Shows context (what page you're on)
   - Easy to dismiss but also easy to keep open

2. **Modal Benefits (for content):**
   - Immersive viewing experience
   - Full screen for videos/demos
   - Focused attention on content
   - Clear "viewing mode" vs "browsing mode"

### Why Three Resource Types?

**Article, Video, Storylane** - why not more?

**Reasoning:**
1. **Article (Markdown):**
   - Self-contained, searchable, version-controllable
   - Fast to load, accessible, printable
   - Good for reference documentation

2. **Video (YouTube/Vimeo):**
   - Engaging, visual, personality
   - Good for tutorials and overviews
   - Familiar platform

3. **Storylane (Interactive Demo):**
   - Hands-on experience without setup
   - Safe to explore (can't break anything)
   - Shows actual product UI

**Not included:**
- PDFs: Hard to read in browser, not responsive
- External links: Jarring experience leaving product
- Webinars: Too long, scheduling issues

---

## Success Metrics (Future)

While we don't track progress, we can measure success:

### Adoption Metrics
- Number of resources created
- Number of pages with LearningIcon integrated
- Diversity of contexts covered

### Quality Metrics
- % of resources with clear descriptions
- % of resources with owners
- % of critical features covered by resources

### Potential Usage Metrics (if instrumented)
- Lightbulb click rate
- Resource view counts
- Average time in ResourcePlayerModal
- Return visits to same resource

---

## Version History

### v1.0 - Current (2025-12-26)
- Simplified design with no progress tracking
- LearningIcon + LearningDrawer pattern
- Three resource types: Article, Video, Storylane
- Admin UI for resource management
- 15 sample resources (14 articles, 1 demo placeholder)
- Integrated in Glossary, Domain, Data Product pages

### v0.x - Previous (Removed)
- Complex progress tracking system
- Badge/gamification system
- Completion thresholds
- Auto-displaying inline panels
- Manual "Mark Complete" buttons

---

## Appendix: Code Snippets

### Adding LearningIcon to a New Page

```tsx
import { LearningIcon } from 'components/Learning/LearningIcon/LearningIcon.component';

// In your page header component:
<ButtonGroup className="spaced" size="small">
  <LearningIcon
    pageId="your-page-id"  // e.g., "table-details"
    componentId="optional-component-id"  // optional
    size="small"
  />
  {/* other header buttons */}
</ButtonGroup>
```

### Creating a New Resource via Admin UI

1. Navigate to Learning Resources admin page
2. Click "Add Resource" button
3. Fill in form:
   - Name: `Intermediate_YourFeature`
   - Display Name: "Your Feature Guide"
   - Description: Brief summary
   - Type: Article/Video/Storylane
   - Categories: Select relevant categories
   - Difficulty: Intro/Intermediate/Advanced
   - Source URL: External link or YouTube/Storylane URL
   - (If Article) Embedded Content: Markdown text
   - Duration: Estimated minutes
   - Contexts: Add pageId(s) where this should appear
   - Status: Active
4. Click "Create"

### Creating a Resource via JSON

```json
{
  "name": "Intermediate_MyFeature",
  "displayName": "Understanding My Feature",
  "description": "A comprehensive guide to using My Feature effectively",
  "resourceType": "Article",
  "categories": ["Discovery", "DataGovernance"],
  "difficulty": "Intermediate",
  "source": {
    "url": "https://www.getcollate.io/learning-center/my-feature",
    "provider": "Collate",
    "embedConfig": {
      "content": "# Understanding My Feature\n\nMarkdown content here..."
    }
  },
  "estimatedDuration": 600,
  "contexts": [
    {
      "pageId": "my-feature-page",
      "componentId": "feature-header"
    }
  ],
  "status": "Active",
  "owners": []
}
```

Save to: `openmetadata-service/src/main/resources/json/data/learning/resource/Intermediate_MyFeature.json`

---

## Support & Questions

For questions about this system:

1. **Design Questions:** Refer to this document
2. **Implementation Questions:** Check source files referenced in "File Locations"
3. **Bug Reports:** Standard OpenMetadata issue process
4. **Feature Requests:** Discuss with team, update "Next Steps" section

---

**End of Document**
