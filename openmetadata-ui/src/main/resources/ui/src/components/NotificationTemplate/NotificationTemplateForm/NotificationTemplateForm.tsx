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

import { Form } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';
import { NotificationTemplateFormProps } from './NotificationTemplateForm.interface';

function NotificationTemplateForm({ formRef }: NotificationTemplateFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm(formRef);

  const handleFormSubmit = (values: any) => {
    // Handle form submission logic here
  };

  const formFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'name',
        required: true,
        label: t('label.entity-name', {
          entity: t('label.template'),
        }),
        id: 'root/name',
        type: FieldTypes.TEXT,
        props: {
          'data-testid': 'name',
          initialValue: '',
        },
      },
      {
        name: 'templateSubject',
        required: true,
        label: t('label.template-field-name', {
          fieldName: t('label.subject'),
        }),
        id: 'root/templateSubject',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'templateSubject',
          initialValue: '',
          height: '50px',
        },
      },
      {
        name: 'templateBody',
        required: true,
        label: t('label.template-field-name', {
          fieldName: t('label.body'),
        }),
        id: 'root/templateBody',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'templateBody',
          initialValue: '',
          height: 'auto',
        },
      },
    ],
    [t]
  );

  return (
    <Form
      data-testid="template-form"
      form={form}
      layout="vertical"
      onFinish={handleFormSubmit}>
      {generateFormFields([...formFields])}
    </Form>
  );
}

export default NotificationTemplateForm;
