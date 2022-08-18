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

import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getTableDetailsByFQN,
  getTableProfilesList,
  patchTableDetails,
} from '../../axiosAPIs/tableAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import ProfilerDashboard from '../../components/ProfilerDashboard/ProfilerDashboard';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { Table, TableProfile } from '../../generated/entity/data/table';
import jsonData from '../../jsons/en';
import {
  getNameFromFQN,
  getTableFQNFromColumnFQN,
} from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ProfilerDashboardPage = () => {
  const { entityTypeFQN } = useParams<Record<string, string>>();
  const [table, setTable] = useState<Table>({} as Table);
  const [profilerData, setProfilerData] = useState<TableProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchProfilerData = async (tableId: string, days = 3) => {
    try {
      const startTs = moment().subtract(days, 'days').unix();

      const data = await getTableProfilesList(tableId, {
        startTs: startTs,
        limit: API_RES_MAX_SIZE,
      });
      setProfilerData(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTableEntity = async (fqn: string) => {
    try {
      getTableFQNFromColumnFQN(fqn);
      const data = await getTableDetailsByFQN(
        getTableFQNFromColumnFQN(fqn),
        'tags, usageSummary, owner, followers'
      );
      setTable(data ?? ({} as Table));
      fetchProfilerData(data.id);
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

  useEffect(() => {
    if (entityTypeFQN) {
      fetchTableEntity(entityTypeFQN);
    } else {
      setIsLoading(false);
      setError(true);
    }
  }, [entityTypeFQN]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorPlaceHolder>
        <p className="tw-text-center">
          No data found{' '}
          {entityTypeFQN ? `for column ${getNameFromFQN(entityTypeFQN)}` : ''}
        </p>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageContainerV1 className="tw-py-4">
      <ProfilerDashboard
        fetchProfilerData={fetchProfilerData}
        profilerData={profilerData}
        table={table}
        onTableChange={updateTableHandler}
      />
    </PageContainerV1>
  );
};

export default ProfilerDashboardPage;
