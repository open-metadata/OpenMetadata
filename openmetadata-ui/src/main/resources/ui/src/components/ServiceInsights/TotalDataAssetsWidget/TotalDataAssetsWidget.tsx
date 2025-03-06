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
import { Card, Skeleton, Tooltip, Typography } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isEmpty } from 'lodash';
import { ServiceTypes } from 'Models';
import { useParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ReactComponent as PieChartIcon } from '../../../assets/svg/pie-chart.svg';
import { WHITE_SMOKE } from '../../../constants/Color.constants';
import { totalDataAssetsWidgetColors } from '../../../constants/TotalDataAssetsWidget.constants';
import { SIZE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { useFqn } from '../../../hooks/useFqn';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityNameLabel } from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import { getAssetsByServiceType } from '../../../utils/ServiceInsightsTabUtils';
import { getServiceNameQueryFilter } from '../../../utils/ServiceUtils';
import { getEntityIcon } from '../../../utils/TableUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import './total-data-assets-widget.less';

function TotalDataAssetsWidget() {
  const { t } = useTranslation();
  const { serviceCategory } = useParams<{
    serviceCategory: ServiceTypes;
    tab: string;
  }>();
  const { fqn: serviceName } = useFqn();
  const [loadingCount, setLoadingCount] = useState<number>(0);
  const [entityCounts, setEntityCounts] =
    useState<
      Array<{ name: string; value: number; fill: string; icon: JSX.Element }>
    >();

  const nameWithoutQuotes = Fqn.getNameWithoutQuotes(serviceName);

  const getDataAssetsCount = useCallback(async () => {
    try {
      setLoadingCount((count) => count + 1);
      const response = await searchQuery({
        queryFilter: getServiceNameQueryFilter(nameWithoutQuotes),
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
        {isEmpty(entityCounts) ? (
          <ErrorPlaceHolder
            placeholderText={t('message.no-entity-data-available', {
              entity: t('label.data-asset-lowercase-plural'),
            })}
            size={SIZE.MEDIUM}
          />
        ) : (
          <>
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

                    <Typography.Text className="font-semibold">
                      {entity.value}
                    </Typography.Text>
                  </div>
                ))}
              </div>
              <div className="h-full flex-center flex-half">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={[{ value: 1 }]}
                      dataKey="value"
                      fill={WHITE_SMOKE}
                      innerRadius="75%"
                      outerRadius="98%">
                      <Cell fill={WHITE_SMOKE} />
                    </Pie>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={entityCounts}
                      dataKey="value"
                      innerRadius="80%"
                      isAnimationActive={false}
                      nameKey="name"
                      outerRadius="93%"
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </Skeleton>
    </Card>
  );
}

export default TotalDataAssetsWidget;
