/* eslint-disable no-console */
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
/* eslint-disable i18next/no-literal-string */
import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Collapse,
  Form,
  FormListFieldData,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { CardExpandCollapseIconButton } from '../../common/IconButtons/EditIconButton';
import CloseIcon from '../../Modals/CloseIcon.component';

const CheckField = ({
  onRemove,
  field,
  index,
}: {
  index: number;
  onRemove: () => void;
  field: FormListFieldData;
}) => {
  return (
    <Space className="w-full" key={index}>
      <Form.Item {...field} name={[field.name, 'enabled']}>
        <Switch />
      </Form.Item>
      <Form.Item {...field} name={[field.name, 'field']}>
        <Select options={[]} />
      </Form.Item>
      <Form.Item {...field} name={[field.name, 'condition']}>
        <Select options={[]} />
      </Form.Item>
      <CloseIcon handleCancel={onRemove} />
    </Space>
  );
};

export const ContractSemanticFormTab: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const handleAddCheck = (checkType: 'table' | 'column') => {
    const existingChecks = form.getFieldValue(checkType);
    const newCheck = {
      enabled: true,
      field: 'test',
      condition: 'optional',
    };
    form.setFieldsValue({
      [checkType]: existingChecks ? [...existingChecks, newCheck] : [newCheck],
    });
  };

  console.log(form.getFieldsValue());

  return (
    <div className="container">
      <Form form={form}>
        <Typography.Title level={5}>
          {t('label.semantic-plural')}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('label.semantics-description')}
        </Typography.Text>
        <Collapse>
          <Collapse.Panel
            extra={<CardExpandCollapseIconButton />}
            header={
              <>
                Table checks configuration
                <Typography.Paragraph>
                  Customize fields to run checks on table level. You can add
                  remove or disable checks as needed.
                </Typography.Paragraph>
              </>
            }
            key="table-checks">
            <Form.List name="table">
              {(fields, { remove }) =>
                fields.map((field, index) => (
                  <CheckField
                    field={field}
                    index={index}
                    key={field.key}
                    onRemove={() => remove(index)}
                  />
                ))
              }
            </Form.List>

            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => handleAddCheck('table')}>
              Add check
            </Button>
            <Button>Cancel</Button>
            <Button type="primary">Save</Button>
          </Collapse.Panel>
          <Collapse.Panel
            extra={<CardExpandCollapseIconButton />}
            header="Column checks configuration"
            key="column-checks">
            <Form.List name="column">
              {(fields, { remove }) =>
                fields.map((field, index) => (
                  <CheckField
                    field={field}
                    index={index}
                    key={field.key}
                    onRemove={() => remove(index)}
                  />
                ))
              }
            </Form.List>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => handleAddCheck('column')}>
              Add check
            </Button>
            <Button>Cancel</Button>
            <Button type="primary">Save</Button>
          </Collapse.Panel>
        </Collapse>
      </Form>
    </div>
  );
};
