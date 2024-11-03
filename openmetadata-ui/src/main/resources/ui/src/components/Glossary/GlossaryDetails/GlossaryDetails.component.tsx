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

import { Col, Row, Space, Tabs } from 'antd';
import classNames from 'classnames';
import { isEmpty, noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { getGlossaryTermDetailsPath } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../../constants/ResizablePanel.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { ChangeDescription } from '../../../generated/entity/type';
import { Page, PageType } from '../../../generated/system/ui/page';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { FeedCounts } from '../../../interface/feed.interface';
import { getDocumentByFQN } from '../../../rest/DocStoreAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import {
  getGlossaryTermDetailTabs,
  getTabLabelMap,
} from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../GenericProvider/GenericProvider';
import GlossaryDetailsRightPanel from '../GlossaryDetailsRightPanel/GlossaryDetailsRightPanel.component';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from '../GlossaryTermTab/GlossaryTermTab.component';
import { useGlossaryStore } from '../useGlossary.store';
import './glossary-details.less';
import { GlossaryDetailsProps } from './GlossaryDetails.interface';

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
  onThreadLinkSelect,
}: GlossaryDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { activeGlossary: glossary } = useGlossaryStore();
  const { tab: activeTab } = useParams<{ tab: string }>();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { selectedPersona } = useApplicationStore();
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [customizedPage, setCustomizedPage] = useState<Page | null>(null);

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
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
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

  const detailsContent = useMemo(() => {
    return (
      <Row className="h-full" gutter={[32, 0]}>
        <Col className="glossary-height-with-resizable-panel" span={24}>
          <ResizablePanels
            firstPanel={{
              className: 'glossary-resizable-panel-container',
              children: (
                <div className="p-y-md p-x-md glossary-content-container">
                  <Space className="w-full" direction="vertical" size={24}>
                    <DescriptionV1
                      description={updatedGlossary.description}
                      entityFqn={glossary.fullyQualifiedName}
                      entityName={getEntityName(glossary)}
                      entityType={EntityType.GLOSSARY}
                      hasEditAccess={
                        permissions.EditDescription || permissions.EditAll
                      }
                      isDescriptionExpanded={isEmpty(glossary.children)}
                      isEdit={isDescriptionEditable}
                      owner={glossary?.owners}
                      showActions={!glossary.deleted}
                      onCancel={() => setIsDescriptionEditable(false)}
                      onDescriptionEdit={() => setIsDescriptionEditable(true)}
                      onDescriptionUpdate={onDescriptionUpdate}
                      onThreadLinkSelect={onThreadLinkSelect}
                    />

                    <GlossaryTermTab
                      isGlossary
                      permissions={permissions}
                      refreshGlossaryTerms={refreshGlossaryTerms}
                      termsLoading={termsLoading}
                      onAddGlossaryTerm={onAddGlossaryTerm}
                      onEditGlossaryTerm={onEditGlossaryTerm}
                    />
                  </Space>
                </div>
              ),
              ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
            }}
            secondPanel={{
              children: (
                <GlossaryDetailsRightPanel
                  refreshGlossaryTerms={refreshGlossaryTerms}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
              ),
              ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
              className:
                'entity-resizable-right-panel-container glossary-resizable-panel-container',
            }}
          />
        </Col>
      </Row>
    );
  }, [permissions, glossary, termsLoading, isDescriptionEditable]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMap(customizedPage?.tabs);

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
                  fqn={glossary.fullyQualifiedName ?? ''}
                  hasGlossaryReviewer={!isEmpty(glossary.reviewers)}
                  owners={glossary.owners}
                  onFeedUpdate={getEntityFeedCount}
                  onUpdateEntityDetails={noop}
                />
              ),
            },
          ]
        : []),
    ];

    return getGlossaryTermDetailTabs(items, customizedPage?.tabs);
  }, [
    detailsContent,
    glossary.fullyQualifiedName,
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    activeTab,
    isVersionView,
  ]);

  useEffect(() => {
    getEntityFeedCount();
  }, [glossary.fullyQualifiedName]);

  const fetchDocument = useCallback(async () => {
    const pageFQN = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${selectedPersona.fullyQualifiedName}`;
    try {
      const doc = await getDocumentByFQN(pageFQN);
      setCustomizedPage(
        doc.data?.pages?.find((p: Page) => p.pageType === PageType.Glossary)
      );
    } catch (error) {
      // fail silent
    }
  }, [selectedPersona.fullyQualifiedName]);

  useEffect(() => {
    if (selectedPersona && selectedPersona.fullyQualifiedName) {
      fetchDocument();
    }
  }, [selectedPersona]);

  return (
    <GenericProvider<Glossary>
      data={updatedGlossary}
      isVersionView={isVersionView}
      permissions={permissions}
      type={EntityType.GLOSSARY}
      onUpdate={handleGlossaryUpdate}>
      <Row
        className="glossary-details"
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
            activeKey={activeTab ?? EntityTabs.TERMS}
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
