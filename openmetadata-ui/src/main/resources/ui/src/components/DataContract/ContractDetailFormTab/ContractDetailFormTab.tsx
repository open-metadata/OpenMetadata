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
import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { EntityReference } from '../../../generated/type/entityReference';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { generateFormFields } from '../../../utils/formUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';

export const ContractDetailFormTab: React.FC<{
  initialValues?: Partial<DataContract>;
  onNext: (formData: Partial<DataContract>) => Promise<void>;
  nextLabel?: string;
}> = ({ initialValues, onNext, nextLabel }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const owners = Form.useWatch<EntityReference[]>('owners', form);

  const fields: FieldProp[] = [
    {
      label: t('label.contract-title'),
      id: 'name',
      name: 'name',
      type: FieldTypes.TEXT,
      required: true,
      props: {
        defaultValue: initialValues?.name ?? '',
      },
    },
    {
      label: t('label.description'),
      id: 'description',
      name: 'description',
      type: FieldTypes.DESCRIPTION,
      required: false,
      props: {
        'data-testid': 'description',
        initialValue: initialValues?.description ?? '',
      },
    },
    {
      label: t('label.owner-plural'),
      id: 'owners',
      name: 'owners',
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
  ];

  const handleSubmit = () => {
    form.submit();
  };

  return (
    <>
      <Card className="container bg-grey p-box">
        <div className="m-b-sm">
          <Typography.Title className="m-0" level={5}>
            {t('label.contract-detail-plural')}
          </Typography.Title>
          <Typography.Paragraph className="m-0 text-sm" type="secondary">
            {t('message.contract-detail-plural-description')}
          </Typography.Paragraph>
        </div>

        <Form
          className="bg-white p-box"
          form={form}
          layout="vertical"
          onFinish={onNext}>
          {generateFormFields(fields)}

          {owners?.length > 0 && <OwnerLabel owners={owners} />}
        </Form>
      </Card>
      <div className="d-flex justify-end m-t-md">
        <Button htmlType="submit" type="primary" onClick={handleSubmit}>
          {nextLabel ?? t('label.next')}
          <ArrowRightOutlined />
        </Button>
      </div>
    </>
  );
};
