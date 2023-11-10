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

import { Button, Col, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import Table from '../../components/common/Table/Table';
import { EmptyGraphPlaceholder } from '../../components/DataInsightDetail/EmptyGraphPlaceholder';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import {
  getKpiPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
} from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { Operation } from '../../generated/entity/policies/policy';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { getListKPIs } from '../../rest/KpiAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const KPIList = () => {
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const viewKPIPermission = useMemo(
    () => checkPermission(Operation.ViewAll, ResourceEntity.KPI, permissions),
    [permissions]
  );
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
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
      {
        title: t('label.start-entity', { entity: t('label.date') }),
        dataIndex: 'startDate',
        key: 'startDate',
        render: (startDate: number) => (
          <Typography.Text>{formatDateTime(startDate)}</Typography.Text>
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
        title: t('label.target'),
        dataIndex: 'targetDefinition',
        key: 'targetDefinition',
        render: (targetDefinition: Kpi['targetDefinition'], record: Kpi) => {
          const isPercentageMetric =
            record.metricType === KpiTargetType.Percentage;
          const targetValue = targetDefinition?.length
            ? isPercentageMetric
              ? `${+targetDefinition[0].value * 100}%`
              : targetDefinition[0].value
            : '-';

          return <Typography.Text>{targetValue}</Typography.Text>;
        },
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
        title: t('label.action-plural'),
        dataIndex: 'actions',
        width: '80px',
        key: 'actions',
        render: (_, record) => {
          return (
            <div className="d-flex items-center">
              <Tooltip
                placement="left"
                title={
                  isAdminUser
                    ? t('label.edit')
                    : t('message.no-permission-for-action')
                }>
                <Button
                  className="flex-center"
                  data-testid={`edit-action-${getEntityName(record)}`}
                  disabled={!isAdminUser}
                  icon={<EditIcon width="16px" />}
                  type="text"
                  onClick={() => history.push(getKpiPath(record.name))}
                />
              </Tooltip>
              <Tooltip
                placement="left"
                title={
                  isAdminUser
                    ? t('label.delete')
                    : t('message.no-permission-for-action')
                }>
                <Button
                  data-testid={`delete-action-${getEntityName(record)}`}
                  disabled={!isAdminUser}
                  icon={
                    <SVGIcons alt="delete" icon={Icons.DELETE} width="16px" />
                  }
                  type="text"
                  onClick={() => setSelectedKpi(record)}
                />
              </Tooltip>
            </div>
          );
        },
      },
    ];

    return col;
  }, [kpiList]);

  const kpiPagingHandler = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType) {
      setKpiPage(currentPage);
      fetchKpiList({
        [cursorType]: kpiPaging[cursorType as keyof Paging] as string,
      });
    }
  };

  useEffect(() => {
    fetchKpiList();
  }, []);

  const handleAfterDeleteAction = useCallback(() => {
    fetchKpiList();
  }, [fetchKpiList]);

  const noDataPlaceHolder = useMemo(
    () =>
      viewKPIPermission ? (
        <EmptyGraphPlaceholder />
      ) : (
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
      ),
    [viewKPIPermission]
  );

  return (
    <>
      <Col span={24}>
        <Table
          bordered
          columns={columns}
          data-testid="kpi-table"
          dataSource={kpiList}
          loading={isLoading}
          locale={{
            emptyText: noDataPlaceHolder,
          }}
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
          />
        </Col>
      )}

      {selectedKpi && (
        <DeleteWidgetModal
          afterDeleteAction={handleAfterDeleteAction}
          allowSoftDelete={false}
          deleteMessage={t('message.are-you-sure-delete-entity', {
            entity: getEntityName(selectedKpi),
          })}
          entityId={selectedKpi.id}
          entityName={getEntityName(selectedKpi)}
          entityType={EntityType.KPI}
          visible={!isUndefined(selectedKpi)}
          onCancel={() => setSelectedKpi(undefined)}
        />
      )}
    </>
  );
};

export default KPIList;
