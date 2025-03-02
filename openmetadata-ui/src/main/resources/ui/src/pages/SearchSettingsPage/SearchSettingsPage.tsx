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
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Dropdown,
  Row,
  Switch,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg';
import { ReactComponent as FilterIcon } from '../../assets/svg/filter-primary.svg';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingItem } from '../../components/SearchSettings/GlobalSettingsItem/GlobalSettingsItem';
import { DATA_ASSET_DROPDOWN_ITEMS } from '../../constants/AdvancedSearch.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { globalSettings } from '../../constants/SearchSettings.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchSettings } from '../../generated/configuration/searchSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import { useAuth } from '../../hooks/authHooks';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
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
  const [visible, setVisible] = useState<boolean>(false);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const settingCategoryData = useMemo(
    () => getSearchSettingCategories(permissions, isAdminUser ?? false),
    [permissions, isAdminUser]
  );

  const entityFields = useMemo(
    () =>
      Object.entries(EntityFields).map(([key, field]) => ({
        fieldName: field,
        label: startCase(key.toLowerCase()),
      })),
    []
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

      const updatedConfig =
        enabled !== undefined
          ? { enableAccessControl: enabled }
          : {
              globalSettings: {
                ...searchConfig.globalSettings,
                [field as PropertyKey]: value,
              },
            };

      const configData = {
        config_type: SettingType.SearchSettings,
        config_value: {
          ...searchConfig,
          ...updatedConfig,
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
          entity: t('label.search-search-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCheckboxChange = (label: string) => {
    setCheckedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const menuItems = useMemo(
    () => ({
      items: entityFields.map((field) => ({
        key: field.fieldName,
        label: (
          <Checkbox
            checked={checkedItems.includes(field.fieldName)}
            onChange={() => handleCheckboxChange(field.fieldName)}>
            {field.label}
          </Checkbox>
        ),
      })),
      className: 'menu-items',
    }),
    [entityFields, checkedItems]
  );

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
          <PageHeader data={PAGE_HEADERS.SEARCH_RBAC} />
        </Col>
      </Row>
      <Row className="p-y-md p-x-lg settings-row" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Title className="text-md font-semibold" level={5}>
            {t('label.global-setting-plural')}
          </Typography.Title>
        </Col>
        <Col span={24}>
          <Row
            className="p-x-xs global-settings-cards-container"
            gutter={[20, 20]}>
            <Col className="global-setting-card p-y-lg">
              <Typography.Text className="global-setting-card__content">
                {t('label.enable-roles-polices-in-search')}
              </Typography.Text>
              <Switch
                checked={searchConfig?.enableAccessControl}
                className="m-l-xlg global-setting-card__action"
                disabled={isUpdating}
                onChange={() =>
                  handleUpdateSearchConfig({
                    enabled: !searchConfig?.enableAccessControl,
                  })
                }
              />
            </Col>
            {globalSettings.map(({ key, label }) => (
              <Col className="global-setting-card p-y-lg" key={key}>
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
        </Col>
      </Row>
      <Row className="filters-configuration-row p-y-md p-x-lg" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Title className="text-md font-semibold" level={5}>
            {t('label.filters-configuration')}
          </Typography.Title>
        </Col>
        <Col className="filter-configuration-container" span={24}>
          <Dropdown
            getPopupContainer={(triggerNode) => triggerNode.parentElement!}
            menu={menuItems}
            open={visible}
            placement="bottomLeft"
            trigger={['click']}
            onOpenChange={(flag) => setVisible(flag)}>
            <Button
              className="flex items-center gap-2 p-md text-sm font-medium add-filters-btn"
              icon={<FilterIcon />}>
              {t('label.add-filter-plural')}
            </Button>
          </Dropdown>
          <Divider className="h-auto self-stretch" type="vertical" />
          {DATA_ASSET_DROPDOWN_ITEMS.map((value) => (
            <div
              className="bg-white flex items-center justify-center gap-3 p-y-xss p-x-sm filter-value"
              key={value.key}>
              {value.label}
              <Icon
                className="text-grey-muted text-xss cursor-pointer"
                component={CloseIcon}
              />
            </div>
          ))}
        </Col>
      </Row>
      <Row
        className="m-b-lg"
        gutter={[16, 16]}
        style={{
          margin: '20px',
        }}>
        {settingCategoryData?.map((data) => (
          <Col key={data.key} span={6}>
            <Card className="search-setting-card-item" data-testid={data.key}>
              <div className="search-setting-card-icon-container">
                <Icon
                  className="search-setting-card-icon"
                  component={data.icon}
                />
              </div>

              <div className="search-setting-card-item-content">
                <Typography.Text className="search-setting-card-title">
                  {data.label}
                </Typography.Text>
                <Typography.Paragraph
                  className="search-setting-card-description"
                  ellipsis={{ rows: 2 }}>
                  {data.description}
                </Typography.Paragraph>
              </div>
              <Button
                className="search-setting-card-action-btn"
                onClick={() => history.push(data.key)}>
                {t('label.view-detail-plural')}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </PageLayoutV1>
  );
};

export default SearchSettingsPage;
