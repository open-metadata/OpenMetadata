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
import { isEmpty, omit, once } from 'lodash';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_PAGE_TYPE_MAP } from '../../../constants/Customize.constants';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { CreateThread } from '../../../generated/api/feed/createThread';
import { Column, Table } from '../../../generated/entity/data/table';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { EntityReference } from '../../../generated/entity/type';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { postThread } from '../../../rest/feedsAPI';
import { handleColumnFieldUpdate as handleColumnFieldUpdateUtil } from '../../../utils/ColumnUpdateUtils';
import {
  getLayoutFromCustomizedPage,
  updateWidgetHeightRecursively,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import {
  extractColumnsFromData,
  findFieldByFQN,
} from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { ColumnDetailPanel } from '../../Database/ColumnDetailPanel/ColumnDetailPanel.component';
import {
  ColumnFieldUpdate,
  ColumnOrTask,
} from '../../Database/ColumnDetailPanel/ColumnDetailPanel.interface';
import {
  GenericContextType,
  GenericProviderProps,
} from './GenericProvider.interface';

const createGenericContext = once(<T extends Omit<EntityReference, 'type'>>() =>
  createContext({} as GenericContextType<T>)
);

export const GenericProvider = <T extends Omit<EntityReference, 'type'>>({
  children,
  data,
  type,
  onUpdate,
  isVersionView,
  permissions,
  currentVersionData,
  isTabExpanded = false,
  customizedPage,
  muiTags = false,
}: GenericProviderProps<T>) => {
  const GenericContext = createGenericContext<T>();
  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const pageType = useMemo(() => ENTITY_PAGE_TYPE_MAP[type], [type]);
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const expandedLayout = useRef<WidgetConfig[]>([]);
  const [layout, setLayout] = useState<WidgetConfig[]>(
    getLayoutFromCustomizedPage(pageType, tab, customizedPage, isVersionView)
  );
  const [filteredKeys, setFilteredKeys] = useState<string[]>([]);
  const [activeTagDropdownKey, setActiveTagDropdownKey] = useState<
    string | null
  >(null);

  const [selectedColumn, setSelectedColumn] = useState<ColumnOrTask | null>(
    null
  );

  // Derive isColumnDetailOpen from selectedColumn - if a column is selected, panel is open
  const isColumnDetailOpen = useMemo(
    () => selectedColumn !== null,
    [selectedColumn]
  );

  const { entityRules } = useEntityRules(type);

  // Extract columns from data
  const extractedColumns = useMemo(() => {
    return extractColumnsFromData(data, type) as ColumnOrTask[];
  }, [data, type]);

  // Helper to clean column by removing empty children array
  const cleanColumn = useCallback((column: ColumnOrTask): ColumnOrTask => {
    const columnWithChildren = column as Column;

    return isEmpty(columnWithChildren.children)
      ? omit(column, 'children')
      : column;
  }, []);

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
      setSelectedColumn(cleanColumn(updatedColumn));
    }
  }, [extractedColumns, selectedColumn?.fullyQualifiedName, cleanColumn]);

  useEffect(() => {
    setLayout(
      getLayoutFromCustomizedPage(pageType, tab, customizedPage, isVersionView)
    );
  }, [customizedPage, tab, pageType, isVersionView]);

  const onThreadPanelClose = useCallback(() => {
    setThreadLink('');
  }, [setThreadLink]);

  const onThreadLinkSelect = useCallback(
    (link: string, threadType?: ThreadType) => {
      setThreadLink(link);
      if (threadType) {
        setThreadType(threadType);
      }
    },
    [setThreadLink, setThreadType]
  );

  // Create a thread
  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

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

  const openColumnDetailPanel = useCallback((column: ColumnOrTask) => {
    setSelectedColumn(column);
  }, []);

  const closeColumnDetailPanel = useCallback(() => {
    setSelectedColumn(null);
  }, []);

  // Wrapper for onColumnFieldUpdate that updates selectedColumn after the update completes
  const handleColumnFieldUpdate = useCallback(
    async (fqn: string, update: ColumnFieldUpdate) => {
      const { updatedEntity, updatedColumn } = handleColumnFieldUpdateUtil({
        entityType: type,
        entityData: data,
        fqn,
        update,
      });

      // Call onUpdate with the updated entity (onUpdate will handle API calls)
      await onUpdate(updatedEntity);

      // Update selected column if it matches the updated one
      if (updatedColumn && selectedColumn?.fullyQualifiedName === fqn) {
        setSelectedColumn(cleanColumn(updatedColumn as ColumnOrTask));
      }

      return updatedColumn as ColumnOrTask | undefined;
    },
    [data, type, onUpdate, selectedColumn, cleanColumn]
  );

  const handleColumnNavigate = useCallback((column: ColumnOrTask) => {
    setSelectedColumn(column);
  }, []);

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
  }, [tab]);

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
      muiTags,
      selectedColumn,
      isColumnDetailOpen,
      openColumnDetailPanel,
      closeColumnDetailPanel,
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
      muiTags,
      selectedColumn,
      isColumnDetailOpen,
      openColumnDetailPanel,
      closeColumnDetailPanel,
    ]
  );

  return (
    <GenericContext.Provider value={values}>
      {children}
      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
          deletePostHandler={deleteFeed}
          open={Boolean(threadLink)}
          postFeedHandler={postFeed}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateFeed}
          onCancel={onThreadPanelClose}
        />
      ) : null}
      {extractedColumns.length > 0 && (
        <ColumnDetailPanel
          allColumns={extractedColumns as Column[]}
          column={selectedColumn as Column}
          deleted={deleted}
          entityType={type}
          isOpen={isColumnDetailOpen}
          tableConstraints={tableConstraints}
          tableFqn={data.fullyQualifiedName}
          onClose={closeColumnDetailPanel}
          onColumnFieldUpdate={handleColumnFieldUpdate}
          onNavigate={handleColumnNavigate}
        />
      )}
    </GenericContext.Provider>
  );
};

export const useGenericContext = <T extends Omit<EntityReference, 'type'>>() =>
  useContext(createGenericContext<T>());
