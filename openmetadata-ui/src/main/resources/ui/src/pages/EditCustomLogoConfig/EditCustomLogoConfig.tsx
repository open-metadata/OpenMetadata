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
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../components/Loader/Loader';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import {
  CUSTOM_LOGO_CONFIG_SERVICE_CATEGORY,
  OPEN_METADATA,
} from '../../constants/service-guide.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { LogoConfiguration } from '../../generated/configuration/applicationConfiguration';
import { Settings, SettingType } from '../../generated/settings/settings';
import { FieldProp, FieldTypes } from '../../interface/FormUtils.interface';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { generateFormFields } from '../../utils/formUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const EditCustomLogoConfig = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [form] = Form.useForm();
  const [activeField, setActiveField] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchCustomLogoConfig = async () => {
    try {
      setLoading(true);

      const { data } = await getSettingsConfigFromConfigType(
        SettingType.CustomLogoConfiguration
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
        name: t('label.custom-logo'),
        url: getSettingPath(
          GlobalSettingsMenuCategory.OPEN_METADATA,
          GlobalSettingOptions.CUSTOM_LOGO
        ),
      },
      {
        name: t('label.edit-entity', {
          entity: t('label.custom-logo-configuration'),
        }),
        url: '',
      },
    ],
    []
  );

  const formFields: FieldProp[] = [
    {
      name: 'customLogoUrlPath',
      label: t('label.logo-url'),
      type: FieldTypes.TEXT,
      required: false,
      id: 'root/customLogoUrlPath',
      props: {
        'data-testid': 'customLogoUrlPath',
      },
      rules: [
        {
          type: 'url',
          message: t('message.entity-is-not-valid-url', {
            entity: t('label.logo-url'),
          }),
        },
      ],
    },
    {
      name: 'customMonogramUrlPath',
      label: t('label.monogram-url'),
      type: FieldTypes.TEXT,
      required: false,
      id: 'root/customMonogramUrlPath',
      props: {
        'data-testid': 'customMonogramUrlPath',
      },
      rules: [
        {
          type: 'url',
          message: t('message.entity-is-not-valid-url', {
            entity: t('label.monogram-url'),
          }),
        },
      ],
    },
  ];

  const handleGoBack = () => history.goBack();

  const handleSubmit = async (configValues: LogoConfiguration) => {
    try {
      setUpdating(true);
      const configData = {
        config_type: SettingType.CustomLogoConfiguration,
        config_value: configValues,
      };
      await updateSettingsConfig(configData as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.custom-logo-configuration'),
        })
      );
      handleGoBack();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setUpdating(false);
    }
  };

  const firstPanelChildren = (
    <div className="max-width-md w-9/10 service-form-container">
      <TitleBreadcrumb titleLinks={breadcrumb} />
      <Form
        className="m-t-md"
        data-testid="custom-logo-config-form"
        form={form}
        layout="vertical"
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
      serviceName={CUSTOM_LOGO_CONFIG_SERVICE_CATEGORY}
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

export default EditCustomLogoConfig;
