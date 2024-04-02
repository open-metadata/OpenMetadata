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
import { Button, Col, Form, FormProps, Row, Space } from 'antd';
import { Theme } from 'antd/lib/config-provider/context';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { HEX_COLOR_CODE_REGEX } from '../../constants/regex.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { FieldProp, FieldTypes } from '../../interface/FormUtils.interface';
import { generateFormFields } from '../../utils/formUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';

const BrandColorConfigSettingsPage = () => {
  const history = useHistory();
  const { theme, setTheme } = useApplicationStore();
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        'Brand Color'
      ),
    []
  );

  const handleSave: FormProps['onFinish'] = (values: Theme) => {
    setTheme(values);
  };

  const formFields: FieldProp[] = [
    {
      name: 'primaryColor',
      id: 'root/color',
      label: 'Primary Color',
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
    },
    {
      name: 'errorColor',
      id: 'root/color',
      label: 'Error Color',
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
    },
    {
      name: 'successColor',
      id: 'root/color',
      label: 'Success Color',
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
    },
    {
      name: 'warningColor',
      id: 'root/color',
      label: 'Warning Color',
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
    },
    {
      name: 'infoColor',
      id: 'root/color',
      label: 'Info Color',
      required: false,
      type: FieldTypes.COLOR_PICKER,
      rules: [
        {
          pattern: HEX_COLOR_CODE_REGEX,
          message: t('message.hex-color-validation'),
        },
      ],
    },
  ];

  return (
    <PageLayoutV1 pageTitle={t('label.custom-logo')}>
      <Row align="middle" className="page-container" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Row align="middle" justify="space-between">
            <Col>
              <PageHeader
                data={{
                  header: 'Brand Color',
                  subHeader:
                    'Customize OpenMetadata with your company brand color',
                }}
              />
            </Col>
          </Row>
        </Col>
        <Col offset={6} span={12}>
          <Form
            form={form}
            initialValues={theme}
            layout="vertical"
            onFinish={handleSave}>
            {generateFormFields(formFields)}

            <Space
              className="w-full justify-end"
              data-testid="cta-buttons"
              size={16}>
              <Button
                data-testid="cancel"
                type="link"
                onClick={() => history.goBack()}>
                {t('label.cancel')}
              </Button>
              <Button data-testid="save" htmlType="submit" type="primary">
                {t('label.save')}
              </Button>
            </Space>
          </Form>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default BrandColorConfigSettingsPage;
