/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { cloneDeep } from 'lodash';
import React, { ComponentType, useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { ContainerDataModel } from '../../../generated/entity/data/container';
import { MlFeature } from '../../../generated/entity/data/mlmodel';
import { Task } from '../../../generated/entity/data/pipeline';
import { Column } from '../../../generated/entity/data/table';
import {
  Field,
  MessageSchemaObject,
} from '../../../generated/entity/data/topic';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  findFieldByFQN,
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TableUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ColumnDetailPanel } from './ColumnDetailPanel.component';

/**
 * Type representing data that can be used in context mode
 * Supports entities with:
 * - messageSchema (Topic)
 * - dataModel (Container)
 * - columns (Table)
 * - tasks (Pipeline)
 * - mlFeatures (ML Model)
 */
type ContextEntityData = {
  messageSchema?: MessageSchemaObject;
  dataModel?: ContainerDataModel;
  columns?: Column[];
  tasks?: Task[];
  mlFeatures?: MlFeature[];
  deleted?: boolean;
};

/**
 * Configuration interface for props-based components
 */
export interface PropsBasedConfig<TField, TProps> {
  mode: 'props';
  /** Entity type for the component */
  entityType: EntityType;
  /** Convert entity field to Column type */
  column: (field: TField) => Column;
  /** Get all fields from component props */
  allFields: (props: TProps) => TField[];
  /** Get permissions from props */
  permissions: (props: TProps) => {
    hasTagEditAccess: boolean;
    hasGlossaryTermEditAccess: boolean;
    hasDescriptionEditAccess: boolean;
    hasCustomPropertiesEditAccess?: boolean;
    hasCustomPropertiesViewAccess?: boolean;
  };
  /** Get readOnly state */
  readOnly: (props: TProps) => boolean;
  /** Update handler */
  onUpdate: (props: TProps, updatedFields: TField[]) => void | Promise<void>;
}

/**
 * Configuration interface for context-based components
 */
export interface ContextBasedConfig<TField, TProps> {
  mode: 'context';
  /** Entity type for the component */
  entityType: EntityType;
  /** Convert entity field to Column type */
  column: (field: TField) => Column;
  /** Get entity FQN (optional, defaults to useParams fqn) */
  entityFqn?: (props: TProps) => string;
}

/**
 * Union type for HOC configuration - supports both props and context modes
 */
export type ColumnDetailPanelConfig<TField, TProps> =
  | PropsBasedConfig<TField, TProps>
  | ContextBasedConfig<TField, TProps>;

/**
 * Props injected by the HOC into the wrapped component
 */
export interface InjectedColumnDetailPanelProps<TField = unknown> {
  /** Handler for column click to open detail panel */
  handleColumnClick: (field: TField) => void;
  /** Whether the column detail panel is open */
  isColumnDetailOpen: boolean;
  /** Handler to close the column detail panel */
  handleCloseColumnDetail: () => void;
}

/**
 * Higher-Order Component that adds ColumnDetailPanel functionality to table components.
 *
 * Supports two modes:
 * 1. Props mode: Data comes from component props (e.g., SearchIndexFieldsTable)
 * 2. Context mode: Data comes from useGenericContext (e.g., TopicSchema)
 *
 * @param config Configuration for field type conversion and data source
 * @returns A function that wraps a component with ColumnDetailPanel functionality
 *
 * @example Props Mode
 * ```tsx
 * const config: PropsBasedConfig<SearchIndexField, SearchIndexFieldsTableProps> = {
 *   mode: 'props',
 *   entityType: EntityType.SEARCH_INDEX,
 *   column: (field) => field as unknown as Column,
 *   allFields: (props) => props.searchIndexFields,
 *   permissions: (props) => ({...}),
 *   readOnly: (props) => props.isReadOnly || false,
 *   onUpdate: (props, fields) => props.onUpdate(fields),
 * };
 * export default withColumnDetailPanel(config)(SearchIndexFieldsTable);
 * ```
 *
 * @example Context Mode
 * ```tsx
 * const config: ContextBasedConfig<Field, TopicSchemaProps> = {
 *   mode: 'context',
 *   entityType: EntityType.TOPIC,
 *   column: (field) => field as unknown as Column,
 * };
 * export default withColumnDetailPanel(config)(TopicSchema);
 * ```
 */
export function withColumnDetailPanel<TField, TProps>(
  config: ColumnDetailPanelConfig<TField, TProps>
) {
  return function (
    WrappedComponent: ComponentType<
      TProps & InjectedColumnDetailPanelProps<TField>
    >
  ): ComponentType<TProps> {
    const ComponentWithColumnDetailPanel: React.FC<TProps> = (props) => {
      const { fqn } = useParams<{ fqn: string }>();
      const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
      const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);

      const context = useGenericContext();

      const allFields = useMemo(() => {
        if (config.mode === 'props') {
          return config.allFields(props);
        }

        const data = context?.data as ContextEntityData;

        return (data?.messageSchema?.schemaFields ||
          data?.dataModel?.columns ||
          data?.columns ||
          data?.tasks ||
          data?.mlFeatures ||
          []) as TField[];
      }, [props, context]);

      const entityFqn = useMemo(() => {
        if (config.mode === 'context' && config.entityFqn) {
          return config.entityFqn(props);
        }

        return fqn || '';
      }, [fqn, props]);

      const permissions = useMemo(() => {
        if (config.mode === 'props') {
          return config.permissions(props);
        }

        const contextPerms = context?.permissions || {};

        return {
          hasTagEditAccess: contextPerms.EditAll || contextPerms.EditTags,
          hasGlossaryTermEditAccess:
            contextPerms.EditAll || contextPerms.EditGlossaryTerms,
          hasDescriptionEditAccess:
            contextPerms.EditAll || contextPerms.EditDescription,
          hasCustomPropertiesEditAccess:
            contextPerms.EditAll || contextPerms.EditCustomFields,
          hasCustomPropertiesViewAccess:
            contextPerms.ViewAll || contextPerms.ViewCustomFields,
        };
      }, [props, context]);

      const isReadOnly = useMemo(() => {
        if (config.mode === 'props') {
          return config.readOnly(props);
        }

        return context?.data?.deleted || false;
      }, [props, context]);

      const handleColumnClick = useCallback((field: TField) => {
        const column = config.column(field);
        setSelectedColumn(column);
        setIsColumnDetailOpen(true);
      }, []);

      const handleCloseColumnDetail = useCallback(() => {
        setIsColumnDetailOpen(false);
        setSelectedColumn(null);
      }, []);

      const handleUpdate = useCallback(
        async (updatedFields: TField[]) => {
          if (config.mode === 'props') {
            await config.onUpdate(props, updatedFields);
          } else if (context?.onUpdate) {
            const originalData = context.data;
            const data = cloneDeep(originalData);
            const dataWithFields = data as ContextEntityData;

            if (dataWithFields.messageSchema) {
              dataWithFields.messageSchema = {
                ...dataWithFields.messageSchema,
                schemaFields: updatedFields as Field[],
              };
            } else if (dataWithFields.dataModel) {
              dataWithFields.dataModel = {
                ...dataWithFields.dataModel,
                columns: updatedFields as Column[],
              };
            } else if (dataWithFields.tasks) {
              dataWithFields.tasks = updatedFields as Task[];
            } else if (dataWithFields.mlFeatures) {
              dataWithFields.mlFeatures = updatedFields as MlFeature[];
            } else {
              dataWithFields.columns = updatedFields as Column[];
            }
            await context.onUpdate(data);
          }
        },
        [props, context]
      );

      const handleColumnUpdate = useCallback(
        async (updatedColumn: Column) => {
          const fields = cloneDeep(allFields);
          const fqn = updatedColumn.fullyQualifiedName ?? '';

          // These utility functions work with any field type that has the necessary properties
          (
            updateFieldDescription as (
              fqn: string,
              description: string,
              fields: TField[]
            ) => void
          )(fqn, updatedColumn.description ?? '', fields);
          (
            updateFieldTags as (
              fqn: string,
              tags: TagLabel[],
              fields: TField[]
            ) => void
          )(fqn, updatedColumn.tags ?? [], fields);

          await handleUpdate(fields);

          const refreshedField = (
            findFieldByFQN as (
              fields: TField[],
              fqn: string
            ) => TField | undefined
          )(fields, fqn);
          if (refreshedField) {
            setSelectedColumn(config.column(refreshedField));
          }
        },
        [allFields, handleUpdate]
      );

      const handleColumnNavigate = useCallback((column: Column) => {
        setSelectedColumn(column);
      }, []);

      const updateColumnDescription = useCallback(
        async (fqn: string, description: string) => {
          const fields = cloneDeep(allFields);
          (
            updateFieldDescription as (
              fqn: string,
              description: string,
              fields: TField[]
            ) => void
          )(fqn, description, fields);
          await handleUpdate(fields);
          const updatedField = (
            findFieldByFQN as (
              fields: TField[],
              fqn: string
            ) => TField | undefined
          )(fields, fqn);

          return updatedField as unknown as Column;
        },
        [allFields, handleUpdate]
      );

      const updateColumnTags = useCallback(
        async (fqn: string, tags: TagLabel[]) => {
          const fields = cloneDeep(allFields);
          (
            updateFieldTags as (
              fqn: string,
              tags: TagLabel[],
              fields: TField[]
            ) => void
          )(fqn, tags ?? [], fields);
          await handleUpdate(fields);
          const updatedField = (
            findFieldByFQN as (
              fields: TField[],
              fqn: string
            ) => TField | undefined
          )(fields, fqn);

          return updatedField as unknown as Column;
        },
        [allFields, handleUpdate]
      );

      return (
        <>
          <WrappedComponent
            {...props}
            handleCloseColumnDetail={handleCloseColumnDetail}
            handleColumnClick={handleColumnClick}
            isColumnDetailOpen={isColumnDetailOpen}
          />
          <ColumnDetailPanel
            allColumns={allFields.map((field) => config.column(field))}
            column={selectedColumn}
            entityType={config.entityType}
            hasEditPermission={{
              tags: permissions.hasTagEditAccess && !isReadOnly,
              glossaryTerms:
                permissions.hasGlossaryTermEditAccess && !isReadOnly,
              description: permissions.hasDescriptionEditAccess && !isReadOnly,
              viewAllPermission:
                permissions.hasCustomPropertiesViewAccess || false,
              customProperties:
                (permissions.hasCustomPropertiesEditAccess && !isReadOnly) ||
                false,
            }}
            isOpen={isColumnDetailOpen}
            tableFqn={entityFqn}
            updateColumnDescription={updateColumnDescription}
            updateColumnTags={updateColumnTags}
            onClose={handleCloseColumnDetail}
            onColumnUpdate={handleColumnUpdate}
            onNavigate={handleColumnNavigate}
          />
        </>
      );
    };

    ComponentWithColumnDetailPanel.displayName = `withColumnDetailPanel(${
      WrappedComponent.displayName || WrappedComponent.name || 'Component'
    })`;

    return ComponentWithColumnDetailPanel;
  };
}
