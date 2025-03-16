/*
 *  Copyright 2022 Collate.
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

import { Col, Row, Tabs } from 'antd';
import classNames from 'classnames';
import { isEmpty, noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getGlossaryTermDetailsPath } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { GlossaryTermDetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { ChangeDescription } from '../../../generated/entity/type';
import { Page, PageType, Tab } from '../../../generated/system/ui/page';
import { TagLabel } from '../../../generated/tests/testCase';
import { TagSource } from '../../../generated/type/tagLabel';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { FeedCounts } from '../../../interface/feed.interface';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import { getFeedCounts } from '../../../utils/CommonUtils';
import customizeGlossaryPageClassBase from '../../../utils/CustomizeGlossaryPage/CustomizeGlossaryPage';
import {
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtils';
import { getWidgetFromKey } from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import Loader from '../../common/Loader/Loader';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DomainLabelV2 } from '../../DataAssets/DomainLabelV2/DomainLabelV2';
import { OwnerLabelV2 } from '../../DataAssets/OwnerLabelV2/OwnerLabelV2';
import { ReviewerLabelV2 } from '../../DataAssets/ReviewerLabelV2/ReviewerLabelV2';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from '../GlossaryTermTab/GlossaryTermTab.component';
import { useGlossaryStore } from '../useGlossary.store';
import './glossary-details.less';
import { GlossaryDetailsProps } from './GlossaryDetails.interface';

const ReactGridLayout = WidthProvider(RGL);

const GlossaryDetails = ({
  permissions,
  updateGlossary,
  updateVote,
  handleGlossaryDelete,
  termsLoading,
  refreshGlossaryTerms,
  onAddGlossaryTerm,
  onEditGlossaryTerm,
  isVersionView,
}: GlossaryDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { activeGlossary: glossary } = useGlossaryStore();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { currentPersonaDocStore } = useCustomizeStore();
  // Since we are rendering this component for all customized tabs we need tab ID to get layout form store
  const { tab: activeTab = EntityTabs.TERMS } =
    useParams<{ tab: EntityTabs }>();
  const { customizedPage, isLoading } = useCustomPages(PageType.Glossary);

  useGridLayoutDirection();

  const layout = useMemo(() => {
    if (!currentPersonaDocStore) {
      return customizeGlossaryPageClassBase.getDefaultWidgetForTab(activeTab);
    }

    const page = currentPersonaDocStore?.data?.pages?.find(
      (p: Page) => p.pageType === PageType.Glossary
    );

    if (page) {
      return page.tabs.find((t: Tab) => t.id === activeTab)?.layout;
    } else {
      return customizeGlossaryPageClassBase.getDefaultWidgetForTab(activeTab);
    }
  }, [currentPersonaDocStore, activeTab]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.GLOSSARY,
      glossary.fullyQualifiedName ?? '',
      handleFeedCount
    );
  };

  const handleGlossaryUpdate = async (updatedGlossary: Glossary) => {
    await updateGlossary(updatedGlossary);
    getEntityFeedCount();
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (glossary.description !== updatedHTML) {
      const updatedGlossaryDetails = {
        ...glossary,
        description: updatedHTML,
      };
      await handleGlossaryUpdate(updatedGlossaryDetails);
    }
  };

  const updatedGlossary = useMemo(() => {
    const updatedDescription = isVersionView
      ? getEntityVersionByField(
          glossary.changeDescription as ChangeDescription,
          EntityField.DESCRIPTION,
          glossary.description
        )
      : glossary.description;

    const updatedName = isVersionView
      ? getEntityVersionByField(
          glossary.changeDescription as ChangeDescription,
          EntityField.NAME,
          glossary.name
        )
      : glossary.name;
    const updatedDisplayName = isVersionView
      ? getEntityVersionByField(
          glossary.changeDescription as ChangeDescription,
          EntityField.DISPLAYNAME,
          glossary.displayName
        )
      : glossary.displayName;

    return {
      ...glossary,
      description: updatedDescription,
      name: updatedName,
      displayName: updatedDisplayName,
    };
  }, [glossary, isVersionView]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getGlossaryTermDetailsPath(glossary.fullyQualifiedName ?? '', activeKey)
      );
    }
  };

  const tags = useMemo(
    () =>
      isVersionView
        ? getEntityVersionTags(
            glossary,
            glossary.changeDescription as ChangeDescription
          )
        : glossary.tags,
    [isVersionView, glossary]
  );

  const tagsWidget = useMemo(() => {
    return (
      <TagsContainerV2
        displayType={DisplayType.READ_MORE}
        entityFqn={glossary.fullyQualifiedName}
        entityType={EntityType.GLOSSARY}
        permission={permissions.EditAll || permissions.EditTags}
        selectedTags={tags ?? []}
        tagType={TagSource.Classification}
        onSelectionChange={async (updatedTags: TagLabel[]) =>
          await handleGlossaryUpdate({ ...glossary, tags: updatedTags })
        }
      />
    );
  }, [tags, glossary, handleGlossaryUpdate, permissions]);

  const widgets = useMemo(() => {
    const getWidgetFromKeyInternal = (widget: WidgetConfig) => {
      if (widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.DESCRIPTION)) {
        return (
          <DescriptionV1
            description={updatedGlossary.description}
            entityName={getEntityName(glossary)}
            entityType={EntityType.GLOSSARY}
            hasEditAccess={permissions.EditDescription || permissions.EditAll}
            isDescriptionExpanded={isEmpty(glossary.children)}
            owner={glossary?.owners}
            showActions={!glossary.deleted}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        );
      } else if (
        widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.TERMS_TABLE)
      ) {
        return (
          <GlossaryTermTab
            isGlossary
            permissions={permissions}
            refreshGlossaryTerms={refreshGlossaryTerms}
            termsLoading={termsLoading}
            onAddGlossaryTerm={onAddGlossaryTerm}
            onEditGlossaryTerm={onEditGlossaryTerm}
          />
        );
      } else if (widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.OWNER)) {
        return <OwnerLabelV2 />;
      } else if (widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.DOMAIN)) {
        return <DomainLabelV2 showDomainHeading />;
      } else if (
        widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.REVIEWER)
      ) {
        return <ReviewerLabelV2 />;
      } else if (widget.i.startsWith(GlossaryTermDetailPageWidgetKeys.TAGS)) {
        return tagsWidget;
      }

      return getWidgetFromKey({
        widgetConfig: widget,
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
  }, [tagsWidget, layout, permissions, termsLoading]);

  const detailsContent = useMemo(() => {
    return (
      <ReactGridLayout
        className="grid-container"
        cols={8}
        isDraggable={false}
        isResizable={false}
        margin={[
          customizeGlossaryPageClassBase.detailWidgetMargin,
          customizeGlossaryPageClassBase.detailWidgetMargin,
        ]}
        rowHeight={customizeGlossaryPageClassBase.rowHeight}>
        {widgets}
      </ReactGridLayout>
    );
  }, [permissions, glossary, termsLoading, widgets]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const items = [
      {
        label: (
          <TabsLabel
            id={EntityTabs.TERMS}
            isActive={activeTab === EntityTabs.TERMS}
            name={tabLabelMap[EntityTabs.TERMS] ?? t('label.term-plural')}
          />
        ),
        key: EntityTabs.TERMS,
        children: detailsContent,
      },
      ...(!isVersionView
        ? [
            {
              label: (
                <TabsLabel
                  count={feedCount.totalCount}
                  id={EntityTabs.ACTIVITY_FEED}
                  isActive={activeTab === EntityTabs.ACTIVITY_FEED}
                  name={
                    tabLabelMap[EntityTabs.ACTIVITY_FEED] ??
                    t('label.activity-feed-and-task-plural')
                  }
                />
              ),
              key: EntityTabs.ACTIVITY_FEED,
              children: (
                <ActivityFeedTab
                  refetchFeed
                  entityFeedTotalCount={feedCount.totalCount}
                  entityType={EntityType.GLOSSARY}
                  hasGlossaryReviewer={!isEmpty(glossary.reviewers)}
                  layoutType={ActivityFeedLayoutType.THREE_PANEL}
                  owners={glossary.owners}
                  onFeedUpdate={getEntityFeedCount}
                  onUpdateEntityDetails={noop}
                />
              ),
            },
          ]
        : []),
    ];

    return getDetailsTabWithNewLabel(
      items,
      customizedPage?.tabs,
      EntityTabs.TERMS
    );
  }, [
    detailsContent,
    customizedPage?.tabs,
    glossary.fullyQualifiedName,
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    activeTab,
    isVersionView,
  ]);

  useEffect(() => {
    getEntityFeedCount();
  }, [glossary.fullyQualifiedName]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <GenericProvider<Glossary>
      data={updatedGlossary}
      isVersionView={isVersionView}
      permissions={permissions}
      type={EntityType.GLOSSARY}
      onUpdate={handleGlossaryUpdate}>
      <Row
        className="glossary-details p-t-sm"
        data-testid="glossary-details"
        gutter={[0, 16]}>
        <Col
          className={classNames('p-x-md', {
            'p-l-xl': !isVersionView,
          })}
          span={24}>
          <GlossaryHeader
            updateVote={updateVote}
            onAddGlossaryTerm={onAddGlossaryTerm}
            onDelete={handleGlossaryDelete}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeTab}
            className="glossary-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={handleTabChange}
          />
        </Col>
      </Row>
    </GenericProvider>
  );
};

export default GlossaryDetails;
