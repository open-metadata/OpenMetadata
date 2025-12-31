# ColumnDetailPanel HOC Migration Guide

## Overview

The `withColumnDetailPanel` HOC encapsulates all ColumnDetailPanel integration logic, eliminating ~50 lines of boilerplate code per component. It supports **two modes**: props-based and context-based data sources.

## Table of Contents
- [Quick Start](#quick-start)
- [Props Mode (for components receiving data via props)](#props-mode)
- [Context Mode (for components using useGenericContext)](#context-mode)
- [Migration Examples](#migration-examples)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Update Component Interface

```typescript
// Before
export interface YourComponentProps {
  // ... existing props
}

// After
import { InjectedColumnDetailPanelProps } from '../../Database/ColumnDetailPanel/withColumnDetailPanel';

export interface YourComponentProps
  extends Partial<InjectedColumnDetailPanelProps<YourFieldType>> {
  // ... existing props
}
```

### 2. Update Component Implementation

```typescript
// Add handleColumnClick to destructured props
const YourComponent: FC<YourComponentProps> = ({
  // ... existing props
  handleColumnClick, // <-- Add this injected prop
}) => {
  // Remove these manual state declarations:
  // ❌ const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
  // ❌ const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);

  // Remove these manual handlers:
  // ❌ const handleColumnClick = useCallback(...);
  // ❌ const handleCloseColumnDetail = useCallback(...);
  // ❌ const handleColumnUpdate = useCallback(...);
  // ❌ const handleColumnNavigate = useCallback(...);
```

### 3. Update Click Handlers

```typescript
// In your column name renderer
onClick={(e) => {
  if ((e.target as HTMLElement).closest('button, a')) {
    return;
  }
  handleColumnClick(record); // Use injected handler
}}
```

### 4. Remove Manual ColumnDetailPanel

```typescript
// ❌ Remove this entire block:
<ColumnDetailPanel
  allColumns={...}
  column={selectedColumn}
  // ... all props
/>
```

### 5. Wrap with HOC

```typescript
// At the end of your file:
export default withColumnDetailPanel<FieldType, PropsType>({
  mode: 'props' | 'context', // Choose based on data source
  entityType: EntityType.YOUR_TYPE,
  column: (field) => field as unknown as Column,
  // ... mode-specific config
})(YourComponent);
```

---

## Props Mode

**Use when**: Component receives data via props (e.g., `searchIndexFields`, `dataModel.columns`)

### Configuration

```typescript
import { withColumnDetailPanel, PropsBasedConfig } from '../Database/ColumnDetailPanel/withColumnDetailPanel';
import { EntityType } from '../../../enums/entity.enum';
import { Column } from '../../../generated/entity/data/table';

const config: PropsBasedConfig<YourFieldType, YourPropsType> = {
  mode: 'props',
  entityType: EntityType.YOUR_TYPE,

  // Convert your field type to Column
  column: (field) => field as unknown as Column,

  // Extract fields from props
  allFields: (props) => props.yourFields,

  // Extract permissions from props
  permissions: (props) => ({
    hasTagEditAccess: props.hasTagEditAccess,
    hasGlossaryTermEditAccess: props.hasGlossaryTermEditAccess,
    hasDescriptionEditAccess: props.hasDescriptionEditAccess,
  }),

  // Determine read-only state
  readOnly: (props) => props.isReadOnly || false,

  // Handle updates
  onUpdate: (props, updatedFields) => props.onUpdate(updatedFields),
};

export default withColumnDetailPanel(config)(YourComponent);
```

### Complete Example: SearchIndexFieldsTable

```typescript
// SearchIndexFieldsTable.interface.ts
import { InjectedColumnDetailPanelProps } from '../../components/Database/ColumnDetailPanel/withColumnDetailPanel';
import { SearchIndexField } from '../../generated/entity/data/searchIndex';

export interface SearchIndexFieldsTableProps
  extends Partial<InjectedColumnDetailPanelProps<SearchIndexField>> {
  searchIndexFields: SearchIndexField[];
  hasDescriptionEditAccess: boolean;
  hasTagEditAccess: boolean;
  hasGlossaryTermEditAccess: boolean;
  isReadOnly?: boolean;
  entityFqn: string;
  onUpdate: (fields: SearchIndexField[]) => Promise<void>;
}

// SearchIndexFieldsTable.tsx
const SearchIndexFieldsTable: FC<SearchIndexFieldsTableProps> = ({
  searchIndexFields,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  isReadOnly,
  entityFqn,
  onUpdate,
  handleColumnClick, // Injected by HOC
}) => {
  // Component implementation...

  const renderName = (field: SearchIndexField) => (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        handleColumnClick?.(field);
      }}>
      {getEntityName(field)}
    </div>
  );

  return <Table {...props} />;
};

// HOC Configuration
const config: PropsBasedConfig<SearchIndexField, SearchIndexFieldsTableProps> = {
  mode: 'props',
  entityType: EntityType.SEARCH_INDEX,
  column: (field) => field as unknown as Column,
  allFields: (props) => props.searchIndexFields,
  permissions: (props) => ({
    hasTagEditAccess: props.hasTagEditAccess,
    hasGlossaryTermEditAccess: props.hasGlossaryTermEditAccess,
    hasDescriptionEditAccess: props.hasDescriptionEditAccess,
  }),
  readOnly: (props) => props.isReadOnly || false,
  onUpdate: (props, fields) => props.onUpdate(fields),
};

export default withColumnDetailPanel(config)(SearchIndexFieldsTable);
```

---

## Context Mode

**Use when**: Component uses `useGenericContext` for data (e.g., `TopicSchema`, `APIEndpointSchema`)

### Configuration

```typescript
import { withColumnDetailPanel, ContextBasedConfig } from '../Database/ColumnDetailPanel/withColumnDetailPanel';
import { EntityType } from '../../../enums/entity.enum';
import { Column } from '../../../generated/entity/data/table';

const config: ContextBasedConfig<YourFieldType, YourPropsType> = {
  mode: 'context',
  entityType: EntityType.YOUR_TYPE,

  // Convert your field type to Column
  column: (field) => field as unknown as Column,

  // Optional: custom entity FQN extraction
  // entityFqn: (props) => props.customFqn,
};

export default withColumnDetailPanel(config)(YourComponent);
```

### What the HOC Handles Automatically

When using context mode, the HOC automatically:

1. **Extracts fields** from:
   - `context.data.messageSchema.schemaFields` (Topics)
   - `context.data.dataModel.columns` (Containers, Dashboards)
   - `context.data.columns` (other types)

2. **Maps permissions** from:
   - `context.permissions.EditTags` → `hasTagEditAccess`
   - `context.permissions.EditGlossaryTerms` → `hasGlossaryTermEditAccess`
   - `context.permissions.EditDescription` → `hasDescriptionEditAccess`
   - `context.permissions.ViewAll` → `viewAllPermission`
   - `context.permissions.ViewCustomFields` → `customProperties`

3. **Determines read-only** from:
   - `context.data.deleted`

4. **Handles updates** via:
   - `context.onUpdate(updatedData)`

### Complete Example: TopicSchema

```typescript
// TopicSchema.interface.tsx
import { InjectedColumnDetailPanelProps } from '../../Database/ColumnDetailPanel/withColumnDetailPanel';
import { Field } from '../../../generated/entity/data/topic';

export interface TopicSchemaFieldsProps
  extends HTMLAttributes<TableProps<Field>>,
    Partial<InjectedColumnDetailPanelProps<Field>> {
  schemaTypePlaceholder?: ReactNode;
  defaultExpandAllRows?: boolean;
}

// TopicSchema.tsx
const TopicSchemaFields: FC<TopicSchemaFieldsProps> = ({
  className,
  schemaTypePlaceholder,
  handleColumnClick, // Injected by HOC
}) => {
  const { t } = useTranslation();
  const { data: topicDetails, isVersionView } = useGenericContext<Topic>();

  const renderSchemaName = useCallback(
    (_: unknown, record: Field) => (
      <div
        onClick={(e) => {
          if (isVersionView || !handleColumnClick) return;
          if ((e.target as HTMLElement).closest('button, a')) return;
          handleColumnClick(record);
        }}>
        {getEntityName(record)}
      </div>
    ),
    [isVersionView, handleColumnClick]
  );

  return <Table {...props} />;
};

// HOC Configuration - Just 3 lines!
export default withColumnDetailPanel<Field, TopicSchemaFieldsProps>({
  mode: 'context',
  entityType: EntityType.TOPIC,
  column: (field) => field as unknown as Column,
})(TopicSchemaFields);
```

---

## Migration Examples

### Example 1: Props-Based Component (ContainerDataModel)

**Before**: ~120 lines of boilerplate

```typescript
const ContainerDataModel: FC<ContainerDataModelProps> = ({
  dataModel,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  isReadOnly,
  onUpdate,
  entityFqn,
}) => {
  // ❌ Manual state
  const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
  const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);

  // ❌ Manual click handler
  const handleColumnClick = useCallback((column: Column) => {
    setSelectedColumn(column);
    setIsColumnDetailOpen(true);
  }, []);

  // ❌ Manual close handler
  const handleCloseColumnDetail = useCallback(() => {
    setIsColumnDetailOpen(false);
    setSelectedColumn(null);
  }, []);

  // ❌ Manual update handler
  const handleColumnUpdate = useCallback(
    (updatedColumn: Column) => {
      const containerDataModel = cloneDeep(dataModel);
      updateContainerColumnDescription(/*...*/);
      updateContainerColumnTags(/*...*/);
      onUpdate(containerDataModel);
      setSelectedColumn(updatedColumn);
    },
    [dataModel, onUpdate]
  );

  // ... more handlers

  return (
    <>
      <Table {...props} />
      {/* ❌ Manual ColumnDetailPanel */}
      <ColumnDetailPanel
        allColumns={dataModel?.columns ?? []}
        column={selectedColumn}
        entityType={EntityType.CONTAINER}
        hasEditPermission={{
          tags: hasTagEditAccess,
          glossaryTerms: hasGlossaryTermEditAccess,
          description: hasDescriptionEditAccess,
        }}
        isOpen={isColumnDetailOpen}
        tableFqn={entityFqn}
        updateColumnDescription={/*...*/}
        updateColumnTags={/*...*/}
        onClose={handleCloseColumnDetail}
        onColumnUpdate={handleColumnUpdate}
        onNavigate={handleColumnNavigate}
      />
    </>
  );
};

export default ContainerDataModel;
```

**After**: ~20 lines total

```typescript
const ContainerDataModel: FC<ContainerDataModelProps> = ({
  dataModel,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  isReadOnly,
  onUpdate,
  entityFqn,
  handleColumnClick, // ✅ Injected by HOC
}) => {
  // Component logic stays the same
  return <Table {...props} />;
};

// ✅ Just configure the HOC
export default withColumnDetailPanel<Column, ContainerDataModelProps>({
  mode: 'props',
  entityType: EntityType.CONTAINER,
  column: (field) => field,
  allFields: (props) => props.dataModel?.columns ?? [],
  permissions: (props) => ({
    hasTagEditAccess: props.hasTagEditAccess,
    hasGlossaryTermEditAccess: props.hasGlossaryTermEditAccess,
    hasDescriptionEditAccess: props.hasDescriptionEditAccess,
  }),
  readOnly: (props) => props.isReadOnly,
  onUpdate: (props, fields) => {
    const updated = { ...props.dataModel, columns: fields };
    return props.onUpdate(updated);
  },
})(ContainerDataModel);
```

### Example 2: Context-Based Component (APIEndpointSchema)

**Before**: ~150 lines including ColumnDetailPanel setup

```typescript
const APIEndpointSchema: FC<Props> = () => {
  const { data, permissions, onUpdate } = useGenericContext<APICollection>();

  // ❌ All the same manual state and handlers
  const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
  const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);
  // ... handlers ...

  return (
    <>
      <Table {...props} />
      <ColumnDetailPanel /* ... */ />
    </>
  );
};

export default APIEndpointSchema;
```

**After**: ~30 lines

```typescript
const APIEndpointSchema: FC<Props> = ({
  handleColumnClick, // ✅ Injected
}) => {
  const { data } = useGenericContext<APICollection>();

  // Component logic stays the same
  return <Table {...props} />;
};

// ✅ Minimal configuration
export default withColumnDetailPanel<Field, Props>({
  mode: 'context',
  entityType: EntityType.API_ENDPOINT,
  column: (field) => field as unknown as Column,
})(APIEndpointSchema);
```

---

## Testing

### Unit Tests

Most existing tests should pass without changes. If you need to test column click behavior:

```typescript
import { render, fireEvent } from '@testing-library/react';
import YourComponent from './YourComponent';

describe('YourComponent with HOC', () => {
  it('should render correctly', () => {
    const { getByTestId } = render(<YourComponent {...mockProps} />);
    expect(getByTestId('your-table')).toBeInTheDocument();
  });

  // The HOC provides handleColumnClick automatically
  // Your component just needs to call it
  it('should call handleColumnClick when column is clicked', () => {
    const { getByText } = render(<YourComponent {...mockProps} />);
    const column = getByText('Column Name');
    fireEvent.click(column);
    // ColumnDetailPanel will open (handled by HOC)
  });
});
```

### Integration Tests

Run existing E2E tests - they should pass without modification:

```bash
yarn test --testPathPattern="YourComponent.test"
```

---

## Troubleshooting

### Issue: "Cannot read property 'handleColumnClick' of undefined"

**Solution**: Make sure you're destructuring `handleColumnClick` from props:

```typescript
const YourComponent: FC<Props> = ({
  handleColumnClick, // Don't forget this!
  // ... other props
}) => {
```

### Issue: ColumnDetailPanel not opening

**Checklist**:
1. ✅ Is `handleColumnClick` being called in your click handler?
2. ✅ Are you checking `if (!handleColumnClick) return`?
3. ✅ Did you remove the manual ColumnDetailPanel component?
4. ✅ Is the HOC wrapper at the end of your file?

### Issue: Permissions not working in context mode

**Solution**: The HOC reads from `context.permissions` automatically. Ensure your component is wrapped with `GenericProvider`:

```typescript
<GenericProvider
  data={yourData}
  permissions={permissions}
  onUpdate={onUpdate}>
  <YourComponent />
</GenericProvider>
```

### Issue: Version view still allows clicks

**Solution**: Add version view check in your click handler:

```typescript
onClick={(e) => {
  if (isVersionView || !handleColumnClick) return; // Add this check
  if ((e.target as HTMLElement).closest('button, a')) return;
  handleColumnClick(record);
}}
```

### Issue: TypeScript errors with field types

**Solution**: Use type assertion when converting fields to columns:

```typescript
column: (field) => field as unknown as Column,
```

---

## Best Practices

### 1. Always Add Null Check

```typescript
onClick={(e) => {
  if (!handleColumnClick) return; // Guard against undefined
  handleColumnClick(record);
}}
```

### 2. Prevent Event Bubbling

```typescript
onClick={(e) => {
  // Don't open panel when clicking buttons/links inside the cell
  if ((e.target as HTMLElement).closest('button, a')) return;
  handleColumnClick?.(record);
}}
```

### 3. Support Keyboard Navigation

```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleColumnClick?.(record);
  }
}}
```

### 4. Respect Read-Only State

```typescript
// For props mode, pass isReadOnly
readOnly: (props) => props.isReadOnly || props.deleted || false,

// For context mode, it's automatic from context.data.deleted
```

---

## Migration Checklist

Use this checklist when migrating a component:

- [ ] Import `InjectedColumnDetailPanelProps` in interface file
- [ ] Extend component props interface with `Partial<InjectedColumnDetailPanelProps<FieldType>>`
- [ ] Add `handleColumnClick` to component prop destructuring
- [ ] Remove manual state: `selectedColumn`, `isColumnDetailOpen`
- [ ] Remove manual handlers: `handleColumnClick`, `handleCloseColumnDetail`, `handleColumnUpdate`, `handleColumnNavigate`
- [ ] Update column click handler to use injected `handleColumnClick`
- [ ] Remove manual `<ColumnDetailPanel>` component
- [ ] Add HOC wrapper at end of file with correct configuration
- [ ] Run tests to verify functionality
- [ ] Update component documentation/comments if needed

---

## Support

For questions or issues:
1. Check existing migrated components: `SearchIndexFieldsTable`, `TopicSchema`
2. Review this guide
3. Ask in the team channel

---

## Summary

### Code Reduction

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Lines per component | ~50-150 | ~5-10 | ~85-95% |
| State management | Manual | Automatic | 100% |
| Handler functions | 4-6 functions | 0 functions | 100% |
| ColumnDetailPanel props | 15+ props | 0 props | 100% |

### Benefits

✅ **DRY Principle**: No code duplication across components
✅ **Type Safety**: Full TypeScript support with generics
✅ **Maintainability**: Changes in one place affect all components
✅ **Flexibility**: Supports both props and context patterns
✅ **Testing**: Existing tests continue to work
✅ **Consistency**: Same behavior across all table components
