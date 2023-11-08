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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import Loader from '../../../components/Loader/Loader';
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
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import {
  getLoginConfig,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { generateFormFields } from '../../../utils/formUtils';
import { getSettingPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const EditLoginConfiguration = () => {
  const { t } = useTranslation();
  const history = useHistory();
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
          GlobalSettingsMenuCategory.OPEN_METADATA,
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
      label: t('label.max-login-fail-attampt-plural'),
      type: FieldTypes.NUMBER,
      required: false,
      id: 'root/maxLoginFailAttempts',
      props: {
        'data-testid': 'maxLoginFailAttempts',
        size: 'default',
        style: { width: '100%' },
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

  const handleGoBack = () => history.goBack();

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
    <div className="max-width-md w-9/10 service-form-container">
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
    </div>
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
      firstPanel={{ children: firstPanelChildren, minWidth: 700, flex: 0.7 }}
      pageTitle={t('label.edit-entity', { entity: t('label.service') })}
      secondPanel={{
        children: secondPanelChildren,
        className: 'service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default EditLoginConfiguration;
