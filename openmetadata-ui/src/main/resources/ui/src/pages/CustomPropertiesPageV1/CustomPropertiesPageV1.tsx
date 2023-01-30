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

import { Button, Col, Row, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TabsPane from 'components/common/TabsPane/TabsPane';
import { CustomPropertyTable } from 'components/CustomEntityDetail/CustomPropertyTable';
import PageHeader from 'components/header/PageHeader.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getTypeByFQN, updateType } from 'rest/metadataTypeAPI';
import {
  ENTITY_PATH,
  getAddCustomPropertyPath,
} from '../../constants/constants';
import { CUSTOM_PROPERTIES_DOCS } from '../../constants/docs.constants';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { Type } from '../../generated/entity/type';
import jsonData from '../../jsons/en';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './CustomPropertiesPageV1.less';

const CustomEntityDetailV1 = () => {
  const { t } = useTranslation();
  const { tab } = useParams<{ [key: string]: string }>();
  const history = useHistory();

  const [activeTab, setActiveTab] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [selectedEntityTypeDetail, setSelectedEntityTypeDetail] =
    useState<Type>({} as Type);

  const tabAttributePath = ENTITY_PATH[tab.toLowerCase()];

  const { getEntityPermission } = usePermissionProvider();

  const [propertyPermission, setPropertyPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const fetchPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.TYPE,
        selectedEntityTypeDetail.id as string
      );
      setPropertyPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const viewPermission = useMemo(
    () => propertyPermission.ViewAll || propertyPermission.ViewBasic,
    [propertyPermission, tab]
  );

  const editPermission = useMemo(
    () => propertyPermission.EditAll,
    [propertyPermission, tab]
  );

  const fetchTypeDetail = async (typeFQN: string) => {
    setIsLoading(true);
    try {
      const data = await getTypeByFQN(typeFQN);
      setSelectedEntityTypeDetail(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsError(true);
    }
    setIsLoading(false);
  };

  const onTabChange = (tab: number) => {
    setActiveTab(tab);
  };

  const handleAddProperty = () => {
    const path = getAddCustomPropertyPath(tabAttributePath);
    history.push(path);
  };

  const tabs = useMemo(() => {
    const { customProperties } = selectedEntityTypeDetail;

    return [
      {
        name: 'Custom Properties',
        isProtected: false,
        position: 1,
        count: (customProperties || []).length,
      },
      {
        name: 'Schema',
        isProtected: false,
        position: 2,
      },
    ];
  }, [selectedEntityTypeDetail]);

  const updateEntityType = async (properties: Type['customProperties']) => {
    const patch = compare(selectedEntityTypeDetail, {
      ...selectedEntityTypeDetail,
      customProperties: properties,
    });

    try {
      const data = await updateType(selectedEntityTypeDetail.id || '', patch);
      setSelectedEntityTypeDetail((prev) => ({
        ...prev,
        customProperties: data.customProperties,
      }));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const getCustomPageHeader = useCallback(() => {
    switch (tabAttributePath) {
      case ENTITY_PATH.tables:
        return PAGE_HEADERS.TABLES_CUSTOM_ATTRIBUTES;
      case ENTITY_PATH.topics:
        return PAGE_HEADERS.TOPICS_CUSTOM_ATTRIBUTES;
      case ENTITY_PATH.dashboards:
        return PAGE_HEADERS.DASHBOARD_CUSTOM_ATTRIBUTES;
      case ENTITY_PATH.pipelines:
        return PAGE_HEADERS.PIPELINES_CUSTOM_ATTRIBUTES;
      case ENTITY_PATH.mlmodels:
        return PAGE_HEADERS.ML_MODELS_CUSTOM_ATTRIBUTES;

      default:
        return PAGE_HEADERS.TABLES_CUSTOM_ATTRIBUTES;
    }
  }, [tabAttributePath]);

  useEffect(() => {
    if (!isUndefined(tab)) {
      setActiveTab(1);
      setIsError(false);
      fetchTypeDetail(tabAttributePath);
    }
  }, [tab]);

  useEffect(() => {
    if (selectedEntityTypeDetail?.id) {
      fetchPermission();
    }
  }, [selectedEntityTypeDetail]);

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <ErrorPlaceHolder>
        {jsonData['message']['no-custom-entity']}
      </ErrorPlaceHolder>
    );
  }

  return viewPermission ? (
    <Row
      className="m-y-xs"
      data-testid="custom-entity-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <PageHeader data={getCustomPageHeader()} />
      </Col>
      <Col className="global-settings-tabs" span={24}>
        <TabsPane
          activeTab={activeTab}
          setActiveTab={onTabChange}
          tabs={tabs}
        />
      </Col>
      <Col span={24}>
        {activeTab === 2 && (
          <div data-testid="entity-schema">
            <SchemaEditor
              className="custom-properties-schemaEditor p-y-md"
              editorClass="custom-entity-schema"
              value={JSON.parse(selectedEntityTypeDetail.schema ?? '{}')}
            />
          </div>
        )}
        {activeTab === 1 &&
          (isEmpty(selectedEntityTypeDetail.customProperties) ? (
            <div data-testid="entity-custom-fields">
              <ErrorPlaceHolder
                buttons={
                  <Tooltip
                    title={
                      editPermission
                        ? t('label.add-custom-entity-property', {
                            entity: getCustomPageHeader().header,
                          })
                        : NO_PERMISSION_FOR_ACTION
                    }>
                    <Button
                      ghost
                      data-testid="add-field-button"
                      disabled={!editPermission}
                      type="primary"
                      onClick={() => handleAddProperty()}>
                      {t('label.add-entity', {
                        entity: t('label.property'),
                      })}
                    </Button>
                  </Tooltip>
                }
                dataTestId="custom-properties-no-data"
                doc={CUSTOM_PROPERTIES_DOCS}
                heading="Property"
                type="ADD_DATA"
              />
            </div>
          ) : (
            <div data-testid="entity-custom-fields">
              <div className="flex justify-end">
                <Tooltip
                  placement="topRight"
                  title={
                    editPermission
                      ? t('label.add-custom-entity-property', {
                          entity: getCustomPageHeader().header,
                        })
                      : NO_PERMISSION_FOR_ACTION
                  }>
                  <Button
                    className="m-b-md p-y-xss p-x-xs rounded-4"
                    data-testid="add-field-button"
                    disabled={!editPermission}
                    size="middle"
                    type="primary"
                    onClick={() => handleAddProperty()}>
                    {t('label.add-entity', {
                      entity: t('label.property'),
                    })}
                  </Button>
                </Tooltip>
              </div>
              <CustomPropertyTable
                customProperties={
                  selectedEntityTypeDetail.customProperties || []
                }
                hasAccess={editPermission}
                updateEntityType={updateEntityType}
              />
            </div>
          ))}
      </Col>
    </Row>
  ) : (
    <Row>
      <Col span={24}>
        <ErrorPlaceHolder>
          <p>{NO_PERMISSION_TO_VIEW}</p>
        </ErrorPlaceHolder>
      </Col>
    </Row>
  );
};

export default CustomEntityDetailV1;
