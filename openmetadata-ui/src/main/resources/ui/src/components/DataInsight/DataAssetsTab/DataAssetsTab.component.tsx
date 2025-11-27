/*
 *  Copyright 2023 Collate.
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
import { Col, Row } from 'antd';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import { useDataInsightProvider } from '../../../pages/DataInsightPage/DataInsightProvider';
import Loader from '../../common/Loader/Loader';
import { DataInsightChartCard } from '../DataInsightChartCard';

const DataAssetsTab = () => {
  const { kpi } = useDataInsightProvider();

  if (kpi.isLoading) {
    return <Loader />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <DataInsightChartCard
          header="label.data-insight-total-entity-summary"
          subHeader="message.total-entity-insight"
          type={SystemChartType.TotalDataAssets}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          listAssets
          header="label.data-insight-description-summary-type"
          headerParams={{
            type: 'label.data-asset',
          }}
          subHeader="message.field-insight"
          subHeaderParams={{
            field: 'label.description-lowercase',
          }}
          type={SystemChartType.PercentageOfDataAssetWithDescription}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          listAssets
          header="label.data-insight-owner-summary-type"
          headerParams={{
            type: 'label.data-asset',
          }}
          subHeader="message.field-insight"
          subHeaderParams={{
            field: 'label.owner',
          }}
          type={SystemChartType.PercentageOfDataAssetWithOwner}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          header="label.data-insight-description-summary-type"
          headerParams={{
            type: 'label.service',
          }}
          subHeader="message.field-insight"
          subHeaderParams={{
            field: 'label.description-lowercase',
          }}
          type={SystemChartType.PercentageOfServiceWithDescription}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          header="label.data-insight-owner-summary-type"
          headerParams={{
            type: 'label.service',
          }}
          subHeader="message.field-insight"
          subHeaderParams={{
            field: 'label.owner',
          }}
          type={SystemChartType.PercentageOfServiceWithOwner}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          header="label.data-insight-tier-summary"
          subHeader="message.field-insight"
          subHeaderParams={{
            field: 'label.tier',
          }}
          type={SystemChartType.TotalDataAssetsByTier}
        />
      </Col>
    </Row>
  );
};

export default DataAssetsTab;
