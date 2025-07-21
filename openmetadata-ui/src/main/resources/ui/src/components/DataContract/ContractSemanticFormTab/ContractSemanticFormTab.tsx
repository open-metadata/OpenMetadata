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
import { FieldErrorProps } from '@rjsf/utils';
import { Button, Col, Form, Input, Row, Switch, Typography } from 'antd';
import TextArea from 'antd/lib/input/TextArea';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import QueryBuilderWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import CloseIcon from '../../Modals/CloseIcon.component';

export const ContractSemanticFormTab: React.FC<{
  onNext: (data: Partial<DataContract>) => void;
  onPrev: () => void;
}> = ({ onNext, onPrev }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [semantics, setSemantics] = useState<SemanticsRule[]>([]);
  const handleChange = (value: SemanticsRule[]) => {
    console.log(value);
    setSemantics(value);
  };

  return (
    <div className="container">
      <Typography.Title level={5}>
        {t('label.semantic-plural')}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t('label.semantics-description')}
      </Typography.Text>
      <Form form={form} layout="vertical">
        <Form.List name="semantics">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Row key={field.key}>
                  <Col>
                    <Form.Item {...field} name={[field.name, 'enabled']}>
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col>
                    <Form.Item {...field} name={[field.name, 'name']}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col>
                    <Form.Item {...field} name={[field.name, 'description']}>
                      <TextArea />
                    </Form.Item>
                  </Col>
                  <Col>
                    <Form.Item {...field} name={[field.name, 'rule']}>
                      <QueryBuilderWidget
                        id="rule"
                        label={t('label.rule')}
                        name={`${field.name}.rule`}
                        options={{
                          addButtonText: t('label.add-semantic'),
                          removeButtonText: t('label.remove-semantic'),
                        }}
                        registry={{} as FieldErrorProps['registry']}
                        schema={{}}
                        value=""
                        onBlur={() => {
                          // TODO: Implement onBlur
                        }}
                        onChange={handleChange}
                        onFocus={() => {
                          // TODO: Implement onFocus
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col>
                    <CloseIcon handleCancel={() => remove(field.name)} />
                  </Col>
                </Row>
              ))}
              <Button
                onClick={() =>
                  add({
                    name: '',
                    description: '',
                    rule: '',
                    enaebled: '',
                  })
                }
              />
            </>
          )}
        </Form.List>
      </Form>

      <div className="d-flex justify-end m-t-md">
        <Button type="primary" onClick={() => onNext({ semantics })}>
          {t('label.next')}
        </Button>
        <Button onClick={onPrev}>{t('label.prev')}</Button>
      </div>
    </div>
  );
};
