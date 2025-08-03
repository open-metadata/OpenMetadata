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

import Icon, { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Actions } from '@react-awesome-query-builder/antd';
import { FieldErrorProps } from '@rjsf/utils';
import { Button, Col, Form, Input, Row, Switch, Typography } from 'antd';
import Card from 'antd/lib/card/Card';
import TextArea from 'antd/lib/input/TextArea';
import classNames from 'classnames';
import { isNull } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PlusIcon } from '../../../assets/svg/x-colored.svg';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import QueryBuilderWidget from '../../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './contract-semantic-form-tab.less';

export const ContractSemanticFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onNext: () => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  nextLabel?: string;
  prevLabel?: string;
}> = ({ onChange, onNext, onPrev, nextLabel, prevLabel, initialValues }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const semanticsData = Form.useWatch('semantics', form);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [queryBuilderAddRule, setQueryBuilderAddRule] = useState<Actions>();
  const addFunctionRef = useRef<((defaultValue?: any) => void) | null>(null);

  const handleAddQueryBuilderRule = (actionFunctions: Actions) => {
    setQueryBuilderAddRule(actionFunctions);
  };

  const handleAddSemantic = () => {
    addFunctionRef.current?.({
      name: '',
      description: '',
      rule: '',
      enabled: true,
    });
    setEditingKey(semanticsData.length);
  };

  const handleAddNewRule = useCallback(() => {
    queryBuilderAddRule?.addRule([]);
  }, [queryBuilderAddRule]);

  useEffect(() => {
    form.setFieldsValue({
      semantics: [
        {
          name: '',
          description: '',
          enabled: true,
          rule: '',
        },
      ],
    });
  }, []);

  useEffect(() => {
    if (initialValues?.semantics) {
      form.setFieldsValue({
        semantics: initialValues.semantics,
      });
    }
  }, [initialValues]);

  return (
    <>
      <Card className="contract-semantic-form-container container bg-grey p-box">
        <div className="d-flex justify-between items-center">
          <div>
            <Typography.Text className="contract-detail-form-tab-title">
              {t('label.semantic-plural')}
            </Typography.Text>
            <Typography.Text className="contract-detail-form-tab-description">
              {t('message.semantics-description')}
            </Typography.Text>
          </div>

          <Button
            className="add-semantic-button"
            disabled={!isNull(editingKey) || !addFunctionRef.current}
            icon={<Icon className="anticon" component={PlusIcon} />}
            type="link"
            onClick={handleAddSemantic}>
            {t('label.add-entity', {
              entity: t('label.semantic-plural'),
            })}
          </Button>
        </div>

        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, allValues) => {
            onChange(allValues);
          }}>
          <Form.List name="semantics">
            {(fields, { add }) => {
              // Store the add function so it can be used outside
              if (!addFunctionRef.current) {
                addFunctionRef.current = add;
              }

              return (
                <>
                  {fields.map((field) => {
                    return (
                      <ExpandableCard
                        cardProps={{
                          className: classNames('expandable-card m-t-md', {
                            'expanded-active-card': editingKey === field.key,
                          }),
                          title: (
                            <div className="w-full d-flex justify-between items-center">
                              {editingKey === field.key ? null : (
                                <>
                                  <div className="d-flex items-center gap-6">
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'enabled']}
                                      valuePropName="checked">
                                      <Switch />
                                    </Form.Item>

                                    <div className="d-flex flex-column">
                                      <Typography.Text>
                                        {semanticsData[field.key]?.name ||
                                          t('label.untitled')}
                                      </Typography.Text>
                                      <Typography.Text type="secondary">
                                        {semanticsData[field.key]
                                          ?.description ||
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
                        defaultExpanded={editingKey === field.key}
                        key={field.key}>
                        {editingKey === field.key ? (
                          <>
                            <Row className="semantic-form-item-content">
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
                                  name={[field.name, 'enabled']}
                                  valuePropName="checked">
                                  <Switch />
                                </Form.Item>
                              </Col>
                              <Col span={24}>
                                <Form.Item
                                  {...field}
                                  label={t('label.add-entity', {
                                    entity: t('label.rule-plural'),
                                  })}
                                  name={[field.name, 'rule']}>
                                  {/* @ts-expect-error because Form.Item will provide value and onChange */}
                                  <QueryBuilderWidget
                                    formContext={{
                                      entityType: EntityType.TABLE,
                                    }}
                                    getQueryActions={handleAddQueryBuilderRule}
                                    id="rule"
                                    name={`${field.name}.rule`}
                                    options={{
                                      addButtonText: t('label.add-semantic'),
                                      removeButtonText: t(
                                        'label.remove-semantic'
                                      ),
                                    }}
                                    registry={{} as FieldErrorProps['registry']}
                                    schema={{
                                      outputType: SearchOutputType.JSONLogic,
                                    }}
                                  />
                                </Form.Item>
                              </Col>
                            </Row>

                            <div className="semantic-form-item-actions">
                              <Button
                                className="add-semantic-button"
                                disabled={!queryBuilderAddRule?.addRule}
                                icon={<Icon component={PlusIcon} />}
                                type="link"
                                onClick={handleAddNewRule}>
                                {t('label.add-new-entity', {
                                  entity: t('label.rule'),
                                })}
                              </Button>

                              <div className="d-flex items-center">
                                <Button onClick={() => setEditingKey(null)}>
                                  {t('label.cancel')}
                                </Button>
                                <Button
                                  className="m-l-md"
                                  type="primary"
                                  onClick={() => setEditingKey(null)}>
                                  {t('label.save')}
                                </Button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="semantic-rule-editor-view-only">
                            {/* @ts-expect-error because Form.Item will provide value and onChange */}
                            <QueryBuilderWidget
                              readonly
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
                </>
              );
            }}
          </Form.List>
        </Form>
      </Card>

      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined />}
          onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
        <Button
          className="contract-next-button"
          type="primary"
          onClick={onNext}>
          {nextLabel ?? t('label.next')}
          <RightOutlined />
        </Button>
      </div>
    </>
  );
};
