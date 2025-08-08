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
import { isEmpty, noop } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { PageType } from '../../../generated/system/ui/page';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { FeedCounts } from '../../../interface/feed.interface';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getGlossaryTermDetailsPath } from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { GenericTab } from '../../Customization/GenericTab/GenericTab';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import { useGlossaryStore } from '../useGlossary.store';
import './glossary-details.less';
import { GlossaryDetailsProps } from './GlossaryDetails.interface';

const GlossaryDetails = ({
  updateVote,
  handleGlossaryDelete,
  isVersionView,
  toggleTabExpanded,
  isTabExpanded,
}: GlossaryDetailsProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeGlossary: glossary } = useGlossaryStore();
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const { onAddGlossaryTerm } = useGlossaryStore();

  // Since we are rendering this component for all customized tabs we need tab ID to get layout form store
  const { tab: activeTab } = useRequiredParams<{ tab: EntityTabs }>();
  const { customizedPage, isLoading } = useCustomPages(PageType.Glossary);

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

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getGlossaryTermDetailsPath(glossary.fullyQualifiedName ?? '', activeKey)
      );
    }
  };

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
        children: <GenericTab type={PageType.Glossary} />,
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
                  feedCount={feedCount}
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

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Glossary),
    [tabs[0], activeTab]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row
      className="glossary-details"
      data-testid="glossary-details"
      gutter={[0, 12]}>
      <Col span={24}>
        <GlossaryHeader
          updateVote={updateVote}
          onAddGlossaryTerm={onAddGlossaryTerm}
          onDelete={handleGlossaryDelete}
        />
      </Col>
      <Col className="glossary-page-tabs" span={24}>
        <Tabs
          activeKey={activeTab}
          className="tabs-new"
          data-testid="tabs"
          items={tabs}
          tabBarExtraContent={
            isExpandViewSupported && (
              <AlignRightIconButton
                className={isTabExpanded ? 'rotate-180' : ''}
                title={isTabExpanded ? t('label.collapse') : t('label.expand')}
                onClick={toggleTabExpanded}
              />
            )
          }
          onChange={handleTabChange}
        />
      </Col>
    </Row>
  );
};

export default GlossaryDetails;
