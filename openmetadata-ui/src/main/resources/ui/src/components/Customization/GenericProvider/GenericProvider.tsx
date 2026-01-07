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
import {
  getLayoutFromCustomizedPage,
  updateWidgetHeightRecursively,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { updateColumnInNestedStructure } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { ColumnDetailPanel } from '../../Database/ColumnDetailPanel/ColumnDetailPanel.component';
import { ColumnOrTask } from '../../Database/ColumnDetailPanel/ColumnDetailPanel.interface';
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
  columnDetailPanelConfig,
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
  const [isColumnDetailOpen, setIsColumnDetailOpen] = useState(false);

  const { entityRules } = useEntityRules(type);

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
    setIsColumnDetailOpen(true);
  }, []);

  const closeColumnDetailPanel = useCallback(() => {
    setIsColumnDetailOpen(false);
    setSelectedColumn(null);
  }, []);

  const handleColumnUpdate = useCallback(
    (updatedColumn: ColumnOrTask) => {
      const cleanColumn = isEmpty((updatedColumn as Column).children)
        ? omit(updatedColumn, 'children')
        : updatedColumn;

      if (columnDetailPanelConfig?.onColumnsChange) {
        const updatedColumns = updateColumnInNestedStructure(
          columnDetailPanelConfig.columns as Column[],
          updatedColumn.fullyQualifiedName ?? '',
          cleanColumn as Partial<Column>
        );
        columnDetailPanelConfig.onColumnsChange(updatedColumns);
      }

      setSelectedColumn(cleanColumn as ColumnOrTask);
    },
    [columnDetailPanelConfig]
  );

  const handleColumnNavigate = useCallback((column: ColumnOrTask) => {
    setSelectedColumn(column);
  }, []);

  const deleted = useMemo(
    () => (data as { deleted?: boolean }).deleted,
    [data]
  );

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
      {columnDetailPanelConfig && (
        <ColumnDetailPanel
          allColumns={columnDetailPanelConfig.columns}
          column={selectedColumn as Column}
          deleted={deleted}
          entityType={type}
          isOpen={isColumnDetailOpen}
          permissions={permissions}
          tableConstraints={
            type === EntityType.TABLE
              ? (data as unknown as Table).tableConstraints
              : undefined
          }
          tableFqn={data.fullyQualifiedName}
          onClose={closeColumnDetailPanel}
          onColumnFieldUpdate={columnDetailPanelConfig.onColumnFieldUpdate}
          onColumnUpdate={handleColumnUpdate}
          onNavigate={handleColumnNavigate}
        />
      )}
    </GenericContext.Provider>
  );
};

export const useGenericContext = <T extends Omit<EntityReference, 'type'>>() =>
  useContext(createGenericContext<T>());
