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
import { Col, Collapse, Row, Select, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, startCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_PATH } from '../../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  AllowedFieldField,
  AllowedSearchFields,
  BoostMode,
  FieldValueBoost,
  ScoreMode,
  SearchSettings,
  TermBoost,
} from '../../../generated/configuration/searchSettings';
import {
  MatchType,
  Settings,
  SettingType,
} from '../../../generated/settings/settings';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { EntitySearchSettingsState } from '../../../pages/SearchSettingsPage/searchSettings.interface';
import {
  getSettingsByType,
  restoreSettingsConfig,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import {
  boostModeOptions,
  getEntitySearchConfig,
  getSearchSettingCategories,
  scoreModeOptions,
} from '../../../utils/SearchSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import CollapseHeader from '../../common/CollapseHeader/CollapseHeader';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import FieldConfiguration from '../FieldConfiguration/FieldConfiguration';
import FieldValueBoostList from '../FieldValueBoostList/FieldValueBoostList';
import FieldValueBoostModal from '../FieldValueBoostModal/FieldValueBoostModal';
import SearchPreview from '../SearchPreview/SearchPreview';
import TermBoostList from '../TermBoostList/TermBoostList';
import './entity-search-settings.less';

const EntitySearchSettings = () => {
  const { t } = useTranslation();
  const { fqn } = useRequiredParams<{
    fqn: keyof typeof ENTITY_PATH;
  }>();

  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const {
    setAppPreferences,
    appPreferences: { searchConfig, ...appPreferences },
  } = useApplicationStore();

  const [isSaving, setIsSaving] = useState(false);
  const [searchSettings, setSearchSettings] =
    useState<EntitySearchSettingsState>({
      searchFields: [],
      fieldValueBoosts: [],
      boostMode: BoostMode.Multiply,
      scoreMode: ScoreMode.Avg,
      highlightFields: [],
      termBoosts: [],
      isUpdated: false,
    });
  const [previewSearchConfig, setPreviewSearchConfig] =
    useState<SearchSettings>(searchConfig ?? {});
  const [showNewTermBoost, setShowNewTermBoost] = useState<boolean>(false);
  const [showNewFieldValueBoost, setShowNewFieldValueBoost] =
    useState<boolean>(false);
  const [selectedFieldValueBoost, setSelectedFieldValueBoost] = useState<
    FieldValueBoost | undefined
  >();
  const [allowedFields, setAllowedFields] = useState<AllowedSearchFields[]>([]);
  const [activeKey, setActiveKey] = useState<string>('1');
  const [lastAddedSearchField, setLastAddedSearchField] = useState<
    string | null
  >(null);

  const entityType = useMemo(() => ENTITY_PATH[fqn], [fqn]);

  const getEntityConfiguration = useMemo(() => {
    return getEntitySearchConfig(searchConfig, entityType);
  }, [searchConfig, entityType]);

  const entityData = useMemo(() => {
    const settingCategories = getSearchSettingCategories(
      permissions,
      isAdminUser ?? false
    );

    return settingCategories?.find((data) => data.key.split('.')[2] === fqn);
  }, [permissions, isAdminUser, fqn]);

  const entitySearchFields = useMemo(() => {
    if (!searchSettings.searchFields) {
      return [];
    }

    return searchSettings.searchFields.map((field) => ({
      fieldName: field.field,
      weight: field.boost ?? 0,
      matchType: field.matchType || MatchType.Standard,
    }));
  }, [searchSettings.searchFields]);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        startCase(entityType),
        GlobalSettingOptions.SEARCH_SETTINGS
      ),
    []
  );

  const entityFields: AllowedFieldField[] = useMemo(() => {
    const currentEntityFields =
      allowedFields.find((field) => field.entityType === entityType)?.fields ??
      [];

    return currentEntityFields.map((field) => ({
      name: field.name,
      description: field.description,
    }));
  }, [allowedFields, entityType]);

  const fieldValueBoostOptions = useMemo(() => {
    if (!isEmpty(searchConfig?.allowedFieldValueBoosts)) {
      return searchConfig?.allowedFieldValueBoosts?.[0].fields?.map(
        (field) => field.name
      );
    }

    return [];
  }, [searchConfig]);

  const menuItems = useMemo(() => {
    return entityFields
      .filter(
        (field) =>
          !searchSettings.searchFields?.some(
            (searchField) => searchField.field === field.name
          )
      )
      .map((field) => ({
        key: field.name,
        label: field.name,
        onClick: (e: any) => {
          e.domEvent.stopPropagation();
          handleFieldSelection(field.name);
        },
      }));
  }, [entityFields, searchSettings.searchFields]);

  const handleFieldSelection = (fieldName: string) => {
    setActiveKey('1');
    setLastAddedSearchField(fieldName);

    setSearchSettings((prev) => {
      const isFieldSelected = prev.searchFields?.some(
        (field) => field.field === fieldName
      );

      if (isFieldSelected) {
        return {
          ...prev,
          searchFields: prev.searchFields?.filter(
            (field) => field.field !== fieldName
          ),
          isUpdated: true,
        };
      } else {
        return {
          ...prev,
          searchFields: [
            {
              field: fieldName,
              boost: 0,
            },
            ...(prev.searchFields ?? []),
          ],
          isUpdated: true,
        };
      }
    });
  };

  const fetchSearchConfig = async () => {
    try {
      if (searchConfig) {
        return;
      }
      const configValue = await getSettingsByType(SettingType.SearchSettings);
      setAppPreferences({
        ...appPreferences,
        searchConfig: configValue as SearchSettings,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // Handle save changes - makes API call with all changes
  const updateSearchConfig = async (updatedData: EntitySearchSettingsState) => {
    if (!searchConfig || !getEntityConfiguration) {
      return;
    }

    try {
      setIsSaving(true);
      const updatedConfig = {
        ...searchConfig,
        assetTypeConfigurations: searchConfig.assetTypeConfigurations?.map(
          (config) =>
            config.assetType === entityType
              ? { ...config, ...updatedData }
              : config
        ),
      };

      const configData = {
        config_type: SettingType.SearchSettings,
        config_value: updatedConfig,
      };

      const { data } = await updateSettingsConfig(configData as Settings);
      const updatedSearchConfig = data.config_value as SearchSettings;

      // Update app preferences
      setAppPreferences({
        ...appPreferences,
        searchConfig: updatedSearchConfig,
      });

      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.search-setting-plural'),
        })
      );

      setSearchSettings({
        ...searchSettings,
        ...updatedSearchConfig,
        isUpdated: false,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  // Use the common function for different updates
  const handleSaveChanges = () => {
    if (!getEntityConfiguration) {
      return;
    }

    const updates = {
      searchFields: searchSettings.searchFields,
      highlightFields: searchSettings.highlightFields,
      termBoosts: searchSettings.termBoosts,
      fieldValueBoosts: searchSettings.fieldValueBoosts,
      scoreMode: searchSettings.scoreMode,
      boostMode: searchSettings.boostMode,
    };

    updateSearchConfig(updates);
  };

  const handleModeUpdate = (
    mode: 'boostMode' | 'scoreMode',
    value: BoostMode | ScoreMode
  ) => {
    if (mode === 'boostMode') {
      setSearchSettings((prev) => ({
        ...prev,
        boostMode: value as BoostMode,
        isUpdated: true,
      }));
    } else {
      setSearchSettings((prev) => ({
        ...prev,
        scoreMode: value as ScoreMode,
        isUpdated: true,
      }));
    }
  };

  const handleFieldWeightChange = (fieldName: string, value: number) => {
    setSearchSettings((prev) => {
      const updatedFields = prev.searchFields?.map((field) =>
        field.field === fieldName ? { ...field, boost: value } : field
      );

      return {
        ...prev,
        searchFields: updatedFields,
        isUpdated: true,
      };
    });
  };

  const handleMatchTypeChange = (fieldName: string, matchType: MatchType) => {
    setSearchSettings((prev) => {
      const updatedFields = prev.searchFields?.map((field) =>
        field.field === fieldName ? { ...field, matchType } : field
      );

      return {
        ...prev,
        searchFields: updatedFields,
        isUpdated: true,
      };
    });
  };

  const handleHighlightFieldsChange = (fieldName: string) => {
    const updatedHighlightFields = searchSettings.highlightFields?.includes(
      fieldName
    )
      ? searchSettings.highlightFields?.filter(
          (highlightField) => highlightField !== fieldName
        )
      : [...(searchSettings.highlightFields ?? []), fieldName];

    setSearchSettings((prev) => ({
      ...prev,
      highlightFields: updatedHighlightFields,
      isUpdated: true,
    }));
  };

  const handleDeleteSearchField = (fieldName: string) => {
    setSearchSettings((prev) => ({
      ...prev,
      searchFields: (prev.searchFields ?? []).filter(
        (field) => field.field !== fieldName
      ),
      isUpdated: true,
    }));
  };

  // Term Boost

  const handleAddNewTermBoost = () => {
    setShowNewTermBoost(true);
    setActiveKey('2');
  };

  const handleTermBoostChange = (newTermBoost: TermBoost) => {
    if (!newTermBoost.value || !newTermBoost.boost) {
      return;
    }

    setSearchSettings((prev) => {
      const termBoosts = [...(prev.termBoosts || [])];
      const existingIndex = termBoosts.findIndex(
        (tb) => tb.value === newTermBoost.value
      );

      if (existingIndex >= 0) {
        termBoosts[existingIndex] = newTermBoost;
      } else {
        termBoosts.push(newTermBoost);
      }

      return {
        ...prev,
        termBoosts,
        isUpdated: true,
      };
    });

    setShowNewTermBoost(false);
  };

  const handleDeleteTermBoost = (value: string) => {
    if (!value) {
      setShowNewTermBoost(false);

      return;
    }

    setSearchSettings((prev) => ({
      ...prev,
      termBoosts: prev.termBoosts?.filter((tb) => tb.value !== value) || [],
      isUpdated: true,
    }));
  };

  // Field Value Boost

  const handleAddNewFieldValueBoost = () => {
    setSelectedFieldValueBoost(undefined);
    setShowNewFieldValueBoost(true);
    setActiveKey('3');
  };

  const handleEditFieldValueBoost = (boost: FieldValueBoost) => {
    setSelectedFieldValueBoost(boost);
    setShowNewFieldValueBoost(true);
  };

  const handleSaveFieldValueBoost = async (values: FieldValueBoost) => {
    const fieldValueBoosts = [...(searchSettings.fieldValueBoosts || [])];
    const existingIndex = fieldValueBoosts.findIndex(
      (boost) => boost.field === values.field
    );

    if (existingIndex >= 0) {
      fieldValueBoosts[existingIndex] = values;
    } else {
      fieldValueBoosts.push(values);
    }

    setSearchSettings((prev) => ({
      ...prev,
      fieldValueBoosts,
      isUpdated: true,
    }));

    setShowNewFieldValueBoost(false);
    setSelectedFieldValueBoost(undefined);
  };

  const handleDeleteFieldValueBoost = (fieldName: string) => {
    setSearchSettings((prev) => ({
      ...prev,
      fieldValueBoosts:
        prev.fieldValueBoosts?.filter((fb) => fb.field !== fieldName) || [],
      isUpdated: true,
    }));
  };

  const handleRestoreDefaults = async () => {
    try {
      const { data } = await restoreSettingsConfig(SettingType.SearchSettings);

      const updatedSearchConfig = data as SearchSettings;

      const updatedAssetSearchSettings =
        updatedSearchConfig.assetTypeConfigurations?.find(
          (config) => config.assetType === entityType
        );

      setAppPreferences({
        ...appPreferences,
        searchConfig: updatedSearchConfig,
      });

      setSearchSettings({
        ...updatedAssetSearchSettings,
        isUpdated: false,
      });

      showSuccessToast(
        t('server.restore-entity-success', {
          entity: t('label.search-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleCollapseChange = (key: string | string[]) => {
    setActiveKey(Array.isArray(key) ? key[0] : key);
  };

  useEffect(() => {
    fetchSearchConfig();
  }, []);

  useEffect(() => {
    if (searchConfig) {
      setAllowedFields(searchConfig?.allowedFields ?? []);
    }
  }, [searchConfig]);

  useEffect(() => {
    if (getEntityConfiguration) {
      setSearchSettings({
        searchFields: getEntityConfiguration?.searchFields,
        boostMode: getEntityConfiguration?.boostMode,
        scoreMode: getEntityConfiguration?.scoreMode,
        highlightFields: getEntityConfiguration?.highlightFields,
        fieldValueBoosts: getEntityConfiguration?.fieldValueBoosts,
        termBoosts: getEntityConfiguration?.termBoosts,
        isUpdated: false,
      });
    }
  }, [getEntityConfiguration]);

  // Update preview config whenever searchSettings change
  useEffect(() => {
    if (!searchConfig || !entityType) {
      return;
    }

    // Create updated config for preview
    const updatedConfig: SearchSettings = {
      ...searchConfig,
      assetTypeConfigurations: searchConfig.assetTypeConfigurations?.map(
        (config) =>
          config.assetType === entityType
            ? {
                ...config,
                searchFields: searchSettings.searchFields,
                highlightFields: searchSettings.highlightFields,
                termBoosts: searchSettings.termBoosts,
                fieldValueBoosts: searchSettings.fieldValueBoosts,
                scoreMode: searchSettings.scoreMode,
                boostMode: searchSettings.boostMode,
              }
            : config
      ),
    };

    if (searchSettings.searchFields?.length) {
      setPreviewSearchConfig((prev) =>
        JSON.stringify(prev) !== JSON.stringify(updatedConfig)
          ? updatedConfig
          : prev
      );
    }
  }, [searchSettings, searchConfig, entityType]);

  return (
    <PageLayoutV1
      className="entity-search-settings"
      mainContainerClassName="p-t-0"
      pageTitle={t('label.search')}>
      <Row
        className="entity-search-settings-header bg-white m-b-lg p-box m-0"
        data-testid="entity-search-settings-header"
        gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col className="flex items-center gap-4" span={24}>
          <Icon className="entity-icon" component={entityData?.icon} />
          <div
            className="page-header-container"
            data-testid="page-header-container">
            <Typography.Title
              className="heading"
              data-testid="heading"
              level={5}>
              {entityData?.label}
            </Typography.Title>
            <Typography.Paragraph
              className="sub-heading"
              data-testid="sub-heading">
              {entityData?.description}
            </Typography.Paragraph>
          </div>
        </Col>
      </Row>
      <Row
        className="d-flex gap-5 items-start entity-search-settings-content m-x-0"
        gutter={0}>
        <Col className="d-flex flex-column settings-left-panel" span={8}>
          <Collapse
            accordion
            activeKey={activeKey}
            bordered={false}
            className="w-full entity-collapse-container"
            onChange={handleCollapseChange}>
            <Collapse.Panel
              header={
                <CollapseHeader
                  dataTestId="add-field-btn"
                  menuItems={menuItems}
                  title={t('label.matching-fields')}
                />
              }
              key="1">
              <div className="bg-white configuration-container">
                <Row className="p-y-xs " data-testid="field-configurations">
                  {entitySearchFields.map((field, index) => (
                    <Col className="m-b-sm" key={field.fieldName} span={24}>
                      <FieldConfiguration
                        entityFields={entityFields}
                        field={field}
                        index={index}
                        initialOpen={field.fieldName === lastAddedSearchField}
                        key={field.fieldName}
                        searchSettings={searchSettings}
                        onDeleteSearchField={handleDeleteSearchField}
                        onFieldWeightChange={handleFieldWeightChange}
                        onHighlightFieldsChange={handleHighlightFieldsChange}
                        onMatchTypeChange={handleMatchTypeChange}
                      />
                    </Col>
                  ))}
                  {/* Score Mode and Boost Mode Section */}
                  <Col className="flex flex-col w-full">
                    <div className="p-y-xs p-x-sm border-radius-card m-b-sm bg-white config-section-content">
                      <Typography.Text className="text-grey-muted text-xs font-normal">
                        {t('label.score-mode')}
                      </Typography.Text>
                      <Select
                        bordered={false}
                        className="w-full border-none custom-select"
                        data-testid="score-mode-select"
                        options={scoreModeOptions}
                        value={searchSettings.scoreMode}
                        onChange={(value: ScoreMode) =>
                          handleModeUpdate('scoreMode', value)
                        }
                      />
                    </div>
                    <div className="p-y-xs p-x-sm border-radius-card m-b-sm bg-white config-section-content">
                      <Typography.Text className="text-grey-muted text-xs font-normal">
                        {t('label.boost-mode')}
                      </Typography.Text>
                      <Select
                        bordered={false}
                        className="w-full border-none custom-select"
                        data-testid="boost-mode-select"
                        options={boostModeOptions}
                        value={searchSettings.boostMode}
                        onChange={(value: BoostMode) =>
                          handleModeUpdate('boostMode', value)
                        }
                      />
                    </div>
                  </Col>
                </Row>
              </div>
            </Collapse.Panel>
            <Collapse.Panel
              header={
                <CollapseHeader
                  dataTestId="add-term-boost-btn"
                  handleAddNewBoost={handleAddNewTermBoost}
                  title={t('label.term-boost')}
                />
              }
              key="2">
              <div className="bg-white border-radius-card p-box configuration-container">
                <TermBoostList
                  className="flex-column justify-center"
                  handleDeleteTermBoost={handleDeleteTermBoost}
                  handleTermBoostChange={handleTermBoostChange}
                  showNewTermBoost={showNewTermBoost}
                  termBoostCardClassName="term-boost-card"
                  termBoosts={searchSettings.termBoosts ?? []}
                />
              </div>
            </Collapse.Panel>
            <Collapse.Panel
              header={
                <CollapseHeader
                  dataTestId="add-field-value-boost-btn"
                  handleAddNewBoost={handleAddNewFieldValueBoost}
                  title={t('label.field-value-boost')}
                />
              }
              key="3">
              <div className="bg-white border-radius-card p-box configuration-container">
                <FieldValueBoostList
                  entitySearchSettingsPage
                  dataTestId="entity-field-value-boost-table"
                  fieldValueBoosts={searchSettings.fieldValueBoosts ?? []}
                  handleDeleteFieldValueBoost={handleDeleteFieldValueBoost}
                  handleEditFieldValueBoost={handleEditFieldValueBoost}
                  isLoading={false}
                />
              </div>
            </Collapse.Panel>
          </Collapse>
        </Col>
        <Col
          className="bg-white border-radius-card p-box h-full d-flex flex-column preview-section"
          span={16}>
          <SearchPreview
            disabledSave={!searchSettings.isUpdated || isSaving}
            handleRestoreDefaults={handleRestoreDefaults}
            handleSaveChanges={handleSaveChanges}
            isSaving={isSaving}
            searchConfig={previewSearchConfig}
          />
        </Col>
      </Row>

      <FieldValueBoostModal
        entityOptions={fieldValueBoostOptions ?? []}
        open={showNewFieldValueBoost}
        selectedBoost={selectedFieldValueBoost}
        onCancel={() => {
          setShowNewFieldValueBoost(false);
          setSelectedFieldValueBoost(undefined);
        }}
        onSave={handleSaveFieldValueBoost}
      />
    </PageLayoutV1>
  );
};

export default EntitySearchSettings;
