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

import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { FieldErrorProps } from '@rjsf/utils';
import { Button, Col, Form, Input, Row, Switch, Typography } from 'antd';
import Card from 'antd/lib/card/Card';
import TextArea from 'antd/lib/input/TextArea';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import QueryBuilderWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';

export const ContractSemanticFormTab: React.FC<{
  onNext: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  nextLabel?: string;
  prevLabel?: string;
}> = ({ onNext, onPrev, nextLabel, prevLabel }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      semantics: [
        {
          name: '',
          description: '',
          enabled: false,
          rule: '',
        },
      ],
    });
  }, []);

  const handleNext = () => {
    const semantics = form.getFieldValue('semantics') as SemanticsRule[];

    const validSemantics = semantics.filter((semantic) => {
      return semantic.name && semantic.rule;
    });

    onNext({
      semantics: validSemantics,
    });
  };

  return (
    <>
      <Card className="container bg-grey p-box">
        <Typography.Title level={5}>
          {t('label.semantic-plural')}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('label.semantics-description')}
        </Typography.Text>
        <Form form={form} layout="vertical">
          <Form.List name="semantics">
            {(fields, { add }) => (
              <>
                {fields.map((field) => (
                  <Row key={field.key}>
                    <Col span={4}>
                      <Form.Item
                        {...field}
                        label={t('label.enabled')}
                        name={[field.name, 'enabled']}>
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={20}>
                      <Form.Item
                        {...field}
                        label={t('label.name')}
                        name={[field.name, 'name']}>
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        {...field}
                        label={t('label.description')}
                        name={[field.name, 'description']}>
                        <TextArea />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        {...field}
                        label={t('label.rule')}
                        name={[field.name, 'rule']}>
                        <QueryBuilderWidget
                          formContext={{
                            entityType: EntityType.TABLE,
                          }}
                          id="rule"
                          label={t('label.rule')}
                          name={`${field.name}.rule`}
                          options={{
                            addButtonText: t('label.add-semantic'),
                            removeButtonText: t('label.remove-semantic'),
                          }}
                          registry={{} as FieldErrorProps['registry']}
                          schema={{
                            outputType: SearchOutputType.JSONLogic,
                          }}
                          // value=""
                          onBlur={() => {
                            // TODO: Implement onBlur
                          }}
                          // onChange={handleChange}
                          onFocus={() => {
                            // TODO: Implement onFocus
                          }}
                        />
                      </Form.Item>
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
      </Card>

      <div className="d-flex justify-between m-t-md">
        <Button icon={<ArrowLeftOutlined />} onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
        <Button type="primary" onClick={handleNext}>
          {nextLabel ?? t('label.next')}
          <ArrowRightOutlined />
        </Button>
      </div>
    </>
  );
};
