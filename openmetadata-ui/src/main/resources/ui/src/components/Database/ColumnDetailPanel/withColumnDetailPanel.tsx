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

import React, { ComponentType, useCallback, useMemo, useState } from 'react';
import { cloneDeep } from 'lodash';
import { Column } from '../../../generated/entity/data/table';
import { EntityType } from '../../../enums/entity.enum';
import { ColumnDetailPanel } from './ColumnDetailPanel.component';
import { findFieldByFQN, updateFieldDescription, updateFieldTags } from '../../../utils/TableUtils';
import { TagLabel } from '../../../generated/type/tagLabel';

/**
 * Configuration interface for the ColumnDetailPanel HOC.
 * Defines how to convert between entity-specific field types and Column type.
 */
export interface ColumnDetailPanelConfig<TField> {
  /** Entity type for the component */
  entityType: EntityType;
  /** Convert entity field to Column type */
  toColumn: (field: TField) => Column;
  /** Convert Column back to entity field */
  fromColumn: (column: Column, originalField: TField) => TField;
  /** Get all fields from component props */
  getAllFields: (props: any) => TField[];
  /** Get entity FQN from props */
  getEntityFqn: (props: any) => string;
  /** Get permissions from props */
  getPermissions: (props: any) => {
    hasTagEditAccess: boolean;
    hasGlossaryTermEditAccess: boolean;
    hasDescriptionEditAccess: boolean;
  };
  /** Get readOnly state */
  getReadOnly: (props: any) => boolean;
  /** Update handler */
  onUpdate: (props: any, updatedFields: TField[]) => void | Promise<void>;
}

/**
 * Props injected by the HOC into the wrapped component
 */
export interface InjectedColumnDetailPanelProps {
  /** Handler for column click to open detail panel */
  handleColumnClick: (field: any) => void;
  /** Whether the column detail panel is open */
  isColumnDetailOpen: boolean;
  /** Handler to close the column detail panel */
  handleCloseColumnDetail: () => void;
}

/**
 * Higher-Order Component that adds ColumnDetailPanel functionality to table components.
 * 
 * This HOC encapsulates the common pattern of:
 * - Managing state for selected column and panel visibility
 * - Converting between entity-specific field types and Column type
 * - Handling column updates through the detail panel
 * - Rendering the ColumnDetailPanel component
 * 
 * @param config Configuration for field type conversion and prop mapping
 * @returns A function that wraps a component with ColumnDetailPanel functionality
 * 
 * @example
 * ```tsx
 * const config: ColumnDetailPanelConfig<SearchIndexField> = {
 *   entityType: EntityType.SEARCH_INDEX,
 *   toColumn: (field) => field as unknown as Column,
 *   fromColumn: (column, original) => column as unknown as SearchIndexField,
 *   getAllFields: (props) => props.searchIndexFields,
 *   getEntityFqn: (props) => props.entityFqn,
 *   getPermissions: (props) => ({
 *     hasTagEditAccess: props.hasTagEditAccess,
 *     hasGlossaryTermEditAccess: props.hasGlossaryTermEditAccess,
 *     hasDescriptionEditAccess: props.hasDescriptionEditAccess,
 *   }),
 *   getReadOnly: (props) => props.isReadOnly || false,
 *   onUpdate: (props, fields) => props.onUpdate(fields),
 * };
 * 
 * export default withColumnDetailPanel(config)(SearchIndexFieldsTable);
 * ```
 */
export function withColumnDetailPanel<TField, TProps = any>(
  config: ColumnDetailPanelConfig<TField>
) {
  return function (
    WrappedComponent: ComponentType<TProps & InjectedColumnDetailPanelProps>
  ): ComponentType<TProps> {
    const ComponentWithColumnDetailPanel: React.FC<TProps> = (props) => {
      const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
      const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);

      const allFields = useMemo(() => config.getAllFields(props), [props]);
      const entityFqn = useMemo(() => config.getEntityFqn(props), [props]);
      const permissions = useMemo(() => config.getPermissions(props), [props]);
      const isReadOnly = useMemo(() => config.getReadOnly(props), [props]);

      /**
       * Handle click on a column to open the detail panel
       */
      const handleColumnClick = useCallback(
        (field: TField) => {
          const column = config.toColumn(field);
          setSelectedColumn(column);
          setIsColumnDetailOpen(true);
        },
        [config]
      );

      /**
       * Handle closing the column detail panel
       */
      const handleCloseColumnDetail = useCallback(() => {
        setIsColumnDetailOpen(false);
        setSelectedColumn(null);
      }, []);

      /**
       * Handle column update from the detail panel
       */
      const handleColumnUpdate = useCallback(
        (updatedColumn: Column) => {
          const field = updatedColumn as unknown as TField;
          const fields = cloneDeep(allFields);
          const fqn = (updatedColumn as any).fullyQualifiedName ?? '';
          
          updateFieldDescription<TField>(
            fqn,
            (updatedColumn as any).description ?? '',
            fields
          );
          updateFieldTags<TField>(
            fqn,
            (updatedColumn as any).tags ?? [],
            fields
          );
          
          config.onUpdate(props, fields);
          setSelectedColumn(updatedColumn);
        },
        [allFields, props, config]
      );

      /**
       * Handle column navigation
       */
      const handleColumnNavigate = useCallback((column: Column) => {
        setSelectedColumn(column);
      }, []);

      /**
       * Update column description
       */
      const updateColumnDescription = useCallback(
        async (fqn: string, description: string) => {
          const fields = cloneDeep(allFields);
          updateFieldDescription<TField>(fqn, description, fields);
          await config.onUpdate(props, fields);
          const updatedField = findFieldByFQN<TField>(fields, fqn);
          
          return updatedField as unknown as Column;
        },
        [allFields, props, config]
      );

      /**
       * Update column tags
       */
      const updateColumnTags = useCallback(
        async (fqn: string, tags: TagLabel[]) => {
          const fields = cloneDeep(allFields);
          updateFieldTags<TField>(fqn, tags ?? [], fields);
          await config.onUpdate(props, fields);
          const updatedField = findFieldByFQN<TField>(fields, fqn);
          
          return updatedField as unknown as Column;
        },
        [allFields, props, config]
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
            allColumns={allFields.map((field) => field as unknown as Column)}
            column={selectedColumn}
            entityType={config.entityType}
            hasEditPermission={{
              tags: permissions.hasTagEditAccess,
              glossaryTerms: permissions.hasGlossaryTermEditAccess,
              description: permissions.hasDescriptionEditAccess,
              viewAllPermission: false,
              customProperties: false,
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
