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
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AddDataQualityTestV1 from '../../components/AddDataQualityTest/AddDataQualityTestV1';
import Loader from '../../components/Loader/Loader';
import { Table } from '../../generated/entity/data/table';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { showErrorToast } from '../../utils/ToastUtils';

const AddDataQualityTestPage = () => {
  const { entityTypeFQN } = useParams<{ entityTypeFQN: string }>();
  const [table, setTable] = useState({} as Table);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      const table = await getTableDetailsByFQN(entityTypeFQN, 'testSuite');
      setTable(table);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [entityTypeFQN]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="self-center">
      <AddDataQualityTestV1 table={table} />
    </div>
  );
};

export default AddDataQualityTestPage;
