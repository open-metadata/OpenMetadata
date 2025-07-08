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
import { Button, Col, Form, Input, Row } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../../components/common/Loader/Loader';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import {
  OPENMETADATA_URL_CONFIG_SERVICE_CATEGORY,
  OPEN_METADATA,
} from '../../../constants/service-guide.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { OpenMetadataBaseURLConfiguration } from '../../../generated/configuration/openMetadataBaseUrlConfiguration';
import { Settings, SettingType } from '../../../generated/settings/settings';
import { withPageLayout } from '../../../hoc/withPageLayout';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const { Item } = Form;
const EditUrlConfigurationPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm<OpenMetadataBaseURLConfiguration>();
  const [activeField, setActiveField] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchCustomLogoConfig = async () => {
    try {
      setLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.OpenMetadataBaseURLConfiguration
      );

      form.setFieldsValue({ ...(data.config_value ?? {}) });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.entity-configuration', {
          entity: t('label.open-metadata-url'),
        }),
        url: getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.OM_URL_CONFIG
        ),
      },
      {
        name: t('label.edit-entity', {
          entity: t('label.entity-configuration', {
            entity: t('label.open-metadata-url'),
          }),
        }),
        url: '',
      },
    ],
    []
  );

  const handleGoBack = () => navigate(-1);

  const handleSubmit = async (
    configValues: OpenMetadataBaseURLConfiguration
  ) => {
    try {
      setUpdating(true);
      const configData = {
        config_type: SettingType.OpenMetadataBaseURLConfiguration,
        config_value: configValues,
      };
      await updateSettingsConfig(configData as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.entity-configuration', {
            entity: t('label.open-metadata-url'),
          }),
        })
      );
      handleGoBack();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchCustomLogoConfig();
  }, []);

  const firstPanelChildren = (
    <>
      <TitleBreadcrumb titleLinks={breadcrumb} />
      <Form
        className="m-t-md"
        data-testid="custom-login-config-form"
        form={form}
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSubmit}
        onFocus={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveField(e.target.id);
        }}>
        <Item
          label={t('label.open-metadata-url')}
          name="openMetadataUrl"
          rules={[{ required: true }]}>
          <Input
            data-testid="open-metadata-url-input"
            id="root/openMetadataUrl-input"
          />
        </Item>
        <Row justify="end">
          <Col>
            <Button
              data-testid="cancel-button"
              type="link"
              onClick={handleGoBack}>
              {t('label.cancel')}
            </Button>
          </Col>
          <Col>
            <Button
              data-testid="save-button"
              htmlType="submit"
              loading={updating}
              type="primary">
              {t('label.save')}
            </Button>
          </Col>
        </Row>
      </Form>
    </>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={OPENMETADATA_URL_CONFIG_SERVICE_CATEGORY}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

  if (loading) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
      }}
      pageTitle={t('label.edit-entity', {
        entity: t('label.entity-configuration', {
          entity: t('label.open-metadata-url'),
        }),
      })}
      secondPanel={{
        children: secondPanelChildren,
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(EditUrlConfigurationPage);
