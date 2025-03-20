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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Collapse, Row, Switch, Table, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as ArrowRight } from '../../assets/svg/arrow-right.svg';
import { ReactComponent as Delete } from '../../assets/svg/delete-colored.svg';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as PlusOutlined } from '../../assets/svg/plus-outlined.svg';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import FieldValueBoostModal from '../../components/SearchSettings/FieldValueBoostModal/FieldValueBoostModal';
import { GlobalSettingItem } from '../../components/SearchSettings/GlobalSettingsItem/GlobalSettingsItem';
import TermBoostList from '../../components/SearchSettings/TermBoostList/TermBoostList';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { globalSettings } from '../../constants/SearchSettings.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  FieldValueBoost,
  SearchSettings,
  TermBoost,
} from '../../generated/configuration/searchSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import { useAuth } from '../../hooks/authHooks';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getSettingsPathWithFqn } from '../../utils/RouterUtils';
import { getSearchSettingCategories } from '../../utils/SearchSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './search-settings.less';
import { UpdateConfigParams } from './searchSettings.interface';

const SearchSettingsPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const { setAppPreferences, appPreferences } = useApplicationStore();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchConfig, setSearchConfig] = useState<SearchSettings>();
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showNewTermBoost, setShowNewTermBoost] = useState<boolean>(false);
  const [showFieldValueBoostModal, setShowFieldValueBoostModal] =
    useState<boolean>(false);
  const [selectedFieldValueBoost, setSelectedFieldValueBoost] = useState<
    FieldValueBoost | undefined
  >();

  const settingCategoryData = useMemo(
    () => getSearchSettingCategories(permissions, isAdminUser ?? false),
    [permissions, isAdminUser]
  );

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.search')
      ),
    []
  );

  const entityFields = useMemo(() => {
    if (!searchConfig?.allowedFields) {
      return [];
    }

    return searchConfig.allowedFields.map((entityField) => ({
      entityType: entityField.entityType,
      fields: entityField.fields.map((field) => field.name),
    }));
  }, [searchConfig]);

  const entityOptions = useMemo(() => {
    const allFields = entityFields.flatMap((entity) => entity.fields);
    const uniqueFields = [...new Set(allFields)];

    return uniqueFields;
  }, [entityFields]);

  const fetchSearchConfig = async () => {
    try {
      setIsLoading(true);

      const configValue = await getSettingsByType(SettingType.SearchSettings);
      setSearchConfig(configValue as SearchSettings);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSearchConfig = async ({
    enabled,
    field,
    value,
  }: UpdateConfigParams = {}) => {
    try {
      setIsUpdating(true);
      if (!searchConfig) {
        return;
      }

      const configData = {
        config_type: SettingType.SearchSettings,
        config_value: {
          ...searchConfig,
          globalSettings: {
            ...searchConfig.globalSettings,
            ...(enabled !== undefined
              ? { [field ?? 'enableAccessControl']: enabled }
              : { [field as PropertyKey]: value }),
          },
        },
      };

      const { data } = await updateSettingsConfig(configData as Settings);
      const updatedSearchConfig = data.config_value as SearchSettings;

      setSearchConfig(updatedSearchConfig);
      setAppPreferences({
        ...appPreferences,
        searchConfig: updatedSearchConfig,
      });

      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.search-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddNewTermBoost = () => {
    setShowNewTermBoost(true);
  };

  const handleTermBoostChange = (newTermBoost: TermBoost) => {
    if (!searchConfig || !newTermBoost.value || !newTermBoost.boost) {
      return;
    }

    const termBoosts = [...(searchConfig.globalSettings?.termBoosts || [])];
    const existingIndex = termBoosts.findIndex(
      (tb) => tb.value === newTermBoost.value
    );

    if (existingIndex >= 0) {
      termBoosts[existingIndex] = newTermBoost;
    } else {
      termBoosts.push(newTermBoost);
    }

    const updatedConfig = {
      ...searchConfig,
      globalSettings: {
        ...searchConfig.globalSettings,
        termBoosts,
      },
    };

    setSearchConfig(updatedConfig);
    handleUpdateSearchConfig({
      field: 'termBoosts',
      value: termBoosts,
    });
    setShowNewTermBoost(false);
  };

  const handleDeleteTermBoost = (value: string) => {
    if (!searchConfig || !value) {
      setShowNewTermBoost(false);

      return;
    }

    const termBoosts =
      searchConfig.globalSettings?.termBoosts?.filter(
        (tb) => tb.value !== value
      ) || [];

    handleUpdateSearchConfig({
      field: 'termBoosts',
      value: termBoosts,
    });
  };

  const handleViewDetailClick = (key: string) => {
    const [category, option, entity] = key.split('.');
    history.push(getSettingsPathWithFqn(category, option, entity));
  };

  const handleAddFieldValueBoost = () => {
    setSelectedFieldValueBoost(undefined);
    setShowFieldValueBoostModal(true);
  };

  const handleEditFieldValueBoost = (boost: FieldValueBoost) => {
    setSelectedFieldValueBoost(boost);
    setShowFieldValueBoostModal(true);
  };

  const handleSaveFieldValueBoost = async (values: FieldValueBoost) => {
    if (!searchConfig) {
      return;
    }
    const fieldValueBoosts = [
      ...(searchConfig.globalSettings?.fieldValueBoosts || []),
    ];
    const existingIndex = fieldValueBoosts.findIndex(
      (boost) => boost.field === values.field
    );

    if (existingIndex >= 0) {
      fieldValueBoosts[existingIndex] = values;
    } else {
      fieldValueBoosts.push(values);
    }

    await handleUpdateSearchConfig({
      field: 'fieldValueBoosts',
      value: fieldValueBoosts,
    });

    setShowFieldValueBoostModal(false);
    setSelectedFieldValueBoost(undefined);
  };

  const handleDeleteFieldValueBoost = async (fieldName: string) => {
    if (!searchConfig) {
      return;
    }
    const fieldValueBoosts =
      searchConfig.globalSettings?.fieldValueBoosts?.filter(
        (boost) => boost.field !== fieldName
      ) || [];

    await handleUpdateSearchConfig({
      field: 'fieldValueBoosts',
      value: fieldValueBoosts,
    });
  };

  const columns = useMemo(() => {
    return [
      {
        title: t('label.field'),
        dataIndex: 'field',
        key: 'field',
        width: 250,
      },
      {
        title: t('label.factor'),
        dataIndex: 'factor',
        key: 'factor',
        width: 80,
      },
      {
        title: t('label.modifier'),
        dataIndex: 'modifier',
        key: 'modifier',
        width: 120,
      },
      {
        title: t('label.missing-value'),
        dataIndex: 'missing',
        key: 'missing',
        width: 120,
      },
      {
        title: t('label.greater-than'),
        key: 'gt',
        width: 120,
        render: (record: FieldValueBoost) => (
          <span>{record.condition?.range?.gt ?? '-'}</span>
        ),
      },
      {
        title: t('label.greater-than-or-equal-to'),
        key: 'gte',
        width: 120,
        render: (record: FieldValueBoost) => (
          <span>{record.condition?.range?.gte ?? '-'}</span>
        ),
      },
      {
        title: t('label.less-than'),
        key: 'lt',
        width: 120,
        render: (record: FieldValueBoost) => (
          <span>{record.condition?.range?.lt ?? '-'}</span>
        ),
      },
      {
        title: t('label.less-than-or-equal-to'),
        key: 'lte',
        width: 120,
        render: (record: FieldValueBoost) => (
          <span>{record.condition?.range?.lte ?? '-'}</span>
        ),
      },
      {
        title: t('label.action-plural'),
        key: 'actions',
        width: 100,
        render: (record: FieldValueBoost) => (
          <div className="d-flex items-center gap-2">
            <Button
              className="edit-field-value-boost-btn"
              data-testid="edit-field-value-boost-btn"
              icon={<Icon className="text-md" component={EditIcon} />}
              type="text"
              onClick={() => handleEditFieldValueBoost(record)}
            />
            <Button
              className="delete-field-value-boost-btn"
              data-testid="delete-field-value-boost-btn"
              icon={<Icon className="text-md" component={Delete} />}
              type="text"
              onClick={() => handleDeleteFieldValueBoost(record.field)}
            />
          </div>
        ),
      },
    ];
  }, [searchConfig]);

  useEffect(() => {
    fetchSearchConfig();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="search-settings"
      mainContainerClassName="p-t-0"
      pageTitle={t('label.search')}>
      <Row className="p-y-md p-x-lg settings-row" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <PageHeader data={PAGE_HEADERS.SEARCH_SETTINGS} />
        </Col>
      </Row>
      <Row className="p-y-md p-x-lg settings-row" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Title className="text-sm font-semibold" level={5}>
            {t('label.global-setting-plural')}
          </Typography.Title>
        </Col>
        <Col span={24}>
          <Row className="p-x-xs global-settings-cards-container" gutter={0}>
            <Col className="global-setting-card">
              <Typography.Text className="global-setting-card__content">
                {t('label.enable-roles-polices-in-search')}
              </Typography.Text>
              <Switch
                checked={searchConfig?.globalSettings?.enableAccessControl}
                className="m-l-xlg global-setting-card__action"
                data-testid="enable-roles-polices-in-search-switch"
                disabled={isUpdating}
                onChange={() =>
                  handleUpdateSearchConfig({
                    enabled: !searchConfig?.globalSettings?.enableAccessControl,
                    field: 'enableAccessControl',
                  })
                }
              />
            </Col>
            {globalSettings.map(({ key, label, max, min }) => (
              <Col className="global-setting-card" key={key}>
                <GlobalSettingItem
                  label={label}
                  max={max}
                  min={min}
                  value={searchConfig?.globalSettings?.[key] ?? 0}
                  onUpdate={(value) =>
                    handleUpdateSearchConfig({
                      field: key,
                      value,
                    })
                  }
                />
              </Col>
            ))}
          </Row>
          <Row className="boosts-section m-t-lg" gutter={[0, 16]}>
            <Collapse
              accordion
              bordered={false}
              className="w-full search-settings-collapse">
              <Collapse.Panel
                className="term-boost-panel"
                header={
                  <Row className="d-flex items-center justify-between w-full">
                    <Col className="d-flex items-center gap-4">
                      <Typography.Text className="text-sm font-semibold m-0">
                        {t('label.configure-term-boost')}
                      </Typography.Text>
                      <span className="count-label">
                        {searchConfig?.globalSettings?.termBoosts?.length ?? 0}
                      </span>
                    </Col>
                    <Col className="d-flex items-center gap-2">
                      <Button
                        className="term-boost-add-btn"
                        icon={
                          <Icon className="text-sm" component={PlusOutlined} />
                        }
                        type="primary"
                        onClick={handleAddNewTermBoost}>
                        {t('label.term-boost')}
                      </Button>
                    </Col>
                  </Row>
                }
                key="1">
                <Col span={24}>
                  <TermBoostList
                    handleDeleteTermBoost={handleDeleteTermBoost}
                    handleTermBoostChange={handleTermBoostChange}
                    showNewTermBoost={showNewTermBoost}
                    termBoostCardClassName="settings-term-boost-card"
                    termBoosts={searchConfig?.globalSettings?.termBoosts ?? []}
                  />
                </Col>
              </Collapse.Panel>
              <Collapse.Panel
                className="field-value-boost-panel"
                header={
                  <Row className="d-flex items-center justify-between w-full">
                    <Col className="d-flex items-center gap-4">
                      <Typography.Text className="text-sm font-semibold m-0">
                        {t('label.configure-field-value-boost')}
                      </Typography.Text>
                      <span className="count-label">
                        {searchConfig?.globalSettings?.fieldValueBoosts
                          ?.length ?? 0}
                      </span>
                    </Col>
                    <Col className="d-flex items-center gap-2">
                      <Button
                        className="field-value-boost-add-btn"
                        data-testid="add-field-value-boost-btn"
                        icon={
                          <Icon className="text-sm" component={PlusOutlined} />
                        }
                        onClick={handleAddFieldValueBoost}>
                        {t('label.field-value-boost')}
                      </Button>
                    </Col>
                  </Row>
                }
                key="2">
                <Row className="p-t-sm w-full">
                  <div className="field-value-boost-table-container">
                    <Table
                      bordered
                      columns={columns}
                      data-testid="field-value-boost-table"
                      dataSource={searchConfig?.globalSettings?.fieldValueBoosts?.map(
                        (boost) => ({
                          ...boost,
                          key: boost.field,
                        })
                      )}
                      loading={isLoading}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      size="small"
                    />
                  </div>
                </Row>
              </Collapse.Panel>
            </Collapse>
          </Row>
        </Col>
      </Row>

      <Row className="p-x-lg p-b-md" gutter={[16, 16]}>
        {settingCategoryData?.map((data) => (
          <Col key={data.key} span={8}>
            <div
              className="search-setting-card"
              onClick={() => handleViewDetailClick(data.key)}>
              <div className="search-setting-card-icon">
                <Icon component={data.icon} />
              </div>
              <div className="search-setting-card-content">
                <Typography.Text className="font-semibold">
                  {data.label}
                </Typography.Text>
                <Typography.Paragraph
                  className="font-normal text-sm"
                  ellipsis={{ rows: 2 }}>
                  {data.description}
                </Typography.Paragraph>
              </div>
              <div className="search-setting-card-action">
                <Icon className="text-sm" component={ArrowRight} />
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <FieldValueBoostModal
        entityOptions={entityOptions}
        open={showFieldValueBoostModal}
        selectedBoost={selectedFieldValueBoost}
        onCancel={() => {
          setShowFieldValueBoostModal(false);
          setSelectedFieldValueBoost(undefined);
        }}
        onSave={handleSaveFieldValueBoost}
      />
    </PageLayoutV1>
  );
};

export default SearchSettingsPage;
