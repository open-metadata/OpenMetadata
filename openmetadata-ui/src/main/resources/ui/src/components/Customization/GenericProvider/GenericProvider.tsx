/*
 *  Copyright 2024 Collate.
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
import { AxiosError } from 'axios';
import { isEmpty, omit } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ENTITY_PAGE_TYPE_MAP } from '../../../constants/Customize.constants';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Column, Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';
import { useChangeSummary } from '../../../hooks/useChangeSummary';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { updateTableColumn } from '../../../rest/tableAPI';
import { handleColumnFieldUpdate as handleColumnFieldUpdateUtil } from '../../../utils/ColumnUpdateUtils';
import { EntityDataMapValue } from '../../../utils/ColumnUpdateUtils.interface';
import {
  getLayoutFromCustomizedPage,
  updateWidgetHeightRecursively,
} from '../../../utils/CustomizePage/CustomizePageWidgetUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import {
  extractColumnsFromData,
  findFieldByFQN,
} from '../../../utils/TablePureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import {
  ColumnFieldUpdate,
  ColumnOrTask,
} from '../../Database/ColumnDetailPanel/ColumnDetailPanel.interface';
import { createGenericContext } from './GenericContext';
import { GenericProviderProps } from './GenericProvider.interface';

const ColumnDetailPanel = withSuspenseFallback(
  lazy(() =>
    import('../../Database/ColumnDetailPanel/ColumnDetailPanel.component').then(
      (module) => ({ default: module.ColumnDetailPanel })
    )
  )
);

const getWidgetLayout = (
  ...args: Parameters<typeof getLayoutFromCustomizedPage>
): WidgetConfig[] => {
  const layout = getLayoutFromCustomizedPage(...args);

  return Array.isArray(layout) ? (layout as WidgetConfig[]) : [];
};

export const GenericProvider = <T extends Omit<EntityReference, 'type'>>({
  children,
  data,
  type,
  onUpdate,
  onEntitySync,
  isVersionView,
  permissions,
  currentVersionData,
  isTabExpanded = false,
  customizedPage,
  newTagsUI = false,
  columnFqn,
  activeTab,
}: GenericProviderProps<T>) => {
  const GenericContext = createGenericContext<T>();
  const [threadLink, setThreadLink] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
  const pageType = useMemo(() => ENTITY_PAGE_TYPE_MAP[type], [type]);
  const { tab: routeTab } = useRequiredParams<{ tab: EntityTabs }>();
  // `routeTab` is undefined on an entity's landing URL (no `:tab` segment) and always
  // undefined in the domain tree view, so it cannot be the sole source of truth for the
  // layout -- falling back to the first customized tab renders another tab's widgets.
  const currentTab = activeTab ?? routeTab;
  const expandedLayout = useRef<WidgetConfig[]>([]);
  const [layout, setLayout] = useState<WidgetConfig[]>(
    getWidgetLayout(pageType, currentTab, customizedPage, isVersionView)
  );
  const [filteredKeys, setFilteredKeys] = useState<string[]>([]);
  const [activeTagDropdownKey, setActiveTagDropdownKey] = useState<
    string | null
  >(null);

  const [selectedColumn, setSelectedColumn] = useState<ColumnOrTask | null>(
    null
  );

  // Children (SchemaTable, ModelTab, etc.) register their sorted/filtered/paginated
  // column list here. Kept in a ref so the write does not re-render the provider on
  // load; only mirrored into `panelColumns` state while the column detail panel is open.
  const displayedColumnsRef = useRef<ColumnOrTask[]>([]);
  const selectedColumnRef = useRef<ColumnOrTask | null>(null);
  const [panelColumns, setPanelColumns] = useState<ColumnOrTask[]>([]);

  const setDisplayedColumns = useCallback((cols: ColumnOrTask[]) => {
    displayedColumnsRef.current = cols;
    // Keep the open panel's navigation list live; when closed, skip the re-render.
    if (selectedColumnRef.current) {
      setPanelColumns(cols);
    }
  }, []);

  // Derive isColumnDetailOpen from selectedColumn - if a column is selected, panel is open
  const isColumnDetailOpen = useMemo(
    () => selectedColumn !== null,
    [selectedColumn]
  );

  useEffect(() => {
    selectedColumnRef.current = selectedColumn;
  }, [selectedColumn]);

  const { entityRules } = useEntityRules(type);

  // limit=1000 is the backend max. Entities with more tracked field changes
  // will have entries beyond this limit silently omitted. Use fieldPrefix
  // filtering when targeting a specific section (e.g., 'columns.').
  const { changeSummary } = useChangeSummary(
    isVersionView ? '' : type,
    isVersionView ? '' : data.id ?? '',
    { limit: 1000 }
  );

  // Extract columns from data
  const extractedColumns = useMemo(() => {
    return extractColumnsFromData(data, type) as ColumnOrTask[];
  }, [data, type]);

  // Use the panel's snapshot of displayed columns (sorted) if available, otherwise
  // fall back to the extracted columns.
  const columnsForPanel = useMemo(() => {
    return panelColumns.length > 0 ? panelColumns : extractedColumns;
  }, [panelColumns, extractedColumns]);

  // Helper to clean column by removing empty children array
  const cleanColumn = useCallback((column: ColumnOrTask): ColumnOrTask => {
    const columnWithChildren = column as Column;

    return isEmpty(columnWithChildren.children)
      ? omit(column, 'children')
      : column;
  }, []);

  // Sync selected column from prop (deep link)
  useEffect(() => {
    // If we have a direct columnFqn from props, try to find and select it
    if (columnFqn && extractedColumns.length > 0) {
      const col = findFieldByFQN(extractedColumns as Column[], columnFqn);
      if (col) {
        // Seed the panel navigation list on the deep-link path too — the child's
        // ref write is dropped here because the panel-open gate is still null.
        setPanelColumns(
          displayedColumnsRef.current.length > 0
            ? displayedColumnsRef.current
            : extractedColumns
        );
        setSelectedColumn(cleanColumn(col));
      }
    }
  }, [extractedColumns, columnFqn, cleanColumn]);

  // Sync selected column when extractedColumns change (e.g., after updates)
  useEffect(() => {
    if (!selectedColumn?.fullyQualifiedName || extractedColumns.length === 0) {
      return;
    }

    const updatedColumn = findFieldByFQN<Column>(
      extractedColumns as Column[],
      selectedColumn.fullyQualifiedName
    );

    if (updatedColumn) {
      // Only update fields that extractedColumns might have newer data for (e.g., tags, description)
      // but preserve extension from the original selectedColumn
      setSelectedColumn((prev) => {
        if (!prev) {
          return cleanColumn(updatedColumn);
        }
        const prevColumn = prev as Column;

        return cleanColumn({
          ...updatedColumn,
          // Use new extension if available, otherwise fallback to prev (which might have full data)
          extension: updatedColumn.extension ?? prevColumn.extension,
        });
      });
    }
  }, [extractedColumns, selectedColumn?.fullyQualifiedName, cleanColumn]);

  useEffect(() => {
    setLayout(
      getWidgetLayout(pageType, currentTab, customizedPage, isVersionView)
    );
  }, [customizedPage, currentTab, pageType, isVersionView]);

  const onThreadPanelClose = useCallback(() => {
    setThreadLink('');
  }, [setThreadLink]);

  const onThreadLinkSelect = useCallback((link: string) => {
    setThreadLink(link);
  }, []);

  // Filter the widgets we need to hide widgets which doesn't render anything
  const filterWidgets = useCallback(
    (widgets: string[]) => {
      setFilteredKeys((prev) => [...prev, ...widgets]);
    },
    [setFilteredKeys]
  );

  const updateActiveTagDropdownKey = useCallback((key: string | null) => {
    setActiveTagDropdownKey(key);
  }, []);

  const updateWidgetHeight = useCallback((widgetId: string, height: number) => {
    setLayout((prev) => updateWidgetHeightRecursively(widgetId, height, prev));
  }, []);

  const openColumnDetailPanel = useCallback(
    (column: ColumnOrTask) => {
      const columnFqn = column.fullyQualifiedName;

      // If the column is already selected, don't do anything to avoid loops
      if (selectedColumn?.fullyQualifiedName === columnFqn) {
        return;
      }

      // Snapshot the child's current displayed list for panel prev/next navigation.
      setPanelColumns(
        displayedColumnsRef.current.length > 0
          ? displayedColumnsRef.current
          : extractedColumns
      );

      // Set selected column immediately to avoid flicker
      setSelectedColumn(column);

      // Update URL to include column FQN if the column has a fullyQualifiedName
      if (columnFqn && data.fullyQualifiedName) {
        const newPath = getEntityDetailsPath(type, columnFqn, routeTab);

        // Only navigate if the path is different from current path to avoid loops
        if (location.pathname !== newPath) {
          navigate(newPath, { replace: true });
        }
      }
    },
    [
      data?.fullyQualifiedName,
      type,
      routeTab,
      navigate,
      location.pathname,
      selectedColumn?.fullyQualifiedName,
      extractedColumns,
    ]
  );

  const closeColumnDetailPanel = useCallback(() => {
    setSelectedColumn(null);
    setPanelColumns([]);

    // Update URL to remove column FQN
    if (data?.fullyQualifiedName) {
      const newPath = getEntityDetailsPath(
        type,
        data.fullyQualifiedName,
        routeTab
      );
      navigate(newPath, { replace: true });
    } else if (location.hash) {
      // Fallback: just remove hash if no FQN available
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true }
      );
    }
  }, [data?.fullyQualifiedName, type, routeTab, location, navigate]);

  // Wrapper for onColumnFieldUpdate that updates
  const handleColumnFieldUpdate = useCallback(
    async (
      fqn: string,
      update: ColumnFieldUpdate,
      skipGlobalError?: boolean
    ) => {
      let apiResponseColumn: Column | undefined;

      // For Table entities, use the specific column update endpoint instead of generic patch
      // This ensures custom properties and other column fields are updated correctly
      if (type === EntityType.TABLE) {
        try {
          apiResponseColumn = await updateTableColumn(fqn, update);
        } catch (error) {
          // If called from ColumnDetailPanel, re-throw error so it can show local toast
          if (skipGlobalError) {
            throw error;
          }
          showErrorToast(error as AxiosError);

          return;
        }
      }

      const { updatedEntity, updatedColumn } = handleColumnFieldUpdateUtil({
        entityType: type,
        entityData: data as unknown as EntityDataMapValue,
        fqn,
        update,
      });

      if (onEntitySync) {
        onEntitySync(updatedEntity as unknown as T);
      } else {
        await onUpdate(updatedEntity as unknown as T);
      }

      // Use API response column if available (more accurate), otherwise use local calculation
      const finalColumn = apiResponseColumn ?? updatedColumn;

      // Update selected column if it matches the updated one
      if (finalColumn && selectedColumn?.fullyQualifiedName === fqn) {
        setSelectedColumn(cleanColumn(finalColumn as ColumnOrTask));
      }

      return finalColumn as ColumnOrTask | undefined;
    },
    [data, type, onUpdate, onEntitySync, selectedColumn, cleanColumn]
  );

  // Extract deleted status from entity data
  const deleted = (data as { deleted?: boolean })?.deleted;

  // Extract tableConstraints for Table entities
  const tableConstraints = useMemo(() => {
    if (type === EntityType.TABLE && 'tableConstraints' in data) {
      const tableData = data as Partial<Table>;

      return tableData.tableConstraints;
    }

    return undefined;
  }, [type, data]);

  // store the left side panel widget
  const leftPanelWidget = useMemo(() => {
    return layout?.find((widget) =>
      widget.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
    );
  }, [layout]);

  // Handle the left side panel expand collapse
  useEffect(() => {
    setLayout((prev) => {
      // If layout is empty or no left panel widget, return as is
      if (!prev?.length || !leftPanelWidget) {
        return prev;
      }

      // Check if we need to update the layout
      const currentLeftPanel = prev.find((widget) =>
        widget.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
      );

      const targetWidth = isTabExpanded ? 8 : 6;

      // If the width is already what we want, don't update
      if (currentLeftPanel?.w === targetWidth) {
        return prev;
      }

      if (isTabExpanded) {
        // Store the current layout before modifying
        expandedLayout.current = [...prev];
      }

      // Get the source layout to modify
      const sourceLayout = isTabExpanded
        ? prev
        : expandedLayout.current || prev;

      if (isTabExpanded) {
        // When expanded, only return the left panel widget with updated width
        return leftPanelWidget ? [{ ...leftPanelWidget, w: targetWidth }] : [];
      }

      // When not expanded, return all widgets with original width
      return sourceLayout.map((widget) => ({
        ...widget,
        w: widget.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
          ? targetWidth
          : widget.w,
      }));
    });
  }, [isTabExpanded, leftPanelWidget]);

  const filteredLayout = useMemo(() => {
    return layout?.filter((widget) => !filteredKeys.includes(widget.i));
  }, [layout, filteredKeys]);

  useEffect(() => {
    // on unmount remove filterKeys
    return () => setFilteredKeys([]);
  }, [currentTab]);

  const values = useMemo(
    () => ({
      data,
      entityRules,
      type,
      onUpdate,
      isVersionView,
      permissions,
      currentVersionData,
      onThreadLinkSelect,
      layout: filteredLayout,
      filterWidgets,
      updateWidgetHeight,
      activeTagDropdownKey,
      updateActiveTagDropdownKey,
      newTagsUI,
      selectedColumn,
      isColumnDetailOpen,
      openColumnDetailPanel,
      closeColumnDetailPanel,
      setDisplayedColumns,
      changeSummary,
    }),
    [
      data,
      entityRules,
      type,
      onUpdate,
      isVersionView,
      permissions,
      currentVersionData,
      onThreadLinkSelect,
      filteredLayout,
      filterWidgets,
      updateWidgetHeight,
      activeTagDropdownKey,
      updateActiveTagDropdownKey,
      newTagsUI,
      selectedColumn,
      isColumnDetailOpen,
      openColumnDetailPanel,
      closeColumnDetailPanel,
      setDisplayedColumns,
      changeSummary,
    ]
  );

  return (
    <GenericContext.Provider value={values}>
      {children}
      {threadLink ? (
        <ActivityThreadPanel
          open={Boolean(threadLink)}
          threadLink={threadLink}
          onCancel={onThreadPanelClose}
        />
      ) : null}
      {columnsForPanel.length > 0 && (
        <ColumnDetailPanel
          allColumns={columnsForPanel as Column[]}
          column={selectedColumn as Column}
          deleted={deleted}
          entityType={type}
          isOpen={isColumnDetailOpen}
          tableConstraints={tableConstraints}
          tableFqn={data.fullyQualifiedName}
          onClose={closeColumnDetailPanel}
          onColumnFieldUpdate={handleColumnFieldUpdate}
          onNavigate={openColumnDetailPanel}
        />
      )}
    </GenericContext.Provider>
  );
};
