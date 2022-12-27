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

import { Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { getTypeByFQN } from '../../../axiosAPIs/metadataTypeAPI';
import { CustomProperty, Type } from '../../../generated/entity/type';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../error-with-placeholder/ErrorPlaceHolder';
import { CustomPropertyProps } from './CustomPropertyTable.interface';
import { PropertyValue } from './PropertyValue';

export const CustomPropertyTable: FC<CustomPropertyProps> = ({
  entityDetails,
  handleExtensionUpdate,
  entityType,
}) => {
  const [entityTypeDetail, setEntityTypeDetail] = useState<Type>({} as Type);

  const fetchTypeDetail = () => {
    getTypeByFQN(entityType)
      .then((res) => {
        setEntityTypeDetail(res);
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const onExtensionUpdate = async (
    updatedExtension: CustomPropertyProps['entityDetails']['extension']
  ) => {
    await handleExtensionUpdate({
      ...entityDetails,
      extension: updatedExtension,
    });
  };

  const tableColumn: ColumnsType<CustomProperty> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: '50%',
      },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
        width: '50%',
        render: (_, record) => (
          <PropertyValue
            extension={entityDetails.extension}
            propertyName={record.name}
            propertyType={record.propertyType}
            onExtensionUpdate={onExtensionUpdate}
          />
        ),
      },
    ];
  }, [entityDetails.extension]);

  useEffect(() => {
    fetchTypeDetail();
  }, []);

  return (
    <>
      {isEmpty(entityTypeDetail.customProperties) ? (
        <ErrorPlaceHolder heading="Custom Properties" />
      ) : (
        <Table
          bordered
          columns={tableColumn}
          data-testid="custom-properties-table"
          dataSource={entityTypeDetail.customProperties || []}
          pagination={false}
          rowKey="name"
          size="small"
        />
      )}
    </>
  );
};
