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

import { Col, Divider, Row, Typography } from 'antd';
import { get } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import {
  Dashboard,
  TagLabel,
} from '../../../../generated/entity/data/dashboard';
import { fetchCharts } from '../../../../utils/DashboardDetailsUtils';
import {
  getFormattedEntityData,
  getSortedTagsWithHighlight,
} from '../../../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../../../utils/EntityUtils';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { ChartType } from '../../../DashboardDetails/DashboardDetails.interface';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';
import SummaryPanelSkeleton from '../../../Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import CommonEntitySummaryInfo from '../CommonEntitySummaryInfo/CommonEntitySummaryInfo';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface DashboardSummaryProps {
  entityDetails: Dashboard;
  componentType?: DRAWER_NAVIGATION_OPTIONS;
  tags?: TagLabel[];
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

function DashboardSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
  highlights,
}: DashboardSummaryProps) {
  const { t } = useTranslation();
  const [charts, setCharts] = useState<ChartType[]>();

  const fetchChartsDetails = async () => {
    try {
      const chartDetails = await fetchCharts(entityDetails.charts);

      const updatedCharts = chartDetails.map((chartItem) => ({
        ...chartItem,
        sourceUrl: chartItem.sourceUrl,
      }));

      setCharts(updatedCharts);
    } catch (err) {
      // Error
    }
  };

  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.DASHBOARDS, entityDetails),
    [entityDetails]
  );

  useEffect(() => {
    fetchChartsDetails();
  }, [entityDetails]);

  const formattedChartsData: BasicEntityInfo[] = useMemo(
    () => getFormattedEntityData(SummaryEntityType.CHART, charts, highlights),
    [charts]
  );

  const formattedDataModelData: BasicEntityInfo[] = useMemo(
    () =>
      getFormattedEntityData(
        SummaryEntityType.COLUMN,
        entityDetails.dataModels,
        highlights
      ),
    [charts]
  );

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 4]}>
          <Col span={24}>
            <CommonEntitySummaryInfo
              componentType={componentType}
              entityInfo={entityInfo}
            />
          </Col>
        </Row>
        <Divider className="m-y-xs" />

        <SummaryTagsDescription
          entityDetail={entityDetails}
          tags={
            tags ??
            getSortedTagsWithHighlight({
              tags: entityDetails.tags,
              sortTagsBasedOnGivenTagFQNs: get(highlights, 'tag.name', []),
            }) ??
            []
          }
        />
        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="charts-header">
              {t('label.chart-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <SummaryList formattedEntityData={formattedChartsData} />
          </Col>
        </Row>

        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="data-model-header">
              {t('label.data-model-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <SummaryList formattedEntityData={formattedDataModelData} />
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
}

export default DashboardSummary;
