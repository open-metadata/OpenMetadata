/*
 *  Copyright 2023 Collate.
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
import { Button, Col, Row, TablePaginationConfig } from 'antd';
import { ColumnsType, TableProps } from 'antd/lib/table';
import { FilterValue, TableRowSelection } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import { isNil, map, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAirflowStatus } from '../../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { EntityType, TabSpecificField } from '../../../../../enums/entity.enum';
import { ServiceCategory } from '../../../../../enums/service.enum';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../../../../generated/type/paging';
import { usePaging } from '../../../../../hooks/paging/usePaging';
import {
  deployIngestionPipelineById,
  getIngestionPipelines,
} from '../../../../../rest/ingestionPipelineAPI';
import { getEntityTypeFromServiceCategory } from '../../../../../utils/ServiceUtils';
import { columnFilterIcon } from '../../../../../utils/TableColumn.util';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import ErrorPlaceHolderIngestion from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import Loader from '../../../../common/Loader/Loader';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';
import { ColumnFilter } from '../../../../Database/ColumnFilter/ColumnFilter.component';
import IngestionListTable from '../IngestionListTable/IngestionListTable';

export const IngestionPipelineList = ({
  serviceName,
  className,
}: {
  serviceName: ServiceCategory | 'testSuites';
  className?: string;
}) => {
  const [pipelines, setPipelines] = useState<Array<IngestionPipeline>>([]);
  const { isAirflowAvailable, isFetchingStatus } = useAirflowStatus();

  const [selectedPipelines, setSelectedPipelines] = useState<
    Array<IngestionPipeline>
  >([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<React.Key>>([]);
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pipelineTypeFilter, setPipelineTypeFilter] =
    useState<PipelineType[]>();

  const pagingInfo = usePaging();

  const { handlePageChange, paging, handlePagingChange, pageSize } = pagingInfo;

  const { t } = useTranslation();

  const typeColumnObj: ColumnsType<IngestionPipeline> = useMemo(
    () => [
      {
        title: t('label.type'),
        dataIndex: 'pipelineType',
        key: 'pipelineType',
        filterDropdown: ColumnFilter,
        filterIcon: columnFilterIcon,
        width: 150,
        filters: map(PipelineType, (value) => ({
          text: startCase(value),
          value,
        })),
        filtered: !isNil(pipelineTypeFilter),
        filteredValue: pipelineTypeFilter,
      },
    ],
    [pipelineTypeFilter]
  );

  const handleBulkRedeploy = useCallback(async () => {
    const selectedPipelines =
      pipelines?.filter(
        (p) =>
          p.fullyQualifiedName &&
          selectedRowKeys.indexOf(p.fullyQualifiedName) > -1
      ) ?? [];

    const promises = (selectedPipelines ?? [])?.map((pipeline) =>
      deployIngestionPipelineById(pipeline.id ?? '')
    );

    setDeploying(true);

    try {
      await Promise.all(promises);

      showSuccessToast(
        `${t('label.pipeline-plural')}  ${t('label.re-deploy')}  ${t(
          'label.successfully-lowercase'
        )}`
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.ingestion-workflow-operation-error', {
          operation: 'updating',
          displayName: '',
        })
      );
    } finally {
      setPipelineTypeFilter(undefined);
      setSelectedRowKeys([]);
      setDeploying(false);
    }
  }, [pipelines, selectedRowKeys]);

  const fetchPipelines = useCallback(
    async ({
      paging,
      pipelineType,
      limit,
    }: {
      paging?: Omit<Paging, 'total'>;
      pipelineType?: PipelineType[];
      limit?: number;
    }) => {
      setLoading(true);
      try {
        const { data, paging: pagingRes } = await getIngestionPipelines({
          arrQueryFields: [TabSpecificField.OWNERS],
          serviceType:
            serviceName === 'testSuites'
              ? EntityType.TEST_SUITE
              : getEntityTypeFromServiceCategory(serviceName),
          paging,
          pipelineType,
          limit,
        });

        setPipelines(data);
        handlePagingChange(pagingRes);
      } catch {
        // Error
      } finally {
        setLoading(false);
      }
    },
    [serviceName]
  );

  const handlePipelinePageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        fetchPipelines({
          paging: { [cursorType]: paging[cursorType] },
          limit: pageSize,
        });
        handlePageChange(currentPage);
      }
    },
    [fetchPipelines, paging, handlePageChange]
  );

  useEffect(() => {
    isAirflowAvailable && fetchPipelines({ limit: pageSize });
  }, [serviceName, isAirflowAvailable, pageSize]);

  const handleTableChange: TableProps<IngestionPipeline>['onChange'] =
    useCallback(
      (
        _pagination: TablePaginationConfig,
        filters: Record<string, FilterValue | null>
      ) => {
        const pipelineType = filters.pipelineType as PipelineType[];
        setPipelineTypeFilter(pipelineType);
        fetchPipelines({
          pipelineType,
          limit: pageSize,
        });
      },
      [fetchPipelines]
    );

  const handleRowChange = useCallback(
    (selectedRowKeys: React.Key[], selectedRows: IngestionPipeline[]) => {
      setSelectedPipelines(selectedRows);
      setSelectedRowKeys(selectedRowKeys);
    },
    []
  );

  const rowSelection: TableRowSelection<IngestionPipeline> = useMemo(
    () => ({
      type: 'checkbox',
      onChange: handleRowChange,
      getCheckboxProps: (record: IngestionPipeline) => ({
        name: record.fullyQualifiedName,
      }),
      selectedRowKeys,
    }),
    [handleRowChange, selectedRowKeys]
  );

  if (isFetchingStatus) {
    return <Loader />;
  }

  if (!isAirflowAvailable) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <Row className={className} gutter={[16, 16]}>
      <Col className="text-right" span={24}>
        <Button
          data-testid="bulk-re-deploy-button"
          disabled={selectedPipelines?.length === 0}
          loading={deploying}
          type="primary"
          onClick={handleBulkRedeploy}>
          {t('label.re-deploy')}
        </Button>
      </Col>
      <Col span={24}>
        <IngestionListTable
          enableActions={false}
          extraTableProps={{
            rowSelection,
            onChange: handleTableChange,
          }}
          ingestionData={pipelines}
          ingestionPagingInfo={pagingInfo}
          isLoading={loading}
          pipelineTypeColumnObj={typeColumnObj}
          serviceName={serviceName}
          onPageChange={handlePipelinePageChange}
        />
      </Col>
    </Row>
  );
};
