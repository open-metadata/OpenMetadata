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

import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { FieldErrorProps } from '@rjsf/utils';
import { Button, Col, Form, Input, Row, Switch, Typography } from 'antd';
import Card from 'antd/lib/card/Card';
import TextArea from 'antd/lib/input/TextArea';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import QueryBuilderWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './contract-semantic-form-tab.less';

export const ContractSemanticFormTab: React.FC<{
  onNext: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  nextLabel?: string;
  prevLabel?: string;
}> = ({ onNext, onPrev, nextLabel, prevLabel }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const semanticsData = Form.useWatch('semantics', form);
  const [editingKey, setEditingKey] = useState<number | null>(null);

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
        <div className="d-flex justify-between items-center">
          <div>
            <Typography.Title level={5}>
              {t('label.semantic-plural')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('message.semantics-description')}
            </Typography.Text>
          </div>
        </div>

        <Form form={form} layout="vertical">
          <Form.List name="semantics">
            {(fields, { add }) => (
              <>
                {fields.map((field) => {
                  return (
                    <ExpandableCard
                      cardProps={{
                        className: 'm-t-md',
                        title: (
                          <div className="w-full d-flex justify-between items-center">
                            {editingKey === field.key ? null : (
                              <>
                                <div className="d-flex items-center gap-6">
                                  <Switch
                                    checked={semanticsData[field.key].enabled}
                                  />
                                  <div className="d-flex flex-column">
                                    <Typography.Text>
                                      {semanticsData[field.key]?.name ||
                                        t('label.untitled')}
                                    </Typography.Text>
                                    <Typography.Text type="secondary">
                                      {semanticsData[field.key]?.description ||
                                        t('label.no-description')}
                                    </Typography.Text>
                                  </div>
                                </div>
                                <EditIconButton
                                  newLook
                                  data-testid={`edit-semantic=${field.key}`}
                                  size="small"
                                  onClick={() => setEditingKey(field.key)}
                                />
                              </>
                            )}
                          </div>
                        ),
                      }}
                      key={field.key}>
                      {editingKey === field.key ? (
                        <Row>
                          <Col span={24}>
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
                              label={t('label.enabled')}
                              name={[field.name, 'enabled']}>
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col span={24}>
                            <Form.Item
                              {...field}
                              label={t('label.add-entity', {
                                entity: t('label.rule'),
                              })}
                              name={[field.name, 'rule']}>
                              {/* @ts-expect-error because Form.Item will provide value and onChange */}
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
                              />
                            </Form.Item>
                          </Col>

                          <Col className="d-flex justify-end" span={24}>
                            <Button onClick={() => setEditingKey(null)}>
                              {t('label.cancel')}
                            </Button>
                            <Button
                              className="m-l-md"
                              type="primary"
                              onClick={() => setEditingKey(null)}>
                              {t('label.save')}
                            </Button>
                          </Col>
                        </Row>
                      ) : (
                        <div className="semantic-rule-editor-view-only">
                          {/* @ts-expect-error because Form.Item will provide value and onChange */}
                          <QueryBuilderWidget
                            formContext={{
                              entityType: EntityType.TABLE,
                            }}
                            registry={{} as FieldErrorProps['registry']}
                            schema={{
                              outputType: SearchOutputType.JSONLogic,
                            }}
                            value={semanticsData[field.key]?.rule ?? {}}
                          />
                        </div>
                      )}
                    </ExpandableCard>
                  );
                })}

                <div className="d-flex justify-between">
                  <Button
                    className="m-t-md"
                    disabled={!!editingKey}
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={() =>
                      add({
                        name: '',
                        description: '',
                        rule: '',
                        enabled: false,
                      })
                    }>
                    {t('label.add-entity', {
                      entity: t('label.semantic-plural'),
                    })}
                  </Button>
                </div>
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
