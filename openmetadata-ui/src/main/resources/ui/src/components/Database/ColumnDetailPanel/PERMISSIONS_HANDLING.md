# Permissions Handling in withColumnDetailPanel HOC

## Overview

The HOC properly handles all permissions including custom properties permissions for both props-based and context-based components.

## Permission Types Supported

### Standard Permissions
- **hasTagEditAccess** - Edit tags on fields/columns
- **hasGlossaryTermEditAccess** - Edit glossary terms on fields/columns
- **hasDescriptionEditAccess** - Edit descriptions on fields/columns

### Custom Properties Permissions
- **hasCustomPropertiesEditAccess** - Edit custom properties on fields/columns
- **hasCustomPropertiesViewAccess** - View custom properties on fields/columns

## Props-Based Components

For components that receive data via props (ContainerDataModel, SearchIndexFieldsTable), permissions are extracted from component props.

### Configuration Example

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
    hasCustomPropertiesEditAccess: props.hasCustomPropertiesEditAccess, // ✅ Custom properties
  }),
  readOnly: (props) => props.isReadOnly,
  onUpdate: async (props, updatedColumns) => { ... },
};
```

### Component Props

```typescript
const ContainerDataModel: FC<ContainerDataModelProps> = ({
  dataModel,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  hasCustomPropertiesEditAccess, // ✅ Custom properties permission
  isReadOnly,
  onUpdate,
  entityFqn,
  handleColumnClick,
}) => { ... };
```

## Context-Based Components

For components that use GenericContext (TopicSchema, MlModelFeaturesList, PipelineTaskTab), permissions are automatically extracted from context.

### Configuration Example

```typescript
const columnDetailPanelConfig: ColumnDetailPanelConfig<Field, TopicSchemaFieldsProps> = {
  mode: 'context',
  entityType: EntityType.TOPIC,
  column: (field) => field as unknown as Column,
};
```

### Permission Extraction

The HOC automatically extracts permissions from GenericContext:

```typescript
const contextPerms = context?.permissions || {};

return {
  hasTagEditAccess: contextPerms.EditAll || contextPerms.EditTags,
  hasGlossaryTermEditAccess: contextPerms.EditAll || contextPerms.EditGlossaryTerms,
  hasDescriptionEditAccess: contextPerms.EditAll || contextPerms.EditDescription,
  hasCustomPropertiesEditAccess: contextPerms.EditAll || contextPerms.EditCustomFields, // ✅
  hasCustomPropertiesViewAccess: contextPerms.ViewAll || contextPerms.ViewCustomFields, // ✅
};
```

## ColumnDetailPanel Integration

The HOC passes all permissions to the ColumnDetailPanel:

```typescript
<ColumnDetailPanel
  allColumns={allFields.map((field) => config.column(field))}
  column={selectedColumn}
  entityType={config.entityType}
  hasEditPermission={{
    tags: permissions.hasTagEditAccess && !isReadOnly,
    glossaryTerms: permissions.hasGlossaryTermEditAccess && !isReadOnly,
    description: permissions.hasDescriptionEditAccess && !isReadOnly,
    viewAllPermission: permissions.hasCustomPropertiesViewAccess || false,    // ✅ View permission
    customProperties: (permissions.hasCustomPropertiesEditAccess && !isReadOnly) || false, // ✅ Edit permission
  }}
  isOpen={isColumnDetailOpen}
  tableFqn={entityFqn}
  updateColumnDescription={updateColumnDescription}
  updateColumnTags={updateColumnTags}
  onClose={handleCloseColumnDetail}
  onColumnUpdate={handleColumnUpdate}
  onNavigate={handleColumnNavigate}
/>
```

## Permission Flow by Component

### ContainerDataModel (Props-based)
1. Parent component passes `hasCustomPropertiesEditAccess` prop
2. HOC extracts it via `config.permissions(props)`
3. HOC passes to ColumnDetailPanel as `customProperties` permission
4. User can edit custom properties if permitted and not readOnly

### TopicSchema (Context-based)
1. GenericProvider provides permissions via context
2. HOC extracts `EditCustomFields` / `ViewCustomFields` from context.permissions
3. HOC passes to ColumnDetailPanel as `customProperties` and `viewAllPermission`
4. User can view/edit custom properties based on context permissions

### MlModelFeaturesList (Context-based)
1. GenericProvider provides permissions via context
2. HOC extracts `EditCustomFields` / `ViewCustomFields` from context.permissions
3. HOC passes to ColumnDetailPanel
4. Custom properties available in detail panel

### PipelineTaskTab (Context-based)
1. GenericProvider provides permissions via context
2. HOC extracts `EditCustomFields` / `ViewCustomFields` from context.permissions
3. HOC passes to ColumnDetailPanel
4. Custom properties available in detail panel for tasks

### SearchIndexFieldsTable (Props-based)
1. Currently does not include custom properties in interface
2. HOC will default to `undefined` for custom properties permissions
3. ColumnDetailPanel will disable custom properties editing
4. Can be enhanced in future if search index fields need custom properties

## ReadOnly Handling

All edit permissions respect the `isReadOnly` flag:

```typescript
customProperties: (permissions.hasCustomPropertiesEditAccess && !isReadOnly) || false
```

This ensures:
- Deleted entities cannot have custom properties edited
- Version view displays are read-only
- Components can enforce read-only mode via props

## Type Safety

The HOC permission interface is properly typed:

```typescript
permissions: (props: TProps) => {
  hasTagEditAccess: boolean;
  hasGlossaryTermEditAccess: boolean;
  hasDescriptionEditAccess: boolean;
  hasCustomPropertiesEditAccess?: boolean;  // Optional for backward compatibility
  hasCustomPropertiesViewAccess?: boolean;  // Optional for backward compatibility
};
```

Optional properties allow components that don't use custom properties to omit them without TypeScript errors.

## Summary

✅ **Custom properties permissions are fully supported**
- Props-based components: Passed via component props
- Context-based components: Extracted from GenericContext
- Proper permission checking with readOnly flag
- Type-safe implementation
- Backward compatible (optional permissions)

All migrated components now have complete permission handling including custom properties view and edit permissions.
