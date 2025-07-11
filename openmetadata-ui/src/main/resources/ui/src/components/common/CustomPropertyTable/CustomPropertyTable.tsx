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

import { Col, Divider, Row, Skeleton, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CUSTOM_PROPERTIES_DOCS } from '../../../constants/docs.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { ChangeDescription, Type } from '../../../generated/entity/type';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  getChangedEntityNewValue,
  getDiffByFieldName,
  getUpdatedExtensionDiffFields,
} from '../../../utils/EntityVersionUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import ErrorPlaceHolder from '../ErrorWithPlaceholder/ErrorPlaceHolder';
import ExpandableCard from '../ExpandableCard/ExpandableCard';
import './custom-property-table.less';
import {
  CustomPropertyProps,
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from './CustomPropertyTable.interface';
import { PropertyValue } from './PropertyValue';

export const CustomPropertyTable = <T extends ExtentionEntitiesKeys>({
  entityType,
  hasEditAccess,
  className,
  isVersionView,
  hasPermission,
  maxDataCap,
  isRenderedInRightPanel = false,
}: CustomPropertyProps<T>) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const {
    data: entityDetails,
    onUpdate,
    filterWidgets,
  } = useGenericContext<ExtentionEntities[T]>();
  const [entityTypeDetail, setEntityTypeDetail] = useState<Type>({} as Type);
  const [entityTypeDetailLoading, setEntityTypeDetailLoading] =
    useState<boolean>(true);

  const onExtensionUpdate = useCallback(
    async (updatedExtension: ExtentionEntities[T]) => {
      if (!isUndefined(onUpdate) && entityDetails) {
        const updatedData = {
          ...entityDetails,
          extension: updatedExtension,
        };
        await onUpdate(updatedData);
      }
    },
    [entityDetails, onUpdate]
  );

  const extensionObject: {
    extensionObject: ExtentionEntities[T];
    addedKeysList?: string[];
  } = useMemo(() => {
    if (isVersionView) {
      const changeDescription = entityDetails?.changeDescription;
      const extensionDiff = getDiffByFieldName(
        EntityField.EXTENSION,
        changeDescription as ChangeDescription
      );

      const newValues = getChangedEntityNewValue(extensionDiff);

      if (extensionDiff.added) {
        const addedFields = JSON.parse(newValues ?? [])[0];
        if (addedFields) {
          return {
            extensionObject: entityDetails?.extension,
            addedKeysList: Object.keys(addedFields),
          };
        }
      }

      if (entityDetails && extensionDiff.updated) {
        return getUpdatedExtensionDiffFields(entityDetails, extensionDiff);
      }
    }

    return { extensionObject: entityDetails?.extension };
  }, [isVersionView, entityDetails?.extension]);

  const viewAllBtn = useMemo(() => {
    const customProp = entityTypeDetail.customProperties ?? [];

    if (
      maxDataCap &&
      customProp.length >= maxDataCap &&
      entityDetails?.fullyQualifiedName
    ) {
      return (
        <Link
          className="text-sm"
          to={entityUtilClassBase.getEntityLink(
            entityType,
            entityDetails.fullyQualifiedName,
            EntityTabs.CUSTOM_PROPERTIES
          )}>
          {t('label.view-all')}
        </Link>
      );
    }

    return null;
  }, [
    entityTypeDetail.customProperties,
    entityType,
    entityDetails,
    maxDataCap,
  ]);

  const { dataSource, dataSourceColumns } = useMemo(() => {
    const customProperties = entityTypeDetail?.customProperties ?? [];

    const dataSource = Array.isArray(customProperties)
      ? customProperties.slice(0, maxDataCap)
      : [];

    // Split dataSource into three equal parts
    const columnCount = 3;
    const columns = Array.from({ length: columnCount }, (_, i) =>
      dataSource.filter((_, index) => index % columnCount === i)
    );

    return { dataSource, dataSourceColumns: columns };
  }, [maxDataCap, entityTypeDetail?.customProperties]);

  useEffect(() => {
    if (
      isRenderedInRightPanel &&
      !entityTypeDetailLoading &&
      isEmpty(entityTypeDetail.customProperties) &&
      isUndefined(entityDetails?.extension)
    ) {
      filterWidgets?.([DetailPageWidgetKeys.CUSTOM_PROPERTIES]);
    }
  }, [
    isRenderedInRightPanel,
    entityTypeDetail.customProperties,
    entityTypeDetailLoading,
  ]);

  const initCustomPropertyTable = useCallback(async () => {
    setEntityTypeDetailLoading(true);
    try {
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.TYPE,
        entityType
      );

      if (permission?.ViewAll || permission?.ViewBasic) {
        try {
          const res = await getTypeByFQN(entityType);

          setEntityTypeDetail(res);
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    } finally {
      setEntityTypeDetailLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    initCustomPropertyTable();
  }, [entityType]);

  if (entityTypeDetailLoading) {
    return (
      <div className="p-lg border-default border-radius-sm">
        <Skeleton active />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="flex-center">
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.custom-property-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      </div>
    );
  }

  if (
    isEmpty(entityTypeDetail.customProperties) &&
    isUndefined(entityDetails?.extension) &&
    // in case of right panel, we don't want to show the placeholder
    !isRenderedInRightPanel
  ) {
    return (
      <div className="h-full p-x-lg flex-center border-default border-radius-sm">
        <ErrorPlaceHolder
          className={classNames(className)}
          placeholderText={
            <Transi18next
              i18nKey="message.no-custom-properties-entity"
              renderElement={
                <a
                  href={CUSTOM_PROPERTIES_DOCS}
                  rel="noreferrer"
                  target="_blank"
                  title="Custom properties documentation"
                />
              }
              values={{
                docs: t('label.doc-plural-lowercase'),
                entity: startCase(entityType),
              }}
            />
          }
        />
      </div>
    );
  }

  if (isRenderedInRightPanel) {
    const header = (
      <div className={classNames('d-flex justify-between')}>
        <Typography.Text className={classNames('text-sm font-medium')}>
          {t('label.custom-property-plural')}
        </Typography.Text>
        {viewAllBtn}
      </div>
    );
    const propertyList = (
      <div className="custom-property-right-panel-container">
        {dataSource.map((record, index) => (
          <Fragment key={record.name}>
            <div
              className={classNames('custom-property-right-panel-card', {
                'top-border-radius': index === 0,
                'bottom-border-radius': index === dataSource.length - 1,
              })}
              key={record.name}>
              <PropertyValue
                extension={extensionObject.extensionObject}
                hasEditPermissions={hasEditAccess}
                isRenderedInRightPanel={isRenderedInRightPanel}
                isVersionView={isVersionView}
                key={record.name}
                property={record}
                versionDataKeys={extensionObject.addedKeysList}
                onExtensionUpdate={onExtensionUpdate}
              />
            </div>
            {index !== dataSource.length - 1 && <Divider className="m-y-0" />}
          </Fragment>
        ))}
      </div>
    );

    if (isEmpty(entityTypeDetail.customProperties)) {
      // Noting should be shown in case of no properties
      return null;
    }

    return (
      <ExpandableCard
        cardProps={{
          className: 'no-scrollbar',
          title: header,
        }}>
        {propertyList}
      </ExpandableCard>
    );
  }

  return !isEmpty(entityTypeDetail.customProperties) ? (
    <div className="custom-properties-card">
      <Row data-testid="custom-properties-card" gutter={[16, 16]}>
        {dataSourceColumns.map((columns, colIndex) => (
          <Col key={colIndex} span={8}>
            {columns.map((record) => (
              <div key={record.name} style={{ marginBottom: '16px' }}>
                <PropertyValue
                  extension={extensionObject.extensionObject}
                  hasEditPermissions={hasEditAccess}
                  isRenderedInRightPanel={isRenderedInRightPanel}
                  isVersionView={isVersionView}
                  property={record}
                  versionDataKeys={extensionObject.addedKeysList}
                  onExtensionUpdate={onExtensionUpdate}
                />
              </div>
            ))}
          </Col>
        ))}
      </Row>
    </div>
  ) : null;
};
