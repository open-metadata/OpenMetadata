/*
 *  Copyright 2026 Collate.
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
import { AxiosError } from 'axios';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DEFAULT_DOMAIN_VALUE } from '../../constants/constants';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Table } from '../../generated/entity/data/table';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import { useDomainStore } from '../../hooks/useDomainStore';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentStatusFromSearch,
  TestCaseIncidentStatusParams,
} from '../../rest/incidentManagerAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';

export interface UseIncidentListProps {
  filters: TestCaseIncidentStatusParams;
  setUsers: Dispatch<SetStateAction<{ options: Option[] }>>;
  commonTestCasePermission?: OperationPermission;
  tableDetails?: Table;
}

/**
 * Owns the DATA concern: the incident rows, their loading flag, the paging bag
 * and the fetch pipeline. The driving fetch effect stays co-located with
 * {@link fetchTestCaseIncidents} and the paging handler so the fetch is issued
 * from a single place (no double-fetch). The assignee-option derivation lives
 * inside the fetch and writes back through the injected {@link setUsers}. Filter
 * state, the shared user setter and the current permission are injected.
 */
export const useIncidentList = ({
  filters,
  setUsers,
  commonTestCasePermission,
  tableDetails,
}: UseIncidentListProps) => {
  const { activeDomain } = useDomainStore();
  const [testCaseListData, setTestCaseListData] =
    useState<TestCaseIncidentStatusData>({
      data: [],
      isLoading: true,
    });

  const {
    paging,
    pageSize,
    currentPage,
    showPagination,
    handlePageChange,
    handlePagingChange,
    handlePageSizeChange,
  } = usePaging();

  const fetchTestCaseIncidents = useCallback(
    async (params: TestCaseIncidentStatusParams) => {
      setTestCaseListData((prev) => ({ ...prev, isLoading: true }));
      try {
        const { data, paging } = await getListTestCaseIncidentStatusFromSearch({
          limit: pageSize,
          offset: params.offset ?? 0,
          latest: true,
          include: tableDetails?.deleted ? Include.Deleted : Include.NonDeleted,
          originEntityFQN: tableDetails?.fullyQualifiedName,
          domain:
            activeDomain === DEFAULT_DOMAIN_VALUE ? undefined : activeDomain,
          ...params,
        });
        const assigneeOptions = data.reduce((acc, curr) => {
          const assignee = curr.testCaseResolutionStatusDetails?.assignee;
          const isExist = acc.some((item) => item.value === assignee?.name);

          if (assignee && !isExist) {
            acc.push({
              label: getEntityName(assignee),
              value: assignee.name ?? assignee.fullyQualifiedName ?? '',
              type: assignee.type,
              name: assignee.name,
            });
          }

          return acc;
        }, [] as Option[]);

        setUsers((pre) => ({
          ...pre,
          options: assigneeOptions,
        }));
        setTestCaseListData((prev) => ({ ...prev, data: data }));
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [
      pageSize,
      setTestCaseListData,
      activeDomain,
      tableDetails?.deleted,
      tableDetails?.fullyQualifiedName,
    ]
  );

  const handlePagingClick = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchTestCaseIncidents({
        ...filters,
        offset: (currentPage - 1) * pageSize,
      });
      handlePageChange(currentPage);
    },
    [fetchTestCaseIncidents, filters, pageSize, handlePageChange]
  );

  const pagingData = useMemo(
    () => ({
      paging,
      currentPage,
      pagingHandler: handlePagingClick,
      pageSize,
      onShowSizeChange: handlePageSizeChange,
      isNumberBased: true,
    }),
    [paging, currentPage, handlePagingClick, pageSize, handlePageSizeChange]
  );

  useEffect(() => {
    if (
      commonTestCasePermission?.ViewAll ||
      commonTestCasePermission?.ViewBasic
    ) {
      fetchTestCaseIncidents(filters);
    } else {
      setTestCaseListData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [
    commonTestCasePermission,
    pageSize,
    filters,
    activeDomain,
    tableDetails?.deleted,
    tableDetails?.fullyQualifiedName,
  ]);

  return {
    testCaseListData,
    setTestCaseListData,
    fetchTestCaseIncidents,
    handlePagingClick,
    pagingData,
    showPagination,
  };
};
