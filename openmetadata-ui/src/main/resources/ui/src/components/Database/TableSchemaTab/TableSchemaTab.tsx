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
import { isEmpty, isEqual, noop } from 'lodash';
import { EntityTags } from 'Models';
import React, { useMemo, useState } from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { CreateThread } from '../../../generated/api/feed/createThread';
import {
  Table,
  TagLabel,
  TagSource,
} from '../../../generated/entity/data/table';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { Page, PageType, Tab } from '../../../generated/system/ui/page';
import { useFqn } from '../../../hooks/useFqn';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import { FrequentlyJoinedTables } from '../../../pages/TableDetailsPageV1/FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import { PartitionedKeys } from '../../../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component';
import TableConstraints from '../../../pages/TableDetailsPageV1/TableConstraints/TableConstraints';
import { postThread } from '../../../rest/feedsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getWidgetFromKey } from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import tableClassBase from '../../../utils/TableClassBase';
import {
  getJoinsFromTableJoins,
  getTagsWithoutTier,
  getTierTags,
} from '../../../utils/TableUtils';
import { createTagObject } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import { useGenericContext } from '../../GenericProvider/GenericProvider';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import SchemaTab from '../SchemaTab/SchemaTab.component';

const ReactGridLayout = WidthProvider(RGL);

export const TableSchemaTab = () => {
  const { currentPersonaDocStore } = useCustomizeStore();
  const { tab = EntityTabs.SCHEMA } = useParams<{ tab: EntityTabs }>();
  const { fqn: tableFqn } = useFqn();
  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();

  const onThreadPanelClose = () => {
    setThreadLink('');
  };
  const {
    data: tableDetails,
    permissions: tablePermissions,
    onUpdate,
    type: entityType,
  } = useGenericContext<Table>();

  const layout = useMemo(() => {
    if (!currentPersonaDocStore) {
      return tableClassBase.getDefaultLayout(tab);
    }

    const page = currentPersonaDocStore?.data?.pages?.find(
      (p: Page) => p.pageType === PageType.Table
    );

    if (page) {
      return page.tabs.find((t: Tab) => t.id === tab)?.layout;
    } else {
      return tableClassBase.getDefaultLayout(tab);
    }
  }, [currentPersonaDocStore, tab]);
  const {
    tier,
    tableTags,
    deleted,
    columns,
    owners,
    domain,
    extension,
    tablePartition,
    dataProducts,
    description,
    entityName,
    joinedTables = [],
  } = useMemo(() => {
    const { tags } = tableDetails;

    const { joins } = tableDetails ?? {};

    return {
      ...tableDetails,
      tier: getTierTags(tags ?? []),
      tableTags: getTagsWithoutTier(tags ?? []),
      entityName: getEntityName(tableDetails),
      joinedTables: getJoinsFromTableJoins(joins),
    };
  }, [tableDetails, tableDetails?.tags]);

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editAllPermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (tablePermissions.EditTags || tablePermissions.EditAll) && !deleted,
      editDescriptionPermission:
        (tablePermissions.EditDescription || tablePermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (tablePermissions.EditGlossaryTerms || tablePermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (tablePermissions.EditAll || tablePermissions.EditCustomFields) &&
        !deleted,
      editAllPermission: tablePermissions.EditAll && !deleted,
      editLineagePermission:
        (tablePermissions.EditAll || tablePermissions.EditLineage) && !deleted,
      viewSampleDataPermission:
        tablePermissions.ViewAll || tablePermissions.ViewSampleData,
      viewQueriesPermission:
        tablePermissions.ViewAll || tablePermissions.ViewQueries,
      viewProfilerPermission:
        tablePermissions.ViewAll ||
        tablePermissions.ViewDataProfile ||
        tablePermissions.ViewTests,
      viewAllPermission: tablePermissions.ViewAll,
      viewBasicPermission:
        tablePermissions.ViewAll || tablePermissions.ViewBasic,
    }),
    [tablePermissions, deleted]
  );

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

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

  const descriptionWidget = useMemo(() => {
    return (
      <DescriptionV1
        showSuggestions
        description={description}
        entityFqn={tableFqn}
        entityName={entityName}
        entityType={EntityType.TABLE}
        hasEditAccess={editDescriptionPermission}
        isDescriptionExpanded={isEmpty(columns)}
        owner={owners}
        showActions={!deleted}
        onDescriptionUpdate={async (value) => {
          if (value !== description) {
            await onUpdate({ ...tableDetails, description: value });
          }
        }}
        onThreadLinkSelect={onThreadLinkSelect}
      />
    );
  }, [tablePermissions, tableDetails, deleted, entityName, deleted, owners]);

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const handleTagsUpdate = async (selectedTags?: Array<TagLabel>) => {
    if (selectedTags && tableDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...tableDetails, tags: updatedTags };
      await onUpdate(updatedTable);
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);
    await handleTagsUpdate(updatedTags);
  };

  const tagsWidget = useMemo(() => {
    return (
      <TagsContainerV2
        showTaskHandler
        displayType={DisplayType.READ_MORE}
        entityFqn={tableFqn}
        entityType={entityType}
        permission={editTagsPermission}
        selectedTags={tableTags}
        tagType={TagSource.Classification}
        onSelectionChange={handleTagSelection}
        onThreadLinkSelect={onThreadLinkSelect}
      />
    );
  }, []);

  const glossaryWidget = useMemo(() => {
    return (
      <TagsContainerV2
        showTaskHandler
        displayType={DisplayType.READ_MORE}
        entityFqn={tableFqn}
        entityType={entityType}
        permission={editTagsPermission}
        selectedTags={tableTags}
        tagType={TagSource.Glossary}
        onSelectionChange={handleTagSelection}
        onThreadLinkSelect={onThreadLinkSelect}
      />
    );
  }, []);

  const onColumnsUpdate = async (updateColumns: Table['columns']) => {
    if (tableDetails && !isEqual(columns, updateColumns)) {
      const updatedTableDetails = {
        ...tableDetails,
        columns: updateColumns,
      };
      await onUpdate(updatedTableDetails);
    }
  };

  const widgets = useMemo(() => {
    const getWidgetFromKeyInternal = (
      widgetConfig: WidgetConfig
    ): JSX.Element | null => {
      if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DESCRIPTION)) {
        return descriptionWidget;
      } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.TABLE_SCHEMA)) {
        return (
          <SchemaTab
            hasDescriptionEditAccess={editDescriptionPermission}
            hasGlossaryTermEditAccess={editGlossaryTermsPermission}
            hasTagEditAccess={editTagsPermission}
            isReadOnly={deleted}
            onThreadLinkSelect={onThreadLinkSelect}
            onUpdate={onColumnsUpdate}
          />
        );
      } else if (
        widgetConfig.i.startsWith(DetailPageWidgetKeys.TABLE_CONSTRAINTS)
      ) {
        return (
          <TableConstraints
            hasPermission={editAllPermission && !deleted}
            tableDetails={tableDetails}
            onUpdate={async (constraint) =>
              await onUpdate({ ...tableDetails, tableConstraints: constraint })
            }
          />
        );
      } else if (
        widgetConfig.i.startsWith(DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES)
      ) {
        return isEmpty(joinedTables) ? null : (
          <FrequentlyJoinedTables joinedTables={joinedTables} />
        );
      } else if (
        widgetConfig.i.startsWith(DetailPageWidgetKeys.DATA_PRODUCTS)
      ) {
        return (
          <DataProductsContainer
            activeDomain={domain}
            dataProducts={dataProducts ?? []}
            hasPermission={false}
          />
        );
      } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.TAGS)) {
        return tagsWidget;
      } else if (
        widgetConfig.i.startsWith(DetailPageWidgetKeys.GLOSSARY_TERMS)
      ) {
        return glossaryWidget;
      } else if (
        //     widgetConfig.i.startsWith(DetailPageWidgetKeys.KNOWLEDGE_ARTICLES)
        //   ) {
        //     return (
        //       <KnowledgeArticles entityId={entityId} entityType={entityType} />
        //     );
        //   } else if (
        widgetConfig.i.startsWith(DetailPageWidgetKeys.CUSTOM_PROPERTIES)
      ) {
        return (
          <CustomPropertyTable<EntityType.TABLE>
            isRenderedInRightPanel
            entityDetails={extension}
            entityType={EntityType.TABLE}
            handleExtensionUpdate={onUpdate}
            hasEditAccess={Boolean(editCustomAttributePermission)}
            hasPermission={Boolean(viewAllPermission)}
            maxDataCap={5}
          />
        );
      } else if (
        widgetConfig.i.startsWith(DetailPageWidgetKeys.PARTITIONED_KEYS)
      ) {
        return tablePartition ? (
          <PartitionedKeys tablePartition={tablePartition} />
        ) : null;
      }

      return getWidgetFromKey({
        widgetConfig: widgetConfig,
        handleOpenAddWidgetModal: noop,
        handlePlaceholderWidgetKey: noop,
        handleRemoveWidget: noop,
        isEditView: false,
      });
    };

    return layout.map((widget: WidgetConfig) => (
      <div
        data-grid={widget}
        id={widget.i}
        key={widget.i}
        style={{ overflow: 'scroll' }}>
        {getWidgetFromKeyInternal(widget)}
      </div>
    ));
  }, [layout, descriptionWidget, tagsWidget, glossaryWidget]);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <>
      <ReactGridLayout
        className="grid-container"
        cols={8}
        isDraggable={false}
        isResizable={false}
        margin={[16, 16]}
        rowHeight={100}>
        {widgets}
      </ReactGridLayout>
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
    </>
  );
};
