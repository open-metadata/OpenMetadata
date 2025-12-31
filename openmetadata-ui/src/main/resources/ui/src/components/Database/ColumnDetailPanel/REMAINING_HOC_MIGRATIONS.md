# Remaining Component Migrations to withColumnDetailPanel HOC

This document outlines the migration strategy for remaining components to use the `withColumnDetailPanel` HOC for consistency.

## Migration Strategy

All components will be migrated to use **props-based HOC configuration** since they receive data via props rather than context.

---

## 1. Container Data Model ✓ (READY TO MIGRATE)

**File**: `src/components/Container/ContainerDataModel/ContainerDataModel.tsx`

**Current Pattern**: Props-based with manual ColumnDetailPanel integration

**Migration Steps**:

###Step 1: Update imports
Remove:
- `ColumnDetailPanel` import
- `findFieldByFQN` import
- `cloneDeep` import (if only used for column updates)

Add:
```typescript
import { withColumnDetailPanel, ColumnDetailPanelConfig } from '../../Database/ColumnDetailPanel/withColumnDetailPanel';
```

### Step 2: Remove manual state and handlers
Remove these state variables:
```typescript
const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);
```

Remove these handlers:
```typescript
const handleColumnClick = useCallback((column: Column) => { ... }, []);
const handleCloseColumnDetail = useCallback(() => { ... }, []);
const handleColumnUpdate = useCallback((updatedColumn: Column) => { ... }, []);
const handleColumnNavigate = useCallback((column: Column) => { ... }, []);
```

### Step 3: Add injected props to component signature
```typescript
const ContainerDataModel: FC<ContainerDataModelProps> = ({
  dataModel,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  hasCustomPropertiesEditAccess,
  isReadOnly,
  onUpdate,
  entityFqn,
  handleColumnClick, // ADDED: Injected by HOC
}) => {
```

### Step 4: Remove manual ColumnDetailPanel JSX
Remove the entire `<ColumnDetailPanel>` component and its custom update functions.

### Step 5: Add HOC configuration and export
At the end of the file, before export:
```typescript
const columnDetailPanelConfig: ColumnDetailPanelConfig<Column, ContainerDataModelProps> = {
  mode: 'props',
  entityType: EntityType.CONTAINER,
  column: (field) => field,
  allFields: (props) => pruneEmptyChildren(props.dataModel?.columns ?? []),
  permissions: (props) => ({
    hasTagEditAccess: props.hasTagEditAccess,
    hasGlossaryTermEditAccess: props.hasGlossaryTermEditAccess,
    hasDescriptionEditAccess: props.hasDescriptionEditAccess,
  }),
  readOnly: (props) => props.isReadOnly,
  onUpdate: async (props, updatedColumns) => {
    const updatedDataModel = { ...props.dataModel, columns: updatedColumns };
    await props.onUpdate(updatedDataModel);
  },
};

export default withColumnDetailPanel(columnDetailPanelConfig)(ContainerDataModel);
```

**Estimated Lines Removed**: ~50 lines of boilerplate

---

## 2. ML Model Features List ✓ (READY TO MIGRATE)

**File**: `src/components/MlModel/MlModelDetail/MlModelFeaturesList.tsx`

**Current Pattern**: Context-based with manual ColumnDetailPanel integration

**Migration Steps**:

### Step 1: Update imports
Add:
```typescript
import { withColumnDetailPanel, ColumnDetailPanelConfig } from '../../Database/ColumnDetailPanel/withColumnDetailPanel';
```

### Step 2: Remove manual state and handlers
Remove:
```typescript
const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);
const handleColumnClick = useCallback(...);
const handleCloseColumnDetail = useCallback(...);
const handleColumnUpdate = useCallback(...);
const handleColumnNavigate = useCallback(...);
```

### Step 3: Add injected props to component signature
```typescript
const MlModelFeaturesList: FC<{
  handleColumnClick?: (feature: MlFeature) => void;
}> = ({ handleColumnClick }) => {
```

### Step 4: Remove manual ColumnDetailPanel JSX

### Step 5: Add HOC configuration
```typescript
const columnDetailPanelConfig: ColumnDetailPanelConfig<MlFeature, {}> = {
  mode: 'context',
  entityType: EntityType.MLMODEL,
  column: (field) => field as unknown as Column,
};

export default withColumnDetailPanel(columnDetailPanelConfig)(MlModelFeaturesList);
```

**Note**: This uses context mode since it gets data from `useGenericContext`.

**Estimated Lines Removed**: ~40 lines

---

## 3. Pipeline Task Tab ✓ (READY TO MIGRATE)

**File**: `src/components/Pipeline/PipelineTaskTab/PipelineTaskTab.tsx`

**Current Pattern**: Context-based with manual ColumnDetailPanel integration

**Migration Steps**:

### Step 1: Update imports
Add:
```typescript
import { withColumnDetailPanel, ColumnDetailPanelConfig } from '../../Database/ColumnDetailPanel/withColumnDetailPanel';
```

### Step 2: Remove manual state and handlers
Remove:
```typescript
const [selectedTask, setSelectedTask] = useState<Task | null>(null);
const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
const handleTaskClick = (task: Task) => { ... };
const handleDetailPanelClose = () => { ... };
const handleTaskDetailUpdate = (updatedTask: Task) => { ... };
const handleTaskNavigate = (task: Task) => { ... };
```

Also remove:
```typescript
const handleTaskDescriptionUpdate = async (...) => { ... };
const handleTaskTagsUpdate = async (...) => { ... };
```

### Step 3: Add injected prop to component signature
```typescript
export const PipelineTaskTab: FC<{
  handleColumnClick?: (task: Task) => void;
}> = ({ handleColumnClick }) => {
```

### Step 4: Update task name render to use injected handler
In the `taskColumns` array, update the name column render:
```typescript
onClick={() => handleColumnClick && handleColumnClick(record)}
```

### Step 5: Remove manual ColumnDetailPanel JSX

### Step 6: Add HOC configuration
```typescript
const columnDetailPanelConfig: ColumnDetailPanelConfig<Task, {}> = {
  mode: 'context',
  entityType: EntityType.PIPELINE,
  column: (field) => field as unknown as Column,
};

// Since PipelineTaskTab is exported with export const, we need to wrap it differently
const PipelineTaskTabWithHOC = withColumnDetailPanel(columnDetailPanelConfig)(PipelineTaskTab);
export { PipelineTaskTabWithHOC as PipelineTaskTab };
```

**Estimated Lines Removed**: ~45 lines

---

## 4. API Endpoint Schema ⚠️ (SPECIAL CASE)

**File**: `src/components/APIEndpoint/APIEndpointSchema/APIEndpointSchema.tsx`

**Current Pattern**: Context-based with dual schema (request/response)

**Challenge**: This component handles TWO schemas - `requestSchema` and `responseSchema`. The HOC needs to support switching between them.

**Migration Approach**:

**Option A - Extend HOC** (Recommended):
Enhance the HOC to support a `schemaKey` parameter for components with multiple schemas.

**Option B - Keep Manual** (Temporary):
Due to the complexity of dual schemas, keep manual implementation for now and migrate later when HOC supports this pattern.

**Decision**: Keep manual for now, add TODO comment for future enhancement.

---

## 5. Schema Table & Model Tab ❌ (NOT RECOMMENDED)

**Files**:
- `src/components/Database/SchemaTable/SchemaTable.component.tsx`
- `src/components/Dashboard/DataModel/DataModels/ModelTab/ModelTab.component.tsx`

**Reason NOT to migrate**:
- These components use **server-side pagination**
- Column updates go directly to backend APIs (`updateTableColumn`, `updateDataModelColumn`)
- They don't update a parent entity's columns array
- The HOC pattern doesn't fit their architecture

**Recommendation**: Keep manual implementation.

---

## Migration Order

1. ✅ **ContainerDataModel** - Easiest, props-based, straightforward
2. ✅ **MlModelFeaturesList** - Easy, context-based, similar to TopicSchema
3. ✅ **PipelineTaskTab** - Easy, context-based, similar to TopicSchema
4. ⚠️ **APIEndpointSchema** - Keep manual for now (dual schema complexity)
5. ❌ **SchemaTable** - Do not migrate (server-side pagination)
6. ❌ **ModelTab** - Do not migrate (server-side pagination)

---

## Testing Checklist

After each migration:
- [ ] Component renders without errors
- [ ] Clicking on field/column opens detail panel
- [ ] Navigating between fields works
- [ ] Editing description works and persists
- [ ] Adding/removing tags works and persists
- [ ] Adding/removing glossary terms works and persists
- [ ] Closing panel works
- [ ] All existing unit tests pass
- [ ] Manual UI testing completed

---

## Benefits of Migration

1. **Consistency**: All similar components use the same pattern
2. **Code Reduction**: ~40-50 lines removed per component
3. **Maintainability**: Single source of truth for ColumnDetailPanel integration
4. **Bug Fixes**: Automatic benefit from HOC improvements (like the glossary term fix)
5. **Type Safety**: TypeScript ensures correct HOC configuration
