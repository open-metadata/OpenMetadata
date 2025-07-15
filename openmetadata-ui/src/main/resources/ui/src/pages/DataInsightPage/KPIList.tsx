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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as IconDelete } from '../../assets/svg/ic-delete.svg';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../components/common/Table/Table';
import { EmptyGraphPlaceholder } from '../../components/DataInsight/EmptyGraphPlaceholder';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
} from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { Operation } from '../../generated/entity/policies/policy';
import { Paging } from '../../generated/type/paging';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getListKPIs } from '../../rest/KpiAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getKpiPath } from '../../utils/RouterUtils';

const KPIList = () => {
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const isAdminUser = currentUser?.isAdmin ?? false;
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
        fields: [
          TabSpecificField.START_DATE,
          TabSpecificField.END_DATE,
          TabSpecificField.TARGET_VALUE,
          TabSpecificField.DATA_INSIGHT_CHART,
          TabSpecificField.METRIC_TYPE,
        ],
        limit: PAGE_SIZE_MEDIUM,
        before: param && param.before,
        after: param && param.after,
      });
      setKpiList(response.data);
      setKpiPaging(response.paging);
    } catch {
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
            <RichTextEditorPreviewerNew markdown={description} />
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
        dataIndex: 'targetValue',
        key: 'targetValue',
        render: (value: Kpi['targetValue'], record: Kpi) => {
          const isPercentageMetric =
            record.metricType === KpiTargetType.Percentage;
          const targetValue = isPercentageMetric ? `${+value}%` : value;

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
                  onClick={() => navigate(getKpiPath(record.name))}
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
                    <Icon component={IconDelete} style={{ fontSize: '16px' }} />
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
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.kpi-uppercase'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      ),
    [viewKPIPermission]
  );

  return (
    <>
      <Table
        columns={columns}
        containerClassName="kpi-table"
        customPaginationProps={{
          currentPage: kpiPage,
          isLoading,
          showPagination: kpiList.length > PAGE_SIZE_MEDIUM,
          pageSize: PAGE_SIZE_MEDIUM,
          paging: kpiPaging,
          pagingHandler: kpiPagingHandler,
        }}
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
