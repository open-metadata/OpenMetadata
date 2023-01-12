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
import AddDataQualityTestV1 from 'components/AddDataQualityTest/AddDataQualityTestV1';
import PageContainerV1 from 'components/containers/PageContainerV1';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { Table } from '../../generated/entity/data/table';
import { getTableFQNFromColumnFQN } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddDataQualityTestPage = () => {
  const { entityTypeFQN, dashboardType } = useParams<Record<string, string>>();
  const isColumnFqn = dashboardType === ProfilerDashboardType.COLUMN;
  const [table, setTable] = useState({} as Table);

  const fetchTableData = async () => {
    try {
      const fqn = isColumnFqn
        ? getTableFQNFromColumnFQN(entityTypeFQN)
        : entityTypeFQN;
      const table = await getTableDetailsByFQN(fqn, '');
      setTable(table);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [entityTypeFQN]);

  return (
    <PageContainerV1>
      <div className="self-center">
        <AddDataQualityTestV1 table={table} />
      </div>
    </PageContainerV1>
  );
};

export default AddDataQualityTestPage;
