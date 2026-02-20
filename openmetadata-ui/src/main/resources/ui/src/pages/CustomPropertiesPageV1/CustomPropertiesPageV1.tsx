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

import { Card, Col, Row, Tabs } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageHeader } from '../../components/common/atoms/navigation/usePageHeader';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import SchemaEditor from '../../components/Database/SchemaEditor/SchemaEditor';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import AddCustomProperty from '../../components/Settings/CustomProperty/AddCustomProperty/AddCustomProperty';
import { CustomPropertyTable } from '../../components/Settings/CustomProperty/CustomPropertyTable';
import { ENTITY_PATH } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Type } from '../../generated/entity/type';
import { CustomProperty } from '../../generated/type/customProperty';
import {
  addPropertyToEntity,
  getTypeByFQN,
  updateType,
} from '../../rest/metadataTypeAPI';
import { getCustomPropertyPageHeaderFromEntity } from '../../utils/CustomProperty.utils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './custom-properties-pageV1.less';

const CustomEntityDetailV1 = () => {
  const { t } = useTranslation();
  const { tab } = useRequiredParams<{ tab: keyof typeof ENTITY_PATH }>();

  const [activeTab, setActiveTab] = useState<EntityTabs>(
    EntityTabs.CUSTOM_PROPERTIES
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [selectedEntityTypeDetail, setSelectedEntityTypeDetail] =
    useState<Type>({} as Type);

  const [isButtonLoading, setIsButtonLoading] = useState<boolean>(false);

  const tabAttributePath = useMemo(() => ENTITY_PATH[tab], [tab]);

  const { getEntityPermission } = usePermissionProvider();

  const [propertyPermission, setPropertyPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
        startCase(tab)
      ),
    [tab]
  );

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

  const editPermission = useMemo(
    () => propertyPermission.EditAll,
    [propertyPermission, tab]
  );

  const fetchTypeDetail = useCallback(async (typeFQN: string) => {
    setIsLoading(true);
    try {
      const data = await getTypeByFQN(typeFQN);
      setSelectedEntityTypeDetail(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsError(true);
    }
    setIsLoading(false);
  }, []);

  const onTabChange = useCallback((activeKey: string) => {
    setActiveTab(activeKey as EntityTabs);
  }, []);

  const [form] = useForm();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleAddProperty = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    form.resetFields();
  }, [form]);

  const handleDrawerSubmit = useCallback(
    async (data: CustomProperty) => {
      setIsButtonLoading(true);
      try {
        await addPropertyToEntity(selectedEntityTypeDetail.id ?? '', data);
        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.custom-property'),
          })
        );
        handleDrawerClose();
        fetchTypeDetail(tabAttributePath);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsButtonLoading(false);
      }
    },
    [
      selectedEntityTypeDetail.id,
      handleDrawerClose,
      fetchTypeDetail,
      tabAttributePath,
      t,
    ]
  );

  const updateEntityType = useCallback(
    async (properties: Type['customProperties']) => {
      setIsButtonLoading(true);
      const patch = compare(selectedEntityTypeDetail, {
        ...selectedEntityTypeDetail,
        customProperties: properties,
      });

      try {
        const data = await updateType(selectedEntityTypeDetail.id ?? '', patch);
        setSelectedEntityTypeDetail((prev) => ({
          ...prev,
          customProperties: data.customProperties,
        }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsButtonLoading(false);
      }
    },
    [selectedEntityTypeDetail]
  );

  const customPageHeader = useMemo(() => {
    const pageHeader = getCustomPropertyPageHeaderFromEntity(tabAttributePath);

    return {
      header: t(pageHeader.header),
      subHeader: translateWithNestedKeys(
        pageHeader.subHeader,
        pageHeader.subHeaderParams
      ),
    };
  }, [tabAttributePath, t]);

  const { pageHeader } = usePageHeader({
    titleKey: customPageHeader.header,
    descriptionMessageKey: customPageHeader.subHeader,
    createPermission:
      activeTab === EntityTabs.CUSTOM_PROPERTIES && editPermission,
    addButtonLabelKey: t('label.add-entity', { entity: t('label.property') }),
    addButtonTestId: 'add-field-button',
    onAddClick: handleAddProperty,
  });

  useEffect(() => {
    if (!isUndefined(tab)) {
      setActiveTab(EntityTabs.CUSTOM_PROPERTIES);
      setIsError(false);
      fetchTypeDetail(tabAttributePath);
    }
  }, [tabAttributePath]);

  useEffect(() => {
    if (selectedEntityTypeDetail?.id) {
      fetchPermission();
    }
  }, [selectedEntityTypeDetail]);

  const tabs = useMemo(() => {
    const { customProperties, schema } = selectedEntityTypeDetail;

    return [
      {
        label: (
          <TabsLabel
            count={(customProperties ?? []).length}
            id={EntityTabs.CUSTOM_PROPERTIES}
            isActive={activeTab === EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
        children: (
          <Card data-testid="entity-custom-fields">
            <CustomPropertyTable
              customProperties={customProperties ?? []}
              hasAccess={editPermission}
              isButtonLoading={isButtonLoading}
              isLoading={isLoading}
              updateEntityType={updateEntityType}
            />
          </Card>
        ),
      },
      {
        label: t('label.schema'),
        key: EntityTabs.SCHEMA,
        children: (
          <SchemaEditor
            className="custom-properties-schemaEditor"
            editorClass="custom-entity-schema"
            value={JSON.parse(schema ?? '{}')}
          />
        ),
      },
    ];
  }, [
    selectedEntityTypeDetail.schema,
    editPermission,
    isButtonLoading,
    customPageHeader,
    isLoading,
    activeTab,
    handleAddProperty,
    updateEntityType,
  ]);

  if (isError) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.custom-property')}>
      <Row data-testid="custom-entity-container" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>{pageHeader}</Col>
        <Col className="global-settings-tabs" span={24}>
          <Tabs
            className="tabs-new"
            items={tabs}
            key={tab}
            onChange={onTabChange}
          />
        </Col>
      </Row>
      <AddCustomProperty
        entityType={selectedEntityTypeDetail.name as EntityType}
        formRef={form}
        loading={isButtonLoading}
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        onSubmit={handleDrawerSubmit}
      />
    </PageLayoutV1>
  );
};

export default CustomEntityDetailV1;
