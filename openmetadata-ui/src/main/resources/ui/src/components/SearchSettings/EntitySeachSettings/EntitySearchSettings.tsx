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
import { Button, Col, Row, Select, Tabs, TabsProps, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  BoostMode,
  ScoreMode,
  SearchSettings,
  TagBoost,
} from '../../../generated/configuration/searchSettings';
import { Settings, SettingType } from '../../../generated/settings/settings';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  EntitySearchSettingsState,
  MatchType,
} from '../../../pages/SearchSettingsPage/searchSettings.interface';
import {
  restoreSettingsConfig,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import {
  boostModeOptions,
  getEntitySearchConfig,
  getSearchSettingCategories,
  getSelectedMatchType,
  scoreModeOptions,
} from '../../../utils/SearchSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import FieldConfiguration from '../FieldConfiguration/FieldConfiguration';
import SearchPreview from '../SearchPreview/SearchPreview';
import TagBoostComponent from '../TagBoost/TagBoost';
import './entity-search-settings.less';

const EntitySearchSettings = () => {
  const { t } = useTranslation();
  const { entityType } = useParams<{ entityType: string }>();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const { setAppPreferences, appPreferences } = useApplicationStore();
  const { searchConfig } = appPreferences;

  const [searchSettings, setSearchSettings] =
    useState<EntitySearchSettingsState>({
      fields: {},
      boostMode: BoostMode.Multiply,
      scoreMode: ScoreMode.Avg,
      highlightFields: [],
      mustMatch: [],
      shouldMatch: [],
      mustNotMatch: [],
      boosts: [],
      tagBoosts: [],
      isUpdated: false,
    });

  const getEntityConfiguration = useMemo(() => {
    return getEntitySearchConfig(searchConfig, entityType);
  }, [searchConfig, entityType]);

  const entityData = useMemo(() => {
    const settingCategories = getSearchSettingCategories(
      permissions,
      isAdminUser ?? false
    );

    return settingCategories?.find(
      (data) => data.key.split('/')[1] === entityType
    );
  }, [permissions, isAdminUser, entityType]);

  const entityFields = useMemo(() => {
    if (!getEntityConfiguration) {
      return [];
    }

    return Object.entries(getEntityConfiguration.fields).map(
      ([fieldName, weight]) => ({
        fieldName,
        weight,
      })
    );
  }, [getEntityConfiguration, entityType]);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.search')
      ),
    []
  );

  // Handle save changes - makes API call with all changes
  const updateSearchConfig = async (updatedData: EntitySearchSettingsState) => {
    if (!searchConfig || !getEntityConfiguration) {
      return;
    }

    try {
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
    }
  };

  // Use the common function for different updates
  const handleSaveChanges = () => {
    if (!getEntityConfiguration) {
      return;
    }

    const updates = {
      fields: searchSettings.fields,
      highlightFields: searchSettings.highlightFields,
      mustMatch: searchSettings.mustMatch,
      shouldMatch: searchSettings.shouldMatch,
      mustNotMatch: searchSettings.mustNotMatch,
      boosts: searchSettings.boosts,
      tagBoosts: searchSettings.tagBoosts,
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
    setSearchSettings((prev) => ({
      ...prev,
      fields: { ...(prev.fields ?? {}), [fieldName]: value },
      isUpdated: true,
    }));
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

  const handleMatchTypeChange = (
    fieldName: string,
    newMatchType: MatchType
  ) => {
    setSearchSettings((prev) => {
      const updatedMatchFields = {
        mustMatch: prev.mustMatch?.filter((field) => field !== fieldName),
        shouldMatch: prev.shouldMatch?.filter((field) => field !== fieldName),
        mustNotMatch: prev.mustNotMatch?.filter((field) => field !== fieldName),
      };

      updatedMatchFields[newMatchType] = [
        ...(updatedMatchFields[newMatchType] || []),
        fieldName,
      ];

      return {
        ...prev,
        ...updatedMatchFields,
        isUpdated: true,
      };
    });
  };

  const handleBoostChange = (fieldName: string, boostValue: number) => {
    setSearchSettings((prev) => {
      const existingBoostIndex = prev.boosts?.findIndex(
        (boost) => boost.field === fieldName
      );
      if (existingBoostIndex !== undefined && existingBoostIndex >= 0) {
        const updatedBoosts = [...(prev.boosts ?? [])];
        updatedBoosts[existingBoostIndex] = {
          field: fieldName,
          boost: boostValue,
        };

        return {
          ...prev,
          boosts: updatedBoosts,
          isUpdated: true,
        };
      } else {
        return {
          ...prev,
          boosts: [
            ...(prev.boosts ?? []),
            { field: fieldName, boost: boostValue },
          ],
          isUpdated: true,
        };
      }
    });
  };

  const handleDeleteBoost = (fieldName: string) => {
    setSearchSettings((prev) => ({
      ...prev,
      boosts: (prev.boosts ?? []).filter((boost) => boost.field !== fieldName),
      isUpdated: true,
    }));
  };

  const handleAddNewTagBoost = () => {
    setSearchSettings((prev) => ({
      ...prev,
      tagBoosts: [{ tagFQN: '', boost: 0 }, ...(prev.tagBoosts ?? [])],
      isUpdated: true,
    }));
  };

  const handleTagBoostChange = (newTagBoost: TagBoost) => {
    if (!newTagBoost.tagFQN || !newTagBoost.boost) {
      return;
    }

    setSearchSettings((prev) => {
      const tagBoosts = [...(prev.tagBoosts || [])];
      const existingIndex = tagBoosts.findIndex(
        (tb) => tb.tagFQN === '' || tb.tagFQN === newTagBoost.tagFQN
      );

      if (existingIndex >= 0) {
        tagBoosts[existingIndex] = newTagBoost;
      }

      return {
        ...prev,
        tagBoosts,
        isUpdated: true,
      };
    });
  };

  const handleDeleteTagBoost = (tagFQN: string) => {
    if (!tagFQN) {
      return;
    }

    setSearchSettings((prev) => ({
      ...prev,
      tagBoosts: prev.tagBoosts?.filter((tb) => tb.tagFQN !== tagFQN) || [],
      isUpdated: true,
    }));
  };

  const handleRestoreDefaults = async () => {
    try {
      const { data } = await restoreSettingsConfig(SettingType.SearchSettings);

      const updatedSearchConfig = data as SearchSettings;

      setAppPreferences({
        ...appPreferences,
        searchConfig: updatedSearchConfig,
      });

      setSearchSettings({
        ...updatedSearchConfig,
        isUpdated: false,
      });

      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.search-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (getEntityConfiguration) {
      setSearchSettings({
        fields: getEntityConfiguration.fields ?? {},
        boostMode: getEntityConfiguration?.boostMode,
        scoreMode: getEntityConfiguration?.scoreMode,
        highlightFields: getEntityConfiguration?.highlightFields ?? [],
        mustMatch: getEntityConfiguration.mustMatch || [],
        shouldMatch: getEntityConfiguration.shouldMatch || [],
        mustNotMatch: getEntityConfiguration.mustNotMatch || [],
        boosts: getEntityConfiguration.boosts ?? [],
        tagBoosts: getEntityConfiguration.tagBoosts ?? [],
        isUpdated: false,
      });
    }
  }, [getEntityConfiguration, searchConfig]);

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: t('label.field-plural'),
      children: (
        <div className="config-section" data-testid="field-configurations">
          {entityFields.map((field, index) => (
            <FieldConfiguration
              field={field}
              getSelectedMatchType={getSelectedMatchType}
              index={index}
              key={field.fieldName}
              searchSettings={searchSettings}
              onBoostChange={handleBoostChange}
              onDeleteBoost={handleDeleteBoost}
              onFieldWeightChange={handleFieldWeightChange}
              onHighlightFieldsChange={handleHighlightFieldsChange}
              onMatchTypeChange={handleMatchTypeChange}
            />
          ))}
        </div>
      ),
    },
    {
      key: '2',
      label: t('label.boost-plural'),
      children: (
        <div className="config-section" data-testid="boost-configurations">
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
          <div className="p-y-xs p-x-sm border-radius-card m-b-sm bg-white config-section-content">
            <div className="d-flex items-center justify-between">
              <Typography.Text>{t('label.tag-boost-plural')}</Typography.Text>
              <Button
                className="add-tag-boost-btn"
                onClick={handleAddNewTagBoost}>
                {t('label.add')}
              </Button>
            </div>
            {searchSettings.tagBoosts?.map((tagBoost) => (
              <TagBoostComponent
                key={tagBoost.tagFQN}
                tagBoost={tagBoost}
                onDeleteBoost={handleDeleteTagBoost}
                onTagBoostChange={handleTagBoostChange}
              />
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <PageLayoutV1
      className="entity-search-settings"
      pageTitle={t('label.search')}>
      <Row
        className="entity-search-settings-header bg-white m-b-lg p-y-md p-x-lg"
        data-testid="entity-search-settings-header"
        gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col className="flex items-center gap-4" span={24}>
          <Icon component={entityData?.icon} style={{ fontSize: '55px' }} />
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
        className="d-flex gap-5 items-start entity-seach-settings-content"
        gutter={[24, 0]}>
        <Col
          className="bg-white border-radius-card h-full flex-1 p-box configuration-container"
          span={8}>
          <Typography.Title level={5}>
            {t('label.configuration')}
          </Typography.Title>
          <Tabs defaultActiveKey="1" items={items} />
        </Col>
        <Col
          className="bg-white border-radius-card p-box h-full d-flex flex-column preview-section"
          span={16}>
          <div className="preview-content d-flex flex-column flex-1">
            <SearchPreview />
          </div>
          <div className="d-flex justify-end p-t-md">
            <Button
              className="restore-defaults-btn font-semibold"
              data-testid="restore-defaults-btn"
              onClick={handleRestoreDefaults}>
              {t('label.restore-default-plural')}
            </Button>
            <Button
              className="save-btn font-semibold m-l-md"
              data-testid="save-btn"
              onClick={handleSaveChanges}>
              {t('label.save')}
            </Button>
          </div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default EntitySearchSettings;
