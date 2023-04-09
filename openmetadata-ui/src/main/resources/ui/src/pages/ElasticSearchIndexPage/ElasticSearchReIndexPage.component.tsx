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

import { Col, Row, Tabs, TabsProps } from 'antd';
import PageHeader from 'components/header/PageHeader.component';
import SettingsIngestion from 'components/SettingsIngestion/SettingsIngestion.component';
import TriggerReIndexing from 'components/TriggerReIndexing/TriggerReIndexing.component';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from 'constants/GlobalSettings.constants';
import { ELASTIC_SEARCH_RE_INDEX_PAGE_TABS } from 'enums/ElasticSearch.enum';
import { PipelineType } from 'generated/api/services/ingestionPipelines/createIngestionPipeline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getSettingsPathWithFqn } from 'utils/RouterUtils';
import './ElasticSearchReIndex.style.less';

const ElasticSearchIndexPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const [activeTabKey, setActiveTabKey] = useState<string>('1');

  const tabItems: TabsProps['items'] = useMemo(
    () => [
      {
        key: '1',
        label: t('label.on-demand'),
        children: <TriggerReIndexing />,
      },
      {
        key: '2',
        label: t('label.schedule'),
        children: (
          <SettingsIngestion
            containerClassName="m-t-0"
            pipelineType={PipelineType.ElasticSearchReindex}
          />
        ),
      },
    ],
    []
  );

  const handleTabClick = useCallback((activeKey: string) => {
    const tabName =
      activeKey === '1'
        ? ELASTIC_SEARCH_RE_INDEX_PAGE_TABS.ON_DEMAND
        : ELASTIC_SEARCH_RE_INDEX_PAGE_TABS.SCHEDULE;

    history.replace(
      getSettingsPathWithFqn(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        GlobalSettingOptions.SEARCH,
        tabName
      )
    );
  }, []);

  useEffect(() => {
    const tabNumber =
      fqn === ELASTIC_SEARCH_RE_INDEX_PAGE_TABS.ON_DEMAND ? '1' : '2';
    setActiveTabKey(tabNumber);
  }, [fqn]);

  return (
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <PageHeader
          data={{
            header: t('label.search'),
            subHeader: t('message.elastic-search-message'),
          }}
        />
      </Col>
      <Col span={24}>
        <Tabs
          activeKey={activeTabKey}
          items={tabItems}
          onTabClick={handleTabClick}
        />
      </Col>
    </Row>
  );
};

export default ElasticSearchIndexPage;
