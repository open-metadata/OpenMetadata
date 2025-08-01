/*
 *  Copyright 2022 Collate.
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

import { Button, Form, FormProps, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../../../constants/regex.constants';
import {
  FieldProp,
  FieldTypes,
} from '../../../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../../../utils/formUtils';
import { ConfigureServiceProps } from './Steps.interface';

const ConfigureService = ({
  serviceName,
  onBack,
  onNext,
}: ConfigureServiceProps) => {
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const formFields: FieldProp[] = [
    {
      name: 'name',
      id: 'root/name',
      required: true,
      label: t('label.service-name'),
      type: FieldTypes.TEXT,
      rules: [
        {
          pattern: ENTITY_NAME_REGEX,
          message: t('message.entity-name-validation'),
        },
      ],
      props: {
        'data-testid': 'service-name',
        autoFocus: true,
      },
      placeholder: t('label.service-name'),
      formItemProps: {
        initialValue: serviceName,
      },
    },
    {
      name: 'description',
      required: false,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: '',
      },
    },
  ];

  const handleSubmit: FormProps['onFinish'] = (data) => {
    onNext({ name: data.name, description: data.description ?? '' });
  };

  return (
    <Form
      data-testid="configure-service-container"
      form={form}
      layout="vertical"
      onFinish={handleSubmit}>
      {generateFormFields(formFields)}
      <Space className="w-full justify-end">
        <Button data-testid="back-button" type="link" onClick={onBack}>
          {t('label.back')}
        </Button>

        <Button data-testid="next-button" htmlType="submit" type="primary">
          {t('label.next')}
        </Button>
      </Space>
    </Form>
  );
};

export default ConfigureService;
