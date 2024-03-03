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
import { noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getGlossaryTermDetailsPath } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { ChangeDescription } from '../../../generated/entity/type';
import { FeedCounts } from '../../../interface/feed.interface';
import { getFeedCounts } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import GlossaryDetailsRightPanel from '../GlossaryDetailsRightPanel/GlossaryDetailsRightPanel.component';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from '../GlossaryTermTab/GlossaryTermTab.component';
import './glossary-details.less';
import {
  GlossaryDetailsProps,
  GlossaryTabs,
} from './GlossaryDetails.interface';

const GlossaryDetails = ({
  permissions,
  glossary,
  updateGlossary,
  updateVote,
  handleGlossaryDelete,
  glossaryTerms,
  termsLoading,
  refreshGlossaryTerms,
  onAddGlossaryTerm,
  onEditGlossaryTerm,
  isVersionView,
  onThreadLinkSelect,
}: GlossaryDetailsProps) => {
  const { t } = useTranslation();
  const history = useHistory();

  const { tab: activeTab } = useParams<{ tab: string }>();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);

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

  const description = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossary.changeDescription as ChangeDescription,
            EntityField.DESCRIPTION,
            glossary.description
          )
        : glossary.description,

    [glossary, isVersionView]
  );

  const name = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossary.changeDescription as ChangeDescription,
            EntityField.NAME,
            glossary.name
          )
        : glossary.name,

    [glossary, isVersionView]
  );

  const displayName = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossary.changeDescription as ChangeDescription,
            EntityField.DISPLAYNAME,
            glossary.displayName
          )
        : glossary.displayName,

    [glossary, isVersionView]
  );

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getGlossaryTermDetailsPath(glossary.fullyQualifiedName ?? '', activeKey)
      );
    }
  };

  const detailsContent = useMemo(() => {
    return (
      <Row className="h-full p-x-md" gutter={[32, 16]}>
        <Col
          className="border-right p-y-md glossary-content-container"
          span={18}>
          <Space className="w-full" direction="vertical" size={24}>
            <DescriptionV1
              description={description}
              entityFqn={glossary.fullyQualifiedName}
              entityName={getEntityName(glossary)}
              entityType={EntityType.GLOSSARY}
              hasEditAccess={permissions.EditDescription || permissions.EditAll}
              isEdit={isDescriptionEditable}
              owner={glossary?.owner}
              showActions={!glossary.deleted}
              onCancel={() => setIsDescriptionEditable(false)}
              onDescriptionEdit={() => setIsDescriptionEditable(true)}
              onDescriptionUpdate={onDescriptionUpdate}
              onThreadLinkSelect={onThreadLinkSelect}
            />

            <GlossaryTermTab
              isGlossary
              childGlossaryTerms={glossaryTerms}
              permissions={permissions}
              refreshGlossaryTerms={refreshGlossaryTerms}
              selectedData={glossary}
              termsLoading={termsLoading}
              onAddGlossaryTerm={onAddGlossaryTerm}
              onEditGlossaryTerm={onEditGlossaryTerm}
            />
          </Space>
        </Col>
        <Col className="p-y-md" span={6}>
          <GlossaryDetailsRightPanel
            isGlossary
            entityType={EntityType.GLOSSARY_TERM}
            isVersionView={isVersionView}
            permissions={permissions}
            refreshGlossaryTerms={refreshGlossaryTerms}
            selectedData={glossary}
            onThreadLinkSelect={onThreadLinkSelect}
            onUpdate={handleGlossaryUpdate}
          />
        </Col>
      </Row>
    );
  }, [
    isVersionView,
    permissions,
    glossary,
    glossaryTerms,
    termsLoading,
    description,
    isDescriptionEditable,
  ]);

  const tabs = useMemo(() => {
    return [
      {
        label: (
          <TabsLabel
            id={GlossaryTabs.TERMS}
            isActive={activeTab === GlossaryTabs.TERMS}
            name={t('label.term-plural')}
          />
        ),
        key: GlossaryTabs.TERMS,
        children: detailsContent,
      },
      ...(!isVersionView
        ? [
            {
              label: (
                <TabsLabel
                  count={feedCount.totalCount}
                  id={GlossaryTabs.ACTIVITY_FEED}
                  isActive={activeTab === GlossaryTabs.ACTIVITY_FEED}
                  name={t('label.activity-feed-and-task-plural')}
                />
              ),
              key: GlossaryTabs.ACTIVITY_FEED,
              children: (
                <ActivityFeedTab
                  refetchFeed
                  entityFeedTotalCount={feedCount.totalCount}
                  entityType={EntityType.GLOSSARY}
                  fqn={glossary.fullyQualifiedName ?? ''}
                  onFeedUpdate={getEntityFeedCount}
                  onUpdateEntityDetails={noop}
                />
              ),
            },
          ]
        : []),
    ];
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

  return (
    <Row
      className="glossary-details"
      data-testid="glossary-details"
      gutter={[0, 16]}>
      <Col className="p-x-md" span={24}>
        <GlossaryHeader
          isGlossary
          isVersionView={isVersionView}
          permissions={permissions}
          selectedData={{ ...glossary, displayName, name }}
          updateVote={updateVote}
          onAddGlossaryTerm={onAddGlossaryTerm}
          onDelete={handleGlossaryDelete}
          onUpdate={handleGlossaryUpdate}
        />
      </Col>
      <Col span={24}>
        <Tabs
          activeKey={activeTab ?? GlossaryTabs.TERMS}
          className="glossary-details-page-tabs"
          data-testid="tabs"
          items={tabs}
          onChange={handleTabChange}
        />
      </Col>
    </Row>
  );
};

export default GlossaryDetails;
