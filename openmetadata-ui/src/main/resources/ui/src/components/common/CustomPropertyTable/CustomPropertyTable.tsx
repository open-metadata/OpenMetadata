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
import { EntityField } from 'constants/Feeds.constants';
import { ChangeDescription } from 'generated/tests/testCase';
import { isEmpty, isUndefined } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTypeByFQN } from 'rest/metadataTypeAPI';
import { getEntityName } from 'utils/EntityUtils';
import {
  getChangedEntityNewValue,
  getDiffByFieldName,
  getUpdatedExtensionDiffFields,
} from 'utils/EntityVersionUtils';
import { CustomProperty, Type } from '../../../generated/entity/type';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../error-with-placeholder/ErrorPlaceHolder';
import {
  CustomPropertyProps,
  EntityDetails,
} from './CustomPropertyTable.interface';
import { PropertyValue } from './PropertyValue';

export const CustomPropertyTable: FC<CustomPropertyProps> = ({
  entityDetails,
  handleExtensionUpdate,
  entityType,
  hasEditAccess,
  className,
  isVersionView,
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
    if (!isUndefined(handleExtensionUpdate)) {
      await handleExtensionUpdate({
        ...entityDetails,
        extension: updatedExtension,
      });
    }
  };

  const extensionObject: {
    extensionObject: EntityDetails['extension'];
    addedKeysList?: string[];
  } = useMemo(() => {
    if (isVersionView) {
      const changeDescription = entityDetails.changeDescription;
      const extensionDiff = getDiffByFieldName(
        EntityField.EXTENSION,
        changeDescription as ChangeDescription
      );

      const newValues = getChangedEntityNewValue(extensionDiff);

      if (extensionDiff.added) {
        const addedFields = JSON.parse(newValues ? newValues : [])[0];
        if (addedFields) {
          return {
            extensionObject: entityDetails.extension,
            addedKeysList: Object.keys(addedFields),
          };
        }
      }

      if (extensionDiff.updated) {
        return getUpdatedExtensionDiffFields(entityDetails, extensionDiff);
      }
    }

    return { extensionObject: entityDetails.extension };
  }, [isVersionView, entityDetails]);

  const tableColumn: ColumnsType<CustomProperty> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: '50%',
        render: (_, record) => getEntityName(record),
      },
      {
        title: t('label.value'),
        dataIndex: 'value',
        key: 'value',
        width: '50%',
        render: (_, record) => (
          <PropertyValue
            extension={extensionObject.extensionObject}
            hasEditPermissions={hasEditAccess}
            isVersionView={isVersionView}
            propertyName={record.name}
            propertyType={record.propertyType}
            versionDataKeys={extensionObject.addedKeysList}
            onExtensionUpdate={onExtensionUpdate}
          />
        ),
      },
    ];
  }, [
    entityDetails.extension,
    hasEditAccess,
    extensionObject,
    isVersionView,
    onExtensionUpdate,
  ]);

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
