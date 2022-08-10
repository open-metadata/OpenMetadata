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
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getTableDetailsByFQN,
  getTableProfilesList,
} from '../../axiosAPIs/tableAPI';
import { Table, TableProfile } from '../../generated/entity/data/table';
import jsonData from '../../jsons/en';
import { getTableFQNFromColumnFQN } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ProfilerDashboardPage = () => {
  const { entityTypeFQN } = useParams<Record<string, string>>();
  const [table, setTable] = useState<Table>({} as Table);
  const [profilerData, setProfilerData] = useState<TableProfile[]>([]);

  const fetchProfilerData = async (tableId: string) => {
    try {
      const data = await getTableProfilesList(tableId);
      setProfilerData(data.data || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTableEntity = async (fqn: string) => {
    try {
      getTableFQNFromColumnFQN(fqn);
      const data = await getTableDetailsByFQN(
        getTableFQNFromColumnFQN(fqn),
        ''
      );
      setTable(data ?? ({} as Table));
      fetchProfilerData(data.id);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-table-details-error']
      );
    }
  };

  useEffect(() => {
    if (entityTypeFQN) {
      fetchTableEntity(entityTypeFQN);
    }
  }, [entityTypeFQN]);

  return <div>ProfilerDashboardPage</div>;
};

export default ProfilerDashboardPage;
