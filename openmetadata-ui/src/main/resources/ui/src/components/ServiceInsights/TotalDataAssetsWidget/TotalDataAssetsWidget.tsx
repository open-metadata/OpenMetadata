/*
 *  Copyright 2025 Collate.
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
import { Card, Skeleton, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { ServiceTypes } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ReactComponent as PieChartIcon } from '../../../assets/svg/pie-chart.svg';
import { WHITE_SMOKE } from '../../../constants/Color.constants';
import { totalDataAssetsWidgetColors } from '../../../constants/TotalDataAssetsWidget.constants';
import { SearchIndex } from '../../../enums/search.enum';
import { ServiceInsightsWidgetType } from '../../../enums/ServiceInsights.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityNameLabel } from '../../../utils/EntityUtils';
import {
  getAssetsByServiceType,
  getServiceInsightsWidgetPlaceholder,
} from '../../../utils/ServiceInsightsTabUtils';
import {
  getReadableCountString,
  getServiceNameQueryFilter,
} from '../../../utils/ServiceUtils';
import { getEntityIcon } from '../../../utils/TableUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { ServiceInsightWidgetCommonProps } from '../ServiceInsightsTab.interface';
import './total-data-assets-widget.less';

function TotalDataAssetsWidget({
  serviceName,
}: Readonly<ServiceInsightWidgetCommonProps>) {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceTypes;
    tab: string;
  }>();
  const [loadingCount, setLoadingCount] = useState<number>(0);
  const [hoveredSegment, setHoveredSegment] = useState<{
    name: string;
    value: number;
  } | null>(null);
  const [entityCounts, setEntityCounts] =
    useState<
      Array<{ name: string; value: number; fill: string; icon: JSX.Element }>
    >();

  const showPlaceholder = useMemo(
    () =>
      isEmpty(entityCounts) ||
      entityCounts?.every((entity) => entity.value === 0),
    [entityCounts]
  );

  const totalCount =
    entityCounts?.reduce((sum, entity) => sum + entity.value, 0) ?? 0;

  const getDataAssetsCount = useCallback(async () => {
    try {
      setLoadingCount((count) => count + 1);
      const response = await searchQuery({
        queryFilter: getServiceNameQueryFilter(serviceName),
        searchIndex: SearchIndex.ALL,
      });

      const assets = getAssetsByServiceType(serviceCategory);

      const buckets = response.aggregations['entityType'].buckets.filter(
        (bucket) => assets.includes(bucket.key)
      );

      const entityCountsArray = buckets.map((bucket, index) => ({
        name: getEntityNameLabel(bucket.key),
        value: bucket.doc_count ?? 0,
        fill: totalDataAssetsWidgetColors[index],
        icon: getEntityIcon(bucket.key, '', { height: 16, width: 16 }) ?? <></>,
      }));

      setEntityCounts(entityCountsArray);
    } catch {
      // Error
    } finally {
      setLoadingCount((count) => count - 1);
    }
  }, []);

  const errorPlaceholder = useMemo(
    () =>
      getServiceInsightsWidgetPlaceholder({
        height: 140,
        width: 140,
        chartType: ServiceInsightsWidgetType.TOTAL_DATA_ASSETS,
        placeholderClassName: 'border-none',
        theme,
      }),
    []
  );

  useEffect(() => {
    getDataAssetsCount();
  }, []);

  return (
    <Card className="widget-info-card total-data-assets-widget">
      <div className="flex items-center gap-2">
        <div className="p-0 icon-container">
          <PieChartIcon height={16} width={16} />
        </div>

        <Typography.Text className="font-semibold text-md">
          {t('label.total-entity', { entity: t('label.data-asset-plural') })}
        </Typography.Text>
      </div>
      <Skeleton loading={loadingCount > 0}>
        {showPlaceholder ? (
          errorPlaceholder
        ) : (
          <div className="total-data-assets-info">
            <div className="assets-list-container">
              {entityCounts?.map((entity) => (
                <div
                  className="flex items-center justify-between"
                  key={entity.name}>
                  <div className="flex items-center gap-3">
                    <div
                      className="bullet"
                      style={{
                        backgroundColor: entity.fill,
                      }}
                    />
                    <div className="p-0 icon-container">{entity.icon}</div>

                    <Typography.Text>{entity.name}</Typography.Text>
                  </div>

                  <Typography.Text className="font-bold">
                    {getReadableCountString(entity.value)}
                  </Typography.Text>
                </div>
              ))}
            </div>
            <div className="chart-container">
              <ResponsiveContainer height="100%" minHeight={275} width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={[{ value: 1 }]}
                    dataKey="value"
                    fill={WHITE_SMOKE}
                    innerRadius="74%"
                    outerRadius="99%">
                    <Cell fill={WHITE_SMOKE} />
                  </Pie>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={entityCounts}
                    dataKey="value"
                    innerRadius="79%"
                    isAnimationActive={false}
                    nameKey="name"
                    outerRadius="94%"
                    onMouseEnter={(_, index) => {
                      if (entityCounts?.[index]) {
                        setHoveredSegment({
                          name: entityCounts[index].name,
                          value: entityCounts[index].value,
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredSegment(null)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="tooltip-container">
                <Typography.Text strong className="text-md font-bold">
                  {getReadableCountString(
                    hoveredSegment ? hoveredSegment.value : totalCount
                  )}
                </Typography.Text>
                <Typography.Text className="text-sm text-grey-muted">
                  {hoveredSegment
                    ? hoveredSegment.name
                    : t('label.total-entity', {
                        entity: t('label.asset-plural'),
                      })}
                </Typography.Text>
              </div>
            </div>
          </div>
        )}
      </Skeleton>
    </Card>
  );
}

export default TotalDataAssetsWidget;
