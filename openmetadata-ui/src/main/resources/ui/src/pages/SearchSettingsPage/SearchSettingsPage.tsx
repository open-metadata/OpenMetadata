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
import { Button, Col, Row, Switch, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingItem } from '../../components/SearchSettings/GlobalSettingsItem/GlobalSettingsItem';
import TermBoostComponent from '../../components/SearchSettings/TermBoost/TermBoost';
import SettingItemCard from '../../components/Settings/SettingItemCard/SettingItemCard.component';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { globalSettings } from '../../constants/SearchSettings.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
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
import { getSettingPath } from '../../utils/RouterUtils';
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
    if (!searchConfig) {
      return;
    }

    const updatedConfig = {
      ...searchConfig,
      globalSettings: {
        ...searchConfig.globalSettings,
        termBoosts: [
          { field: '', value: '', boost: 0 },
          ...(searchConfig.globalSettings?.termBoosts ?? []),
        ],
      },
    };

    setSearchConfig(updatedConfig);
  };

  const handleTermBoostChange = (newTermBoost: TermBoost) => {
    if (!searchConfig || !newTermBoost.field || !newTermBoost.boost) {
      return;
    }

    const termBoosts = [...(searchConfig.globalSettings?.termBoosts || [])];
    const existingIndex = termBoosts.findIndex(
      (tb) => tb.field === '' || tb.field === newTermBoost.field
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
  };

  const handleDeleteTermBoost = (field: string) => {
    if (!searchConfig || !field) {
      return;
    }

    const termBoosts =
      searchConfig.globalSettings?.termBoosts?.filter(
        (tb) => tb.field !== field
      ) || [];

    handleUpdateSearchConfig({
      field: 'termBoosts',
      value: termBoosts,
    });
  };

  const handleViewDetailClick = (key: string) => {
    const [category, option] = key.split('.');
    history.push(getSettingPath(category, option));
  };

  useEffect(() => {
    fetchSearchConfig();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 className="search-settings" pageTitle={t('label.search')}>
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
          <Typography.Title className="text-md font-semibold" level={5}>
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
            <Col className="global-setting-card">
              <Typography.Text className="global-setting-card__content">
                {t('label.use-natural-language-search')}
              </Typography.Text>
              <Switch
                checked={searchConfig?.globalSettings?.useNaturalLanguageSearch}
                className="m-l-xlg global-setting-card__action"
                data-testid="use-natural-language-search-switch"
                disabled={isUpdating}
                onChange={() =>
                  handleUpdateSearchConfig({
                    enabled:
                      !searchConfig?.globalSettings?.useNaturalLanguageSearch,
                    field: 'useNaturalLanguageSearch',
                  })
                }
              />
            </Col>
            {globalSettings.map(({ key, label }) => (
              <Col className="global-setting-card" key={key}>
                <GlobalSettingItem
                  label={label}
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
          <Row className="term-boosts-section m-t-md" gutter={[0, 16]}>
            <Col span={24}>
              <div className="d-flex items-center justify-between m-b-md">
                <Typography.Text className="text-md font-medium">
                  {t('label.configure-term-boost')}
                </Typography.Text>
                <Button
                  data-testid="add-term-boost"
                  type="primary"
                  onClick={handleAddNewTermBoost}>
                  {t('label.add-term-boost')}
                </Button>
              </div>
              <div
                className="d-flex items-center gap-2 flex-wrap term-boosts-container"
                data-testid="term-boosts">
                {searchConfig?.globalSettings?.termBoosts?.map((termBoost) => (
                  <TermBoostComponent
                    key={termBoost.field}
                    termBoost={termBoost}
                    onDeleteBoost={handleDeleteTermBoost}
                    onTermBoostChange={handleTermBoostChange}
                  />
                ))}
              </div>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* <FilterConfiguration /> */}

      <Row className="p-x-lg p-b-md" gutter={[16, 16]}>
        {settingCategoryData?.map((data) => (
          <Col key={data.key} span={6}>
            <SettingItemCard
              isButton
              className="search-setting-card"
              data={data}
              key={data.key}
              onClick={() => handleViewDetailClick(data.key)}
            />
          </Col>
        ))}
      </Row>
    </PageLayoutV1>
  );
};

export default SearchSettingsPage;
