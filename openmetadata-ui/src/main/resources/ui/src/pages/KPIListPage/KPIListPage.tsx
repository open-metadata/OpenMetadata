/*
 *  Copyright 2022 Collate
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

import { Button, Col, Row, Space, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getListKPIs } from '../../axiosAPIs/KpiAPI';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import Loader from '../../components/Loader/Loader';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
  ROUTES,
} from '../../constants/constants';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';

import { Paging } from '../../generated/type/paging';
import { formatDateTimeFromSeconds } from '../../utils/TimeUtils';

const KPIListPage = () => {
  const { t } = useTranslation();
  const [KpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [kpiPage, setKpiPage] = useState(INITIAL_PAGING_VALUE);
  const [kpiPaging, setKpiPaging] = useState<Paging>(pagingObject);

  const fetchKpiList = async (param?: Record<string, string>) => {
    try {
      setIsLoading(true);
      const response = await getListKPIs({
        fields:
          'startDate,endDate,targetDefinition,dataInsightChart,metricType',
        limit: PAGE_SIZE_MEDIUM,
        before: param && param.before,
        after: param && param.after,
      });
      setKpiList(response.data);
      setKpiPaging(response.paging);
    } catch (err) {
      setKpiList([]);
      setKpiPaging(pagingObject);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = useMemo(() => {
    const col: ColumnsType<Kpi> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (name: string) => <Typography.Text>{name}</Typography.Text>,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (description: string | undefined) => (
          <RichTextEditorPreviewer markdown={description || ''} />
        ),
      },
      {
        title: t('label.start-date'),
        dataIndex: 'startDate',
        key: 'startDate',
        render: (startDate: number) => (
          <Typography.Text>
            {' '}
            {formatDateTimeFromSeconds(startDate)}
          </Typography.Text>
        ),
      },
      {
        title: t('label.end-date'),
        dataIndex: 'endDate',
        key: 'endDate',
        render: (endDate: number) => (
          <Typography.Text>
            {formatDateTimeFromSeconds(endDate)}
          </Typography.Text>
        ),
      },
      {
        title: t('label.metric-type'),
        dataIndex: 'metricType',
        key: 'metricType',
        render: (metricType: KpiTargetType) => (
          <Typography.Text>{metricType}</Typography.Text>
        ),
      },
    ];

    return col;
  }, [KpiList]);

  const kpiPagingHandler = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    setKpiPage(activePage as number);
    fetchKpiList({
      [cursorValue]: kpiPaging[cursorValue as keyof Paging] as string,
    });
  };

  useEffect(() => {
    fetchKpiList();
  }, []);

  return (
    <PageLayoutV1>
      <Row className="w-full" gutter={[16, 16]}>
        <Col span={24}>
          <Space className="w-full justify-between">
            <TitleBreadcrumb
              titleLinks={[
                {
                  name: 'Data Insights',
                  url: ROUTES.DATA_INSIGHT,
                },
                {
                  name: 'KPI List',
                  url: '',
                  activeTitle: true,
                },
              ]}
            />
            <Button type="primary">Add KPI</Button>
          </Space>
        </Col>
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            dataSource={KpiList}
            loading={{ spinning: isLoading, indicator: <Loader /> }}
            pagination={false}
            rowKey="name"
            size="small"
          />
        </Col>
        {KpiList.length > PAGE_SIZE_MEDIUM && (
          <Col span={24}>
            <NextPrevious
              currentPage={kpiPage}
              pageSize={PAGE_SIZE_MEDIUM}
              paging={kpiPaging}
              pagingHandler={kpiPagingHandler}
              totalCount={kpiPaging.total}
            />
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default KPIListPage;
