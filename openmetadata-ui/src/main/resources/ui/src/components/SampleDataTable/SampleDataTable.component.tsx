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

import { Space, Table as AntdTable, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useTourProvider } from 'components/TourProvider/TourProvider';
import { mockDatasetData } from 'constants/mockTourData.constants';
import { t } from 'i18next';
import { isEmpty, lowerCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { getSampleDataByTableId } from 'rest/tableAPI';
import { WORKFLOWS_PROFILER_DOCS } from '../../constants/docs.constants';
import { Table } from '../../generated/entity/data/table';
import { withLoader } from '../../hoc/withLoader';
import { Transi18next } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../Loader/Loader';
import { RowData } from './RowData';
import {
  SampleData,
  SampleDataProps,
  SampleDataType,
} from './sample.interface';
import './SampleDataTable.style.less';
const SampleDataTable = ({ isTableDeleted, tableId }: SampleDataProps) => {
  const { isTourPage } = useTourProvider();

  const [sampleData, setSampleData] = useState<SampleData>();
  const [isLoading, setIsLoading] = useState(true);

  const getSampleDataWithType = (table: Table) => {
    const { sampleData, columns } = table;
    const updatedColumns = sampleData?.columns?.map((column) => {
      const matchedColumn = columns.find((col) => col.name === column);

      return {
        name: column,
        dataType: matchedColumn?.dataType ?? '',
        title: (
          <Space direction="vertical" size={0}>
            <Typography.Text> {column}</Typography.Text>
            <Typography.Text className="text-grey-muted text-xs font-normal">{`(${lowerCase(
              matchedColumn?.dataType ?? ''
            )})`}</Typography.Text>
          </Space>
        ),
        dataIndex: column,
        key: column,
        accessor: column,
        render: (data: SampleDataType) => <RowData data={data} />,
      };
    });

    const data = (sampleData?.rows ?? []).map((item) => {
      const dataObject: Record<string, SampleDataType> = {};
      (sampleData?.columns ?? []).forEach((col, index) => {
        dataObject[col] = item[index];
      });

      return dataObject;
    });

    return {
      columns: updatedColumns,
      rows: data,
    };
  };

  const fetchSampleData = async () => {
    try {
      const tableData = await getSampleDataByTableId(tableId);
      setSampleData(getSampleDataWithType(tableData));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    if (!isTableDeleted && tableId && !isTourPage) {
      fetchSampleData();
    } else {
      setIsLoading(false);
    }
    if (isTourPage) {
      setSampleData(
        getSampleDataWithType({
          columns: mockDatasetData.tableDetails.columns,
          sampleData: mockDatasetData.sampleData,
        } as unknown as Table)
      );
    }
  }, [tableId]);

  if (isLoading) {
    return <Loader />;
  }

  if (isEmpty(sampleData?.rows) && isEmpty(sampleData?.columns)) {
    return (
      <ErrorPlaceHolder>
        <Typography.Paragraph>
          <Transi18next
            i18nKey="message.view-sample-data-entity"
            renderElement={
              <a
                href={WORKFLOWS_PROFILER_DOCS}
                rel="noreferrer"
                style={{ color: '#1890ff' }}
                target="_blank"
              />
            }
            values={{
              entity: t('label.profiler-ingestion'),
            }}
          />
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <div
      className={classNames('m-md', {
        'h-70vh overflow-hidden': isTourPage,
      })}
      data-testid="sample-data"
      id="sampleDataDetails">
      <AntdTable
        bordered
        columns={sampleData?.columns}
        data-testid="sample-data-table"
        dataSource={sampleData?.rows}
        pagination={false}
        rowKey="name"
        scroll={{ x: true }}
        size="small"
      />
    </div>
  );
};

export default withLoader<SampleDataProps>(SampleDataTable);
