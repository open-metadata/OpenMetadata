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

import { Button, Col, Row, Space, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { getListKPIs } from '../../axiosAPIs/KpiAPI';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import Loader from '../../components/Loader/Loader';
import {
  getKpiPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
  ROUTES,
} from '../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { EntityType } from '../../enums/entity.enum';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';

import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { formatDateTime } from '../../utils/TimeUtils';

const KPIListPage = () => {
  const { isAdminUser } = useAuth();
  const history = useHistory();
  const { t } = useTranslation();
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [kpiPage, setKpiPage] = useState(INITIAL_PAGING_VALUE);
  const [kpiPaging, setKpiPaging] = useState<Paging>(pagingObject);
  const [selectedKpi, setSelectedKpi] = useState<Kpi>();

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
        render: (name: string, record) => (
          <Link to={getKpiPath(name)}>{getEntityName(record)}</Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 300,
        render: (description: string | undefined) =>
          description ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <span data-testid="no-description">
              {t('label.no-description')}
            </span>
          ),
      },
      {
        title: t('label.start-date'),
        dataIndex: 'startDate',
        key: 'startDate',
        render: (startDate: number) => (
          <Typography.Text> {formatDateTime(startDate)}</Typography.Text>
        ),
      },
      {
        title: t('label.end-date'),
        dataIndex: 'endDate',
        key: 'endDate',
        render: (endDate: number) => (
          <Typography.Text>{formatDateTime(endDate)}</Typography.Text>
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
      {
        title: 'Actions',
        dataIndex: 'actions',
        width: '80px',
        key: 'actions',
        render: (_, record) => {
          return (
            <Tooltip
              placement="left"
              title={
                isAdminUser ? t('label.delete') : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                data-testid={`delete-action-${getEntityName(record)}`}
                disabled={!isAdminUser}
                icon={
                  <SVGIcons alt="delete" icon={Icons.DELETE} width="18px" />
                }
                type="text"
                onClick={() => setSelectedKpi(record)}
              />
            </Tooltip>
          );
        },
      },
    ];

    return col;
  }, [kpiList]);

  const kpiPagingHandler = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    setKpiPage(activePage as number);
    fetchKpiList({
      [cursorValue]: kpiPaging[cursorValue as keyof Paging] as string,
    });
  };

  const handleAddKPI = () => {
    history.push(ROUTES.ADD_KPI);
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
                  name: t('label.data-insight'),
                  url: ROUTES.DATA_INSIGHT,
                },
                {
                  name: t('label.kpi-list'),
                  url: '',
                  activeTitle: true,
                },
              ]}
            />
            <Tooltip
              title={
                isAdminUser ? t('label.add-kpi') : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                disabled={!isAdminUser}
                type="primary"
                onClick={handleAddKPI}>
                {t('label.add-kpi')}
              </Button>
            </Tooltip>
          </Space>
        </Col>
        <Col span={24}>
          <Table
            bordered
            columns={columns}
            dataSource={kpiList}
            loading={{ spinning: isLoading, indicator: <Loader /> }}
            pagination={false}
            rowKey="name"
            size="small"
          />
        </Col>
        {kpiList.length > PAGE_SIZE_MEDIUM && (
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
      {selectedKpi && (
        <DeleteWidgetModal
          afterDeleteAction={fetchKpiList}
          allowSoftDelete={false}
          deleteMessage={`Are you sure you want to delete ${getEntityName(
            selectedKpi
          )}`}
          entityId={selectedKpi.id}
          entityName={getEntityName(selectedKpi)}
          entityType={EntityType.KPI}
          visible={!isUndefined(selectedKpi)}
          onCancel={() => setSelectedKpi(undefined)}
        />
      )}
    </PageLayoutV1>
  );
};

export default KPIListPage;
