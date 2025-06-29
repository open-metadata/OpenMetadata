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
import { useEffect, useState } from 'react';
import Loader from '../../components/common/Loader/Loader';
import AddDataQualityTestV1 from '../../components/DataQuality/AddDataQualityTest/AddDataQualityTestV1';
import { TabSpecificField } from '../../enums/entity.enum';
import { Table } from '../../generated/entity/data/table';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useFqn } from '../../hooks/useFqn';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { showErrorToast } from '../../utils/ToastUtils';

const AddDataQualityTestPage = () => {
  const { fqn } = useFqn();
  const [table, setTable] = useState({} as Table);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      const table = await getTableDetailsByFQN(fqn, {
        fields: [
          TabSpecificField.TESTSUITE,
          TabSpecificField.CUSTOM_METRICS,
          TabSpecificField.COLUMNS,
        ],
      });
      setTable(table);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="self-center" data-testid="add-data-quality-test-page">
      <AddDataQualityTestV1 table={table} />
    </div>
  );
};

export default withPageLayout(AddDataQualityTestPage);
