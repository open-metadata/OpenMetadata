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

import { Skeleton, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { EntityField } from '../../../constants/Feeds.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  ChangeDescription,
  CustomProperty,
  Type,
} from '../../../generated/entity/type';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { getEntityExtentionDetailsFromEntityType } from '../../../utils/CustomProperties/CustomProperty.utils';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getChangedEntityNewValue,
  getDiffByFieldName,
  getUpdatedExtensionDiffFields,
} from '../../../utils/EntityVersionUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../PermissionProvider/PermissionProvider.interface';
import ErrorPlaceHolder from '../error-with-placeholder/ErrorPlaceHolder';
import Table from '../Table/Table';
import {
  CustomPropertyProps,
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from './CustomPropertyTable.interface';
import { ExtensionTable } from './ExtensionTable';
import { PropertyValue } from './PropertyValue';

export const CustomPropertyTable = <T extends ExtentionEntitiesKeys>({
  handleExtensionUpdate,
  entityType,
  hasEditAccess,
  className,
  isVersionView,
  hasPermission,
  entityDetails,
}: CustomPropertyProps<T>) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [extentionDetails, setExtentionDetails] =
    useState<ExtentionEntities[T]>();
  const [entityTypeDetail, setEntityTypeDetail] = useState<Type>({} as Type);
  const [entityTypeDetailLoading, setEntityTypeDetailLoading] =
    useState<boolean>(false);
  const { fqn } = useParams<{ fqn: string; tab: string; version: string }>();

  const fetchExtentiondetails = async () => {
    const response = await getEntityExtentionDetailsFromEntityType<T>(
      entityType,
      fqn
    );

    setExtentionDetails(response as ExtentionEntities[T]);
  };

  useEffect(() => {
    fetchExtentiondetails();
  }, [fqn]);

  const [typePermission, setPermission] = useState<OperationPermission>();
  const versionDetails = entityDetails ?? extentionDetails;

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

  const fetchResourcePermission = async (entityType: EntityType) => {
    setEntityTypeDetailLoading(true);
    try {
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.TYPE,
        entityType
      );

      setPermission(permission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    } finally {
      setEntityTypeDetailLoading(false);
    }
  };

  const onExtensionUpdate = useCallback(
    async (updatedExtension: ExtentionEntities[T]) => {
      if (!isUndefined(handleExtensionUpdate) && versionDetails) {
        const updatedData = {
          ...versionDetails,
          extension: updatedExtension,
        };
        await handleExtensionUpdate(updatedData);
        setExtentionDetails(updatedData);
      }
    },
    [versionDetails]
  );

  const extensionObject: {
    extensionObject: ExtentionEntities[T];
    addedKeysList?: string[];
  } = useMemo(() => {
    if (isVersionView) {
      const changeDescription = versionDetails?.changeDescription;
      const extensionDiff = getDiffByFieldName(
        EntityField.EXTENSION,
        changeDescription as ChangeDescription
      );

      const newValues = getChangedEntityNewValue(extensionDiff);

      if (extensionDiff.added) {
        const addedFields = JSON.parse(newValues ? newValues : [])[0];
        if (addedFields) {
          return {
            extensionObject: versionDetails?.extension,
            addedKeysList: Object.keys(addedFields),
          };
        }
      }

      if (versionDetails && extensionDiff.updated) {
        return getUpdatedExtensionDiffFields(versionDetails, extensionDiff);
      }
    }

    return { extensionObject: versionDetails?.extension };
  }, [isVersionView, versionDetails]);

  const tableColumn: ColumnsType<CustomProperty> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (_, record) => getEntityName(record),
      },
      {
        title: t('label.value'),
        dataIndex: 'value',
        key: 'value',
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
    versionDetails?.extension,
    hasEditAccess,
    extensionObject,
    isVersionView,
    onExtensionUpdate,
  ]);

  useEffect(() => {
    if (typePermission?.ViewAll || typePermission?.ViewBasic) {
      fetchTypeDetail();
    }
  }, [typePermission]);

  useEffect(() => {
    fetchResourcePermission(entityType);
  }, [entityType]);

  if (entityTypeDetailLoading) {
    return <Skeleton active />;
  }

  if (!hasPermission) {
    return (
      <div className="flex-center tab-content-height">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
      </div>
    );
  }

  if (
    isEmpty(entityTypeDetail.customProperties) &&
    isUndefined(versionDetails?.extension)
  ) {
    return (
      <div className="flex-center tab-content-height">
        <ErrorPlaceHolder className={className}>
          <Typography.Paragraph>
            {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
              entity: t('label.custom-property-plural'),
            })}
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      </div>
    );
  }

  return isEmpty(entityTypeDetail.customProperties) &&
    !isUndefined(versionDetails?.extension) ? (
    <ExtensionTable extension={versionDetails?.extension} />
  ) : (
    <Table
      bordered
      className="m-md"
      columns={tableColumn}
      data-testid="custom-properties-table"
      dataSource={entityTypeDetail.customProperties ?? []}
      loading={entityTypeDetailLoading}
      pagination={false}
      rowKey="name"
      size="small"
    />
  );
};
