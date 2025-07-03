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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';

export const ContractDetailFormTab: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const fields: FieldProp[] = [
    {
      label: t('label.contract-title'),
      id: 'contractTitle',
      name: 'contractTitle',
      type: FieldTypes.TEXT,
      required: true,
    },
    {
      label: t('label.description'),
      id: 'contractDescription',
      name: 'contractDescription',
      type: FieldTypes.DESCRIPTION,
      required: true,
    },
    {
      label: t('label.owner'),
      id: 'owner',
      name: 'owner',
      type: FieldTypes.USER_TEAM_SELECT,
      required: false,
      props: {
        hasPermission: true,
        children: (
          <Button
            data-testid="add-owner"
            icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
            size="small"
            type="primary"
          />
        ),
        multiple: { user: true, team: false },
      },
      formItemLayout: FormItemLayout.HORIZONTAL,
      formItemProps: {
        valuePropName: 'owners',
        trigger: 'onUpdate',
      },
    },
    {
      label: t('label.enable-incident-management'),
      id: 'enableIncidentManagement',
      name: 'enableIncidentManagement',
      type: FieldTypes.CHECK_BOX,
      required: true,
    },
  ];

  return (
    <div className="container bg-grey">
      <div>
        <Typography.Title className="m-0" level={5}>
          {t('label.contract-detail-plural')}
        </Typography.Title>
        <Typography.Paragraph className="m-0 text-sm" type="secondary">
          {t('message.contract-detail-plural-description')}
        </Typography.Paragraph>
      </div>
      <Card>
        <Form form={form} layout="vertical" name="contract-detail-form">
          {generateFormFields(fields)}
        </Form>
      </Card>
    </div>
  );
};
