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
import { PipelineType } from 'generated/api/services/ingestionPipelines/createIngestionPipeline';
import React from 'react';
import { useTranslation } from 'react-i18next';
import './ElasticSearchReIndex.style.less';

const ElasticSearchIndexPage = () => {
  const { t } = useTranslation();

  const tabItems: TabsProps['items'] = [
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
  ];

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
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Col>
    </Row>
  );
};

export default ElasticSearchIndexPage;
