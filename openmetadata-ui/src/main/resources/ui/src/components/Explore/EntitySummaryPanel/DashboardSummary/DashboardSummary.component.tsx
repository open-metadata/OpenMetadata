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

import { Col, Divider, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { ChartType } from 'pages/DashboardDetailsPage/DashboardDetailsPage.component';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DRAWER, getEntityOverview } from 'utils/EntityUtils';
import SVGIcons from 'utils/SvgUtils';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Dashboard } from '../../../../generated/entity/data/dashboard';
import { fetchCharts } from '../../../../utils/DashboardDetailsUtils';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import TableDataCardTitle from '../../../common/table-data-card-v2/TableDataCardTitle.component';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface DashboardSummaryProps {
  entityDetails: Dashboard;
  componentType?: string;
}

function DashboardSummary({
  entityDetails,
  componentType = DRAWER.explore,
}: DashboardSummaryProps) {
  const { t } = useTranslation();
  const [charts, setCharts] = useState<ChartType[]>();

  const fetchChartsDetails = async () => {
    try {
      const chartDetails = await fetchCharts(entityDetails.charts);

      const updatedCharts = chartDetails.map((chartItem) => ({
        ...chartItem,
        chartUrl: chartItem.chartUrl,
      }));

      setCharts(updatedCharts);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.dashboard-detail-plural-lowercase'),
        })
      );
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
    () => getFormattedEntityData(SummaryEntityType.CHART, charts),
    [charts]
  );

  return (
    <>
      <Row
        className={classNames({
          'm-md': componentType === DRAWER.explore,
        })}
        gutter={[0, 4]}>
        {componentType === DRAWER.explore ? (
          <Col span={24}>
            <TableDataCardTitle
              dataTestId="summary-panel-title"
              searchIndex={SearchIndex.DASHBOARD}
              source={entityDetails}
            />
          </Col>
        ) : null}

        <Col span={24}>
          <Row>
            {entityInfo.map((info) =>
              info.visible?.includes(componentType) ? (
                <Col key={info.name} span={24}>
                  <Row gutter={16}>
                    <Col
                      className="text-gray"
                      data-testid={`${info.name}-label`}
                      span={10}>
                      {info.name}
                    </Col>
                    <Col data-testid="dashboard-url-value" span={12}>
                      {info.isLink ? (
                        <Link target="_blank" to={{ pathname: info.url }}>
                          <Space align="start">
                            <Typography.Text
                              className="link"
                              data-testid="dashboard-link-name">
                              {entityDetails.fullyQualifiedName}
                            </Typography.Text>
                            <SVGIcons
                              alt="external-link"
                              icon="external-link"
                              width="12px"
                            />
                          </Space>
                        </Link>
                      ) : (
                        info.value
                      )}
                    </Col>
                  </Row>
                </Col>
              ) : null
            )}
          </Row>
        </Col>
      </Row>
      <Divider className="m-y-xs" />

      <Row
        className={classNames({
          'm-md': componentType === DRAWER.explore,
        })}
        gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="section-header"
            data-testid="charts-header">
            {t('label.chart-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <SummaryList formattedEntityData={formattedChartsData} />
        </Col>
      </Row>
    </>
  );
}

export default DashboardSummary;
