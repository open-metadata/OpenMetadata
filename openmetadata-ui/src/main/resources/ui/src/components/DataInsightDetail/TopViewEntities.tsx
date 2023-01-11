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

import { Card, Space, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getAggregateChartData } from 'rest/DataInsightAPI';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { MostViewedEntities } from '../../generated/dataInsight/type/mostViewedEntities';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import Loader from '../Loader/Loader';
import './DataInsightDetail.less';

interface Props {
  chartFilter: ChartFilter;
}

const TopViewEntities: FC<Props> = ({ chartFilter }) => {
  const [mostViewedEntities, setMostViewedEntities] =
    useState<MostViewedEntities[]>();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { t } = useTranslation();

  const fetchMostViewedEntities = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.MostViewedEntities,
        dataReportIndex: DataReportIndex.WebAnalyticEntityViewReportDataIndex,
      };
      const response = await getAggregateChartData(params);

      setMostViewedEntities(response.data ?? []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMostViewedEntities();
  }, [chartFilter]);

  const columns: ColumnsType<MostViewedEntities> = useMemo(
    () => [
      {
        title: t('label.data-asset'),
        dataIndex: 'entityFqn',
        key: 'dataAsset',
        render: (entityFqn: string, record: MostViewedEntities) => {
          const decodedFqn = getDecodedFqn(entityFqn);

          if (isUndefined(record.entityHref)) {
            return decodedFqn;
          }
          const { pathname } = new URL(record.entityHref || '');

          return <Link to={pathname || '#'}>{decodedFqn}</Link>;
        },
      },
      {
        title: t('label.data-asset-type'),
        dataIndex: 'entityType',
        key: 'entityType',
        render: (entityType: string) => (
          <Typography.Text>{entityType}</Typography.Text>
        ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (owner: string) =>
          owner ? (
            <Space>
              <ProfilePicture id="" name={owner} type="circle" width="24" />
              <Typography.Text>{owner}</Typography.Text>
            </Space>
          ) : (
            <Typography.Text>--</Typography.Text>
          ),
      },
      {
        title: t('label.total-entity', {
          entity: t('label.view-plural'),
        }),
        dataIndex: 'pageViews',
        key: 'totalViews',
        render: (pageViews: number) => (
          <Typography.Text>{pageViews}</Typography.Text>
        ),
      },
    ],
    []
  );

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-summary-card-percentage"
      title={
        <>
          <Typography.Title level={5}>
            {t('label.data-insight-top-viewed-entity-summary')}
          </Typography.Title>
          <Typography.Text className="data-insight-label-text">
            {t('message.most-viewed-data-assets')}
          </Typography.Text>
        </>
      }>
      <Table
        className="data-insight-table-wrapper"
        columns={columns}
        dataSource={mostViewedEntities}
        loading={{ spinning: isLoading, indicator: <Loader /> }}
        pagination={false}
        size="small"
      />
    </Card>
  );
};

export default TopViewEntities;
