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

import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { DateRangeObject } from 'components/ProfilerDashboard/component/TestSummary';
import ProfilerDashboard from 'components/ProfilerDashboard/ProfilerDashboard';
import { ProfilerDashboardTab } from 'components/ProfilerDashboard/profilerDashboard.interface';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  getColumnProfilerList,
  getTableDetailsByFQN,
  patchTableDetails,
} from 'rest/tableAPI';
import { getListTestCase, ListTestCaseParams } from 'rest/testAPI';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { ColumnProfile, Table } from '../../generated/entity/data/table';
import { TestCase } from '../../generated/tests/testCase';
import { Include } from '../../generated/type/include';
import jsonData from '../../jsons/en';
import {
  getNameFromFQN,
  getTableFQNFromColumnFQN,
} from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ProfilerDashboardPage = () => {
  const { t } = useTranslation();
  const { entityTypeFQN, dashboardType, tab } = useParams<{
    entityTypeFQN: string;
    dashboardType: ProfilerDashboardType;
    tab: ProfilerDashboardTab;
  }>();
  const decodedEntityFQN = getDecodedFqn(entityTypeFQN);
  const isColumnView = dashboardType === ProfilerDashboardType.COLUMN;
  const [table, setTable] = useState<Table>({} as Table);
  const [profilerData, setProfilerData] = useState<ColumnProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [error, setError] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = async () => {
    try {
      const tablePermission = await getEntityPermission(
        ResourceEntity.TABLE,
        table.id
      );

      setTablePermissions(tablePermission);
    } catch (error) {
      showErrorToast(
        jsonData['api-error-messages']['fetch-entity-permissions-error']
      );
    }
  };

  const fetchProfilerData = async (
    fqn: string,
    dateRangeObject?: DateRangeObject
  ) => {
    try {
      const { data } = await getColumnProfilerList(fqn, dateRangeObject);
      setProfilerData(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestCases = async (fqn: string, params?: ListTestCaseParams) => {
    setIsTestCaseLoading(true);
    try {
      const { data } = await getListTestCase({
        fields: 'testDefinition,testCaseResult,testSuite',
        entityLink: fqn,
        includeAllTests: !isColumnView,
        limit: API_RES_MAX_SIZE,
        ...params,
      });
      setTestCases(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-column-test-error']
      );
    } finally {
      setIsLoading(false);
      setIsTestCaseLoading(false);
    }
  };

  const handleTestCaseUpdate = (deleted = false) => {
    fetchTestCases(generateEntityLink(decodedEntityFQN, isColumnView), {
      include: deleted ? Include.Deleted : Include.NonDeleted,
    });
  };

  const fetchTableEntity = async () => {
    try {
      const fqn = isColumnView
        ? getTableFQNFromColumnFQN(entityTypeFQN)
        : entityTypeFQN;

      const field = `tags, usageSummary, owner, followers${
        isColumnView ? ', profile' : ''
      }`;
      const data = await getTableDetailsByFQN(fqn, field);
      setTable(data ?? ({} as Table));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-table-details-error']
      );
      setIsLoading(false);
      setError(true);
    }
  };

  const updateTableHandler = async (updatedTable: Table) => {
    const jsonPatch = compare(table, updatedTable);

    try {
      const tableRes = await patchTableDetails(table.id, jsonPatch);
      setTable(tableRes);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-entity-error']
      );
    }
  };

  const getProfilerDashboard = (permission: OperationPermission) => {
    if (
      tab === ProfilerDashboardTab.DATA_QUALITY &&
      (permission.ViewAll || permission.ViewBasic || permission.ViewTests)
    ) {
      fetchTestCases(generateEntityLink(decodedEntityFQN));
    } else if (
      permission.ViewAll ||
      permission.ViewBasic ||
      permission.ViewDataProfile
    ) {
      fetchProfilerData(entityTypeFQN);
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (decodedEntityFQN) {
      fetchTableEntity();
    } else {
      setIsLoading(false);
      setError(true);
    }
  }, [decodedEntityFQN]);

  useEffect(() => {
    if (!isEmpty(table)) {
      fetchResourcePermission();
    }
  }, [table]);

  useEffect(() => {
    if (!isEmpty(table)) {
      getProfilerDashboard(tablePermissions);
    }
  }, [table, tablePermissions]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorPlaceHolder>
        <p className="text-center">
          {t('label.no-data-found')}
          {decodedEntityFQN
            ? `for column ${getNameFromFQN(decodedEntityFQN)}`
            : ''}
        </p>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageContainerV1 className="p-y-md">
      <ProfilerDashboard
        fetchProfilerData={fetchProfilerData}
        fetchTestCases={fetchTestCases}
        isTestCaseLoading={isTestCaseLoading}
        profilerData={profilerData}
        table={table}
        testCases={testCases}
        onTableChange={updateTableHandler}
        onTestCaseUpdate={handleTestCaseUpdate}
      />
    </PageContainerV1>
  );
};

export default ProfilerDashboardPage;
