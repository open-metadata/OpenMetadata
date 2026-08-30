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
import { Button, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import capitalize from 'lodash/capitalize';
import isNil from 'lodash/isNil';
import map from 'lodash/map';
import startCase from 'lodash/startCase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_PAGING_VALUE } from '../../../../../constants/constants';
import { SORT_FIELD_DISPLAY_NAME } from '../../../../../constants/Ingestions.constant';
import { useAirflowStatus } from '../../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { SORT_ORDER } from '../../../../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../../../../enums/entity.enum';
import { ServiceCategory } from '../../../../../enums/service.enum';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../../../../generated/type/paging';
import { usePaging } from '../../../../../hooks/paging/usePaging';
import { useTableFilters } from '../../../../../hooks/useTableFilters';
import {
  deployIngestionPipelineById,
  getIngestionPipelines,
} from '../../../../../rest/ingestionPipelineAPI';
import { getEntityTypeFromServiceCategory } from '../../../../../utils/ServicePureUtils';
import { columnFilterIcon } from '../../../../../utils/TableColumn.util';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import AirflowMessageBanner from '../../../../common/AirflowMessageBanner/AirflowMessageBanner';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';
import {
  ColumnsType,
  TableProps,
  TableRowSelection,
} from '../../../../common/Table/Table.interface';
import { ColumnFilter } from '../../../../Database/ColumnFilter/ColumnFilter.component';
import IngestionListTable from '../IngestionListTable/IngestionListTable';

/**
 * The listing endpoint rejects any `sortOrder` other than `asc`/`desc`, so a value that did not come
 * from the Name column — a hand-edited URL, or a repeated query param that `qs` parses as an array —
 * falls back to the unsorted listing instead of being forwarded and 400ing.
 */
const toSortOrder = (value?: string): SORT_ORDER | undefined =>
  Object.values(SORT_ORDER).find((order) => order === value);

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

  // The sort order lives in the URL rather than in component state because the cursor it produces
  // already does: usePaging persists cursorType/cursorValue as query params, and a sorted cursor is
  // a (displayNameSort, id) tuple that only the sorted listing can read. Keeping the order in state
  // meant a reload of page 2 replayed that cursor down the default name-ordered path, which matches
  // no row and renders an empty page. Same reason back/forward and a shared link now work.
  const { filters: sortFilters, setFilters: setSortFilters } = useTableFilters<{
    sortOrder?: string;
  }>({ sortOrder: undefined });

  const sortOrder = useMemo(
    () => toSortOrder(sortFilters.sortOrder),
    [sortFilters.sortOrder]
  );

  const pagingInfo = usePaging();

  const {
    handlePageChange,
    paging,
    handlePagingChange,
    pageSize,
    pagingCursor,
  } = pagingInfo;

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
          p.fullyQualifiedName && selectedRowKeys.includes(p.fullyQualifiedName)
      ) ?? [];

    const promises = (selectedPipelines ?? [])?.map((pipeline) =>
      deployIngestionPipelineById(pipeline.id ?? '')
    );

    setDeploying(true);

    try {
      await Promise.all(promises);

      showSuccessToast(
        `${t('label.pipeline-plural')} ${t('label.re-deploy')} ${capitalize(
          t('label.successfully-lowercase')
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
      sortOrder,
    }: {
      paging?: Omit<Paging, 'total'>;
      pipelineType?: PipelineType[];
      limit?: number;
      sortOrder?: SORT_ORDER;
    }) => {
      setLoading(true);
      try {
        const { data, paging: pagingRes } = await getIngestionPipelines({
          arrQueryFields: [
            TabSpecificField.OWNERS,
            TabSpecificField.PIPELINE_STATUSES,
          ],
          serviceType:
            serviceName === 'testSuites'
              ? EntityType.TEST_SUITE
              : getEntityTypeFromServiceCategory(serviceName),
          paging,
          pipelineType,
          limit,
          ...(sortOrder
            ? { sortField: SORT_FIELD_DISPLAY_NAME, sortOrder }
            : {}),
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

  // A new sort order or filter invalidates the cursor the current page was reached with, so the
  // cursor has to be cleared explicitly — handlePageChange only rewrites the ones it is given.
  const resetToFirstPage = useCallback(() => {
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
  }, [handlePageChange]);

  const handlePipelinePageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        handlePageChange(
          currentPage,
          { cursorType, cursorValue: paging[cursorType] },
          pageSize
        );
      }
    },
    [paging, handlePageChange, pageSize]
  );

  // Single fetch path. Every input the request depends on — page size, cursor, sort order and the
  // pipeline type filter — is state this effect reads, so a change to any one of them produces
  // exactly one request carrying all of the others. Handlers below only move that state; they must
  // not fetch as well, or a sort would race a request that has forgotten the active filter.
  //
  // Deliberately not gated on the airflow status: pipelines are OpenMetadata entities, so they list
  // whether or not the pipeline service answers. Only re-deploying them needs that service — see the
  // button below.
  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    fetchPipelines({
      paging:
        cursorType && cursorValue ? { [cursorType]: cursorValue } : undefined,
      pipelineType: pipelineTypeFilter,
      limit: pageSize,
      sortOrder,
    });
  }, [
    fetchPipelines,
    serviceName,
    pageSize,
    pagingCursor,
    sortOrder,
    pipelineTypeFilter,
  ]);

  // Params are inferred from the handler type rather than annotated, so the sorter/extra types do
  // not have to be imported from antd — tw-guard blocks new antd specifiers.
  const handleTableChange = useCallback<
    NonNullable<TableProps<IngestionPipeline>['onChange']>
  >(
    (_pagination, filters, _sorter, extra) => {
      // AntD reports sort/filter/pagination through one callback. Reading `filters` on a sort
      // action saw pipelineType as undefined and silently cleared the active filter.
      if (extra.action !== 'filter') {
        return;
      }

      setPipelineTypeFilter(filters.pipelineType as PipelineType[]);
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const handleSortChange = useCallback(
    (updatedSortOrder?: SORT_ORDER) => {
      // Written before resetToFirstPage, not after: both merge into the same query string off the
      // live URL, and the cursor must be dropped by the later of the two writes.
      setSortFilters({ sortOrder: updatedSortOrder ?? null });
      resetToFirstPage();
    },
    [resetToFirstPage, setSortFilters]
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

  return (
    <Row className={className} gutter={[16, 16]}>
      <Col span={24}>
        {/* Says why re-deploy is unavailable; the list itself stays readable. */}
        <AirflowMessageBanner
          unreachableFallbackMessage={t(
            'message.pipeline-service-unreachable-agent-actions'
          )}
        />
      </Col>
      <Col className="text-right" span={24}>
        <Button
          data-testid="bulk-re-deploy-button"
          disabled={
            selectedPipelines?.length === 0 ||
            isFetchingStatus ||
            !isAirflowAvailable
          }
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
          sortOrder={sortOrder}
          onPageChange={handlePipelinePageChange}
          onSortChange={handleSortChange}
        />
      </Col>
    </Row>
  );
};
