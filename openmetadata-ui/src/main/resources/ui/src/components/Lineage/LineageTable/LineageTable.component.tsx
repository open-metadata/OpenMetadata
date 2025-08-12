/*
 *  Copyright 2025 Collate.
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
import { ColumnsType } from 'antd/lib/table';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { readString } from 'react-papaparse';
import { ExportTypes } from '../../../constants/Export.constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { useFqn } from '../../../hooks/useFqn';
import { getLineageTableConfig } from '../../../utils/EntityLineageUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import Table from '../../common/Table/Table';
import { useEntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import './lineage-table.less';

const LineageTable = () => {
  const { fqn } = useFqn();
  const { exportLineageData } = useLineageProvider();
  const { triggerExportForBulkEdit, csvExportData, clearCSVExportData } =
    useEntityExportModalProvider();
  const [tableConfig, setTableConfig] = useState<{
    isLoading: boolean;
    columns: ColumnsType<string>;
    dataSource: Record<string, string>[];
  }>({
    isLoading: true,
    columns: [],
    dataSource: [],
  });

  const onCSVReadComplete = useCallback((results: { data: string[][] }) => {
    const { columns, dataSource } = getLineageTableConfig(
      results.data as string[][]
    );

    setTableConfig({
      isLoading: false,
      columns,
      dataSource,
    });
  }, []);

  useEffect(() => {
    setTableConfig({
      isLoading: true,
      columns: [],
      dataSource: [],
    });

    triggerExportForBulkEdit({
      name: fqn,
      onExport: exportLineageData,
      exportTypes: [ExportTypes.CSV],
      hideExportModal: true,
    });
  }, []);

  useEffect(() => {
    if (csvExportData) {
      readString(csvExportData, {
        worker: true,
        skipEmptyLines: true,
        complete: onCSVReadComplete,
      });
    }
  }, [csvExportData]);

  useEffect(() => {
    // clear the csvExportData data from the state
    return () => {
      clearCSVExportData();
    };
  }, []);

  if (tableConfig.isLoading) {
    return <Loader />;
  }

  if (isEmpty(tableConfig.columns)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <Table
      {...tableConfig}
      containerClassName="m-x-sm m-y-md align-table-filter-left"
      data-testid="lineage-table"
      pagination={false}
      rowKey="fullyQualifiedName"
      scroll={TABLE_SCROLL_VALUE}
      size="middle"
    />
  );
};

export default LineageTable;
