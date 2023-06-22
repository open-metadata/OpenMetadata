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

import { Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import { isEmpty } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTypeByFQN } from 'rest/metadataTypeAPI';
import { getEntityName } from 'utils/EntityUtils';
import { CustomProperty, Type } from '../../../generated/entity/type';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../error-with-placeholder/ErrorPlaceHolder';
import { CustomPropertyProps } from './CustomPropertyTable.interface';
import { PropertyValue } from './PropertyValue';

export const CustomPropertyTable: FC<CustomPropertyProps> = ({
  entityDetails,
  handleExtensionUpdate,
  entityType,
  hasEditAccess,
  className,
}) => {
  const { t } = useTranslation();
  const [entityTypeDetail, setEntityTypeDetail] = useState<Type>({} as Type);
  const [entityTypeDetailLoading, setEntityTypeDetailLoading] =
    useState<boolean>(false);

  const fetchTypeDetail = async () => {
    setEntityTypeDetailLoading(true);
    try {
      const res = await getTypeByFQN(entityType);

      setEntityTypeDetail(res);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setEntityTypeDetailLoading(false);
    }
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
        render: (_, record) => getEntityName(record),
      },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
        width: '50%',
        render: (_, record) => (
          <PropertyValue
            extension={entityDetails.extension}
            hasEditPermissions={hasEditAccess}
            propertyName={record.name}
            propertyType={record.propertyType}
            onExtensionUpdate={onExtensionUpdate}
          />
        ),
      },
    ];
  }, [entityDetails.extension, hasEditAccess]);

  useEffect(() => {
    fetchTypeDetail();
  }, []);

  if (entityTypeDetailLoading) {
    return <Loader />;
  }

  return (
    <>
      {isEmpty(entityTypeDetail.customProperties) ? (
        <ErrorPlaceHolder className={className}>
          <Typography.Paragraph>
            {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
              entity: t('label.custom-property-plural'),
            })}
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      ) : (
        <Table
          bordered
          className="m-md"
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
