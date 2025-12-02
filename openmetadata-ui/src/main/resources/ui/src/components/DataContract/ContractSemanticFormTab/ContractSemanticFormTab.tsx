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

import Icon from '@ant-design/icons';
import { Actions, JsonTree } from '@react-awesome-query-builder/antd';
import {
  Button,
  Col,
  Form,
  FormListFieldData,
  Input,
  Row,
  Switch,
  Typography,
} from 'antd';
import Card from 'antd/lib/card/Card';
import TextArea from 'antd/lib/input/TextArea';
import classNames from 'classnames';
import { isEmpty, isNull, isNumber } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { ReactComponent as RightIcon } from '../../../assets/svg/right-arrow.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/x-colored.svg';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import { getSematicRuleFields } from '../../../utils/DataContract/DataContractUtils';
import jsonLogicSearchClassBase from '../../../utils/JSONLogicSearchClassBase';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import QueryBuilderWidgetV1 from '../../common/QueryBuilderWidgetV1/QueryBuilderWidgetV1';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import './contract-semantic-form-tab.less';

export const ContractSemanticFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onNext: () => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({
  onChange,
  onNext,
  onPrev,
  initialValues,
  buttonProps: { nextLabel, prevLabel, isNextVisible = true },
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const semanticsFormData: SemanticsRule[] = Form.useWatch('semantics', form);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [queryBuilderAddRule, setQueryBuilderAddRule] = useState<Actions>();
  const addFunctionRef = useRef<
    | ((defaultValue?: SemanticsRule, insertIndex?: number | undefined) => void)
    | null
  >(null);

  const handleAddQueryBuilderRule = (actionFunctions: Actions) => {
    setQueryBuilderAddRule(actionFunctions);
  };

  const handleAddSemantic = () => {
    addFunctionRef.current?.({
      enabled: true,
      rule: '',
    } as SemanticsRule);
    setEditingKey(semanticsFormData?.length ?? 0);
  };

  const handleDeleteSemantic = useCallback(
    (key: number) => {
      const filteredValue =
        semanticsFormData
          ?.filter((_item, idx) => idx !== key)
          ?.filter(Boolean) ?? [];
      form.setFieldsValue({ semantics: filteredValue });
      onChange({ semantics: filteredValue });
    },
    [semanticsFormData]
  );

  const handleAddNewRule = useCallback(() => {
    queryBuilderAddRule?.addRule([]);
  }, [queryBuilderAddRule]);

  const handleQueryBuilderChange = (
    field: FormListFieldData,
    rule: string,
    tree?: JsonTree
  ) => {
    const modifyRule = JSON.stringify(
      jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
        JSON.parse(rule)
      )
    );
    form.setFields([
      {
        name: ['semantics', field.name, 'rule'],
        value: modifyRule,
        errors: modifyRule
          ? []
          : [
              t('message.field-text-is-required', {
                fieldText: t('label.rule'),
              }),
            ],
      },
    ]);
    form.setFieldsValue({
      semantics: semanticsFormData?.map((item, idx) =>
        idx === field.name
          ? {
              ...item,
              rule: modifyRule,
              jsonTree: tree && JSON.stringify(tree),
            }
          : item
      ),
    });
  };

  useEffect(() => {
    if (isEmpty(initialValues?.semantics)) {
      form.setFieldsValue({
        semantics: [
          {
            enabled: true,
          },
        ],
      });
    } else {
      form.setFieldsValue({
        semantics: initialValues?.semantics,
      });
    }
    setEditingKey(0);
  }, [initialValues]);

  // Remove extension field from common config
  const queryBuilderFields = useMemo(() => {
    return getSematicRuleFields();
  }, []);

  const handleSaveRule = async () => {
    try {
      await form.validateFields({ recursive: true });
      setEditingKey(null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Validation failed:', error);
    }
  };

  const editFieldData = isNumber(editingKey)
    ? semanticsFormData?.[editingKey]
    : undefined;

  useEffect(() => {
    onChange({ semantics: semanticsFormData });
  }, [semanticsFormData]);

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
            data-testid="add-semantic-button"
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
          className="new-form-style"
          form={form}
          layout="vertical"
          validateMessages={VALIDATION_MESSAGES}>
          <Form.List name="semantics">
            {(fields, { add }) => {
              // Store the add function so it can be used outside
              addFunctionRef.current ??= add;

              return fields.map((field) => {
                return (
                  <ExpandableCard
                    cardProps={{
                      className: classNames('expandable-card m-t-md', {
                        'expanded-active-card': editingKey === field.name,
                      }),
                      title: (
                        <div className="w-full d-flex justify-between items-center">
                          {editingKey === field.key ? null : (
                            <div className="semantic-form-item-title-container">
                              <div className="d-flex items-center gap-6">
                                <Form.Item
                                  {...field}
                                  className="enable-form-item"
                                  name={[field.name, 'enabled']}
                                  valuePropName="checked">
                                  <Switch />
                                </Form.Item>

                                <div className="d-flex flex-column">
                                  <Typography.Text className="semantic-form-item-title">
                                    {semanticsFormData?.[field.key]?.name ||
                                      t('label.untitled')}
                                  </Typography.Text>
                                  <Typography.Text
                                    ellipsis
                                    className="semantic-form-item-description">
                                    {semanticsFormData?.[field.key]
                                      ?.description ||
                                      t('label.no-description')}
                                  </Typography.Text>
                                </div>
                              </div>
                              <div className="d-flex items-center gap-2">
                                <EditIconButton
                                  newLook
                                  className="edit-expand-button"
                                  data-testid={`edit-semantic-${field.key}`}
                                  size="middle"
                                  onClick={() => setEditingKey(field.key)}
                                />

                                <Button
                                  danger
                                  className="delete-expand-button"
                                  data-testid={`delete-semantic-${field.key}`}
                                  icon={<DeleteIcon />}
                                  size="middle"
                                  onClick={() => {
                                    handleDeleteSemantic(field.key);
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ),
                    }}
                    dataTestId={`contract-semantics-card-${field.key}`}
                    defaultExpanded={editingKey === field.name}
                    key={field.name}>
                    {editingKey === field.name ? (
                      <>
                        <Row className="semantic-form-item-content">
                          <Col span={24}>
                            <Form.Item
                              {...field}
                              label={t('label.name')}
                              name={[field.name, 'name']}
                              rules={[
                                {
                                  required: true,
                                },
                              ]}>
                              <Input
                                placeholder={t(
                                  'label.please-enter-entity-name',
                                  {
                                    entity: t('label.semantic'),
                                  }
                                )}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={24}>
                            <Form.Item
                              {...field}
                              label={t('label.description')}
                              name={[field.name, 'description']}
                              rules={[
                                {
                                  required: true,
                                },
                              ]}>
                              <TextArea
                                placeholder={t('label.please-enter-value', {
                                  name: t('label.description'),
                                })}
                                rows={4}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={24}>
                            <QueryBuilderWidgetV1
                              entityType={EntityType.TABLE}
                              fields={queryBuilderFields}
                              getQueryActions={handleAddQueryBuilderRule}
                              key={field.name}
                              label={t('label.rule')}
                              outputType={SearchOutputType.JSONLogic}
                              tree={
                                editFieldData?.jsonTree
                                  ? JSON.parse(editFieldData?.jsonTree)
                                  : undefined
                              }
                              value={editFieldData?.rule ?? ''}
                              onChange={(rule: string, tree?: JsonTree) =>
                                handleQueryBuilderChange(field, rule, tree)
                              }
                            />
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
                              data-testid="save-semantic-button"
                              type="primary"
                              onClick={handleSaveRule}>
                              {t('label.save')}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="semantic-rule-editor-view-only">
                        <QueryBuilderWidgetV1
                          readonly
                          entityType={EntityType.TABLE}
                          fields={queryBuilderFields}
                          key={field.name}
                          outputType={SearchOutputType.JSONLogic}
                          tree={
                            semanticsFormData?.[field.name]?.jsonTree
                              ? JSON.parse(
                                  semanticsFormData?.[field.name]
                                    ?.jsonTree as unknown as string
                                )
                              : undefined
                          }
                          value={semanticsFormData?.[field.name]?.rule}
                        />
                      </div>
                    )}
                  </ExpandableCard>
                );
              });
            }}
          </Form.List>
        </Form>
      </Card>

      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>

        {isNextVisible && (
          <Button
            className="contract-next-button"
            type="primary"
            onClick={onNext}>
            {nextLabel ?? t('label.next')}
            <Icon component={RightIcon} />
          </Button>
        )}
      </div>
    </>
  );
};
