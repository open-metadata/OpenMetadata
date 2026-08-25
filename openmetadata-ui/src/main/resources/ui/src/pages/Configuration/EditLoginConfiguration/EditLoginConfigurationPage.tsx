/*
 *  Copyright 2023 Collate.
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
import { Button, Col, Form, Row } from 'antd';
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
  CUSTOM_LOGIN_CONFIG_SERVICE_CATEGORY,
  OPEN_METADATA,
} from '../../../constants/service-guide.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { LoginConfiguration } from '../../../generated/configuration/loginConfiguration';
import { Settings, SettingType } from '../../../generated/settings/settings';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import {
  getLoginConfig,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { generateFormFields } from '../../../utils/formUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const EditLoginConfiguration = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginConfiguration>();
  const [activeField, setActiveField] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchCustomLogoConfig = async () => {
    try {
      setLoading(true);

      const data = await getLoginConfig();

      form.setFieldsValue({ ...(data ?? {}) });
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
        name: t('label.login-configuration'),
        url: getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.LOGIN_CONFIGURATION
        ),
      },
      {
        name: t('label.edit-entity', {
          entity: t('label.login-configuration'),
        }),
        url: '',
      },
    ],
    []
  );

  const formFields: FieldProp[] = [
    {
      name: 'maxLoginFailAttempts',
      label: t('label.max-login-fail-attempt-plural'),
      type: FieldTypes.NUMBER,
      required: false,
      id: 'root/maxLoginFailAttempts',
      props: {
        'data-testid': 'maxLoginFailAttempts',
        size: 'default',
        style: { width: '100%' },
        autoFocus: true,
      },
      rules: [{ min: 0, type: 'number' }],
    },
    {
      name: 'accessBlockTime',
      label: t('label.access-block-time'),
      type: FieldTypes.NUMBER,
      required: false,
      id: 'root/accessBlockTime',
      props: {
        'data-testid': 'accessBlockTime',
        size: 'default',
        style: { width: '100%' },
      },
      rules: [{ min: 0, type: 'number' }],
    },
    {
      name: 'jwtTokenExpiryTime',
      label: t('label.jwt-token-expiry-time'),
      type: FieldTypes.NUMBER,
      required: false,
      id: 'root/jwtTokenExpiryTime',
      props: {
        'data-testid': 'jwtTokenExpiryTime',
        size: 'default',
        style: { width: '100%' },
      },
      rules: [{ min: 0, type: 'number' }],
    },
  ];

  const handleGoBack = () => navigate(-1);

  const handleSubmit = async (configValues: LoginConfiguration) => {
    try {
      setUpdating(true);
      const configData = {
        config_type: SettingType.LoginConfiguration,
        config_value: configValues,
      };
      await updateSettingsConfig(configData as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.login-configuration'),
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
        {generateFormFields(formFields)}
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
      serviceName={CUSTOM_LOGIN_CONFIG_SERVICE_CATEGORY}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

  useEffect(() => {
    fetchCustomLogoConfig();
  }, []);

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
        entity: t('label.login-configuration'),
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

export default withPageLayout(EditLoginConfiguration);
