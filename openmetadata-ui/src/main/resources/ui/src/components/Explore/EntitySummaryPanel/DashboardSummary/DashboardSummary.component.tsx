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
import { AxiosError } from 'axios';
import SummaryTagsDescription from 'components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import SummaryPanelSkeleton from 'components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { TagLabel } from 'generated/type/tagLabel';
import { ChartType } from 'pages/DashboardDetailsPage/DashboardDetailsPage.component';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from 'utils/EntityUtils';
import SVGIcons from 'utils/SvgUtils';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { Dashboard } from '../../../../generated/entity/data/dashboard';
import { fetchCharts } from '../../../../utils/DashboardDetailsUtils';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';

interface DashboardSummaryProps {
  entityDetails: Dashboard;
  componentType?: string;
  tags?: (TagLabel | undefined)[];
  isLoading?: boolean;
}

function DashboardSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
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

  const isExplore = useMemo(
    () => componentType === DRAWER_NAVIGATION_OPTIONS.explore,
    [componentType]
  );

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md" gutter={[0, 4]}>
          <Col span={24}>
            <Row>
              {entityInfo.map((info) =>
                info.visible?.includes(componentType) ? (
                  <Col key={info.name} span={24}>
                    <Row gutter={[16, 32]}>
                      <Col data-testid={`${info.name}-label`} span={8}>
                        <Typography.Text className="text-grey-muted">
                          {info.name}
                        </Typography.Text>
                      </Col>
                      <Col data-testid="dashboard-url-value" span={16}>
                        {info.isLink ? (
                          <Link
                            component={Typography.Link}
                            target={info.isExternal ? '_blank' : '_self'}
                            to={{ pathname: info.url }}>
                            <Typography.Link
                              className="text-primary"
                              data-testid="dashboard-link-name">
                              {info.value}
                            </Typography.Link>
                            {info.isExternal ? (
                              <SVGIcons
                                alt="external-link"
                                className="m-l-xs"
                                icon="external-link"
                                width="12px"
                              />
                            ) : null}
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

        {!isExplore ? (
          <>
            <SummaryTagsDescription
              entityDetail={entityDetails}
              tags={tags ? tags : []}
            />
            <Divider className="m-y-xs" />
          </>
        ) : null}

        <Row className="m-md" gutter={[0, 16]}>
          <Col span={24}>
            <Typography.Text
              className="text-base text-grey-muted"
              data-testid="charts-header">
              {t('label.chart-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <SummaryList formattedEntityData={formattedChartsData} />
          </Col>
        </Row>
      </>
    </SummaryPanelSkeleton>
  );
}

export default DashboardSummary;
