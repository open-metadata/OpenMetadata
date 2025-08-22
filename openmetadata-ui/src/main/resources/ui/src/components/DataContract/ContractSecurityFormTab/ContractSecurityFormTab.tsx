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
import { Card, Form, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';

export const ContractSecurityFormTab: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const fields: FieldProp[] = [
    {
      label: t('label.access-policy-name'),
      id: 'accessPolicyName',
      name: 'accessPolicyName',
      type: FieldTypes.TEXT,
      required: true,
    },
    {
      label: t('label.data-classification'),
      id: 'dataClassification',
      name: 'dataClassification',
      type: FieldTypes.TAG_SUGGESTION,
      required: true,
    },
  ];

  return (
    <div className="container">
      <Typography.Title level={5}>{t('label.security')}</Typography.Title>
      <Typography.Text type="secondary">
        {t('label.security-description')}
      </Typography.Text>

      <Card>
        <Form form={form} layout="vertical" name="contract-security-form">
          {generateFormFields(fields)}
        </Form>
      </Card>
    </div>
  );
};
