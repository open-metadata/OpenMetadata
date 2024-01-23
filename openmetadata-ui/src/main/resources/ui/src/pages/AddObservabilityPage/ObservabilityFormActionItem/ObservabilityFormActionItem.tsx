/*
 *  Copyright 2024 Collate.
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

import { CloseOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  FormListFieldData,
  Row,
  Select,
  Switch,
  Typography,
} from 'antd';
import { isEmpty, isNil, map, startCase } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AsyncSelect } from '../../../components/AsyncSelect/AsyncSelect';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { PipelineState } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import {
  Effect,
  EventFilterRule,
} from '../../../generated/events/eventSubscription';
import { InputType } from '../../../generated/events/filterResourceDescriptor';
import { searchData } from '../../../rest/miscAPI';
import { listLengthValidator } from '../../../utils/Alerts/AlertsUtil';
import { getEntityName } from '../../../utils/EntityUtils';
import { getSearchIndexFromEntityType } from '../ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import { ObservabilityFormActionItemProps } from './ObservabilityFormActionItem.interface';

function ObservabilityFormActionItem({
  heading,
  subHeading,
  filterResources,
}: Readonly<ObservabilityFormActionItemProps>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();

  // Watchers
  const actions = Form.useWatch<EventFilterRule[]>(['input', 'actions'], form);
  const [triggerValue] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const supportedActions = useMemo(
    () =>
      filterResources.find((resource) => resource.name === triggerValue)
        ?.supportedActions,
    [filterResources, triggerValue]
  );

  const searchEntity = useCallback(
    async (search: string, searchIndex: SearchIndex) => {
      try {
        const response = await searchData(
          search,
          1,
          PAGE_SIZE_LARGE,
          '',
          '',
          '',
          searchIndex
        );

        return response.data.hits.hits.map((d) => ({
          label: getEntityName(d._source),
          value: d._source.fullyQualifiedName,
        }));
      } catch (error) {
        return [];
      }
    },
    []
  );

  const getEntityByFQN = useCallback(
    async (searchText: string) => {
      return searchEntity(
        searchText,
        getSearchIndexFromEntityType(triggerValue)
      );
    },
    [searchEntity, triggerValue]
  );

  const getTableSuggestions = useCallback(
    async (searchText: string) => {
      return searchEntity(searchText, SearchIndex.TABLE);
    },
    [searchEntity, triggerValue]
  );

  const getDomainOptions = useCallback(
    async (searchText: string) => {
      return searchEntity(searchText, SearchIndex.DOMAIN);
    },
    [searchEntity]
  );

  // Run time values needed for conditional rendering
  const functions = useMemo(
    () =>
      supportedActions?.map((func) => ({
        label: getEntityName(func),
        value: func.name,
        disabled: actions?.some((d) => d.name === func.name),
      })),
    [supportedActions, actions]
  );

  const shouldShowAddAction = useCallback(
    (fields: FormListFieldData[]) =>
      fields.length < (supportedActions?.length ?? 1),
    [supportedActions]
  );

  const getFieldByArgumentType = useCallback(
    (fieldName: number, argument: string, fieldNumber: number) => {
      switch (argument) {
        case 'fqnList':
          return (
            <>
              <Col key="fqn-list-select" span={11}>
                <Form.Item
                  className="w-full"
                  name={[fieldName, 'arguments', fieldNumber, 'input']}
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.entity-list', {
                          entity: t('label.fqn-uppercase'),
                        }),
                      }),
                    },
                  ]}>
                  <AsyncSelect
                    api={getEntityByFQN}
                    data-testid="fqn-list-select"
                    mode="multiple"
                    placeholder={t('label.search-by-type', {
                      type: t('label.fqn-uppercase'),
                    })}
                    showArrow={false}
                  />
                </Form.Item>
              </Col>
              <Form.Item
                hidden
                initialValue="fqnList"
                name={[fieldName, 'arguments', fieldNumber, 'name']}
              />
            </>
          );

        case 'domainList':
          return (
            <>
              <Col key="domain-select" span={11}>
                <Form.Item
                  className="w-full"
                  name={[fieldName, 'arguments', fieldNumber, 'input']}
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.entity-list', {
                          entity: t('label.domain'),
                        }),
                      }),
                    },
                  ]}>
                  <AsyncSelect
                    api={getDomainOptions}
                    data-testid="domain-select"
                    mode="multiple"
                    placeholder={t('label.search-by-type', {
                      type: t('label.domain-lowercase'),
                    })}
                  />
                </Form.Item>
              </Col>
              <Form.Item
                className="d-none"
                initialValue="domainList"
                name={[fieldName, 'arguments', fieldNumber, 'name']}
              />
            </>
          );

        case 'tableNameList':
          return (
            <>
              <Col key="domain-select" span={11}>
                <Form.Item
                  className="w-full"
                  name={[fieldName, 'arguments', fieldNumber, 'input']}
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.entity-list', {
                          entity: t('label.entity-name', {
                            entity: t('label.table'),
                          }),
                        }),
                      }),
                    },
                  ]}>
                  <AsyncSelect
                    api={getTableSuggestions}
                    data-testid="table-select"
                    mode="multiple"
                    placeholder={t('label.search-by-type', {
                      type: t('label.table-lowercase'),
                    })}
                  />
                </Form.Item>
              </Col>
              <Form.Item
                className="d-none"
                initialValue="tableNameList"
                name={[fieldName, 'arguments', fieldNumber, 'name']}
              />
            </>
          );

        case 'pipelineStateList':
          return (
            <Col key="pipeline-state-select" span={11}>
              <Form.Item
                className="w-full"
                name={[fieldName, 'arguments', fieldNumber, 'input']}
                rules={[
                  {
                    required: true,
                    message: t('message.field-text-is-required', {
                      fieldText: t('label.entity-list', {
                        entity: t('label.pipeline-state'),
                      }),
                    }),
                  },
                ]}>
                <Select
                  data-testid="pipeline-status-select"
                  mode="multiple"
                  options={map(PipelineState, (state) => ({
                    label: startCase(state),
                    value: state,
                  }))}
                  placeholder={t('label.select-field', {
                    field: t('label.pipeline-state'),
                  })}
                />
              </Form.Item>

              <Form.Item
                hidden
                initialValue="pipelineStateList"
                name={[fieldName, 'arguments', fieldNumber, 'name']}
              />
            </Col>
          );

        case 'testResultList':
          return (
            <Col key="test-result-select" span={11}>
              <Form.Item
                className="w-full"
                name={[fieldName, 'arguments', fieldNumber, 'input']}
                rules={[
                  {
                    required: true,
                    message: t('message.field-text-is-required', {
                      fieldText: t('label.entity-list', {
                        entity: t('label.test-case-result'),
                      }),
                    }),
                  },
                ]}>
                <Select
                  data-testid="test-result-select"
                  mode="multiple"
                  options={map(['success', 'aborted', 'failed'], (state) => ({
                    label: startCase(state),
                    value: state,
                  }))}
                  placeholder={t('label.select-field', {
                    field: t('label.test-case-result'),
                  })}
                />
              </Form.Item>

              <Form.Item
                hidden
                initialValue="testResultList"
                name={[fieldName, 'arguments', fieldNumber, 'name']}
              />
            </Col>
          );

        default:
          return (
            <Form.Item
              hidden
              initialValue={[]}
              name={[fieldName, 'arguments']}
            />
          );
      }
    },
    [getEntityByFQN, getDomainOptions]
  );

  // Render condition field based on function selected
  const getConditionField = (condition: string, name: number) => {
    const selectedAction = supportedActions?.find(
      (action) => action.name === condition
    );
    const requireInput = selectedAction?.inputType === InputType.Runtime;
    const requiredArguments = selectedAction?.arguments;

    if (!requireInput) {
      return <></>;
    }

    return (
      <>
        {requiredArguments?.map((argument, index) => {
          return getFieldByArgumentType(name, argument, index);
        })}
      </>
    );
  };

  return (
    <Card className="trigger-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text>{heading}</Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {subHeading}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Form.List
            name={['input', 'actions']}
            rules={[
              {
                validator: listLengthValidator(t('label.action')),
              },
            ]}>
            {(fields, { add, remove }, { errors }) => (
              <Row gutter={[16, 16]}>
                {fields.map(({ key, name }) => (
                  <Col key={`observability-${key}`} span={24}>
                    <Row gutter={[8, 8]}>
                      <Col span={11}>
                        <Form.Item
                          key={`action-${key}`}
                          name={[name, 'name']}
                          rules={[
                            {
                              required: true,
                              message: t('message.field-text-is-required', {
                                fieldText: t('label.action'),
                              }),
                            },
                          ]}>
                          <Select
                            options={functions}
                            placeholder={t('label.select-field', {
                              field: t('label.action'),
                            })}
                          />
                        </Form.Item>
                      </Col>
                      {!isNil(supportedActions) &&
                        !isEmpty(actions) &&
                        actions[name] &&
                        getConditionField(actions[name].name ?? '', name)}
                      <Col span={2}>
                        <Button
                          data-testid={`remove-action-rule-${name}`}
                          icon={<CloseOutlined />}
                          onClick={() => remove(name)}
                        />
                      </Col>
                    </Row>
                    <Form.Item
                      getValueFromEvent={(value) =>
                        value ? 'include' : 'exclude'
                      }
                      initialValue={Effect.Include}
                      key={`effect-${key}`}
                      label={
                        <Typography.Text>{t('label.include')}</Typography.Text>
                      }
                      name={[name, 'effect']}
                      valuePropName="checked">
                      <Switch defaultChecked />
                    </Form.Item>
                  </Col>
                ))}
                {shouldShowAddAction(fields) && (
                  <Col span={24}>
                    <Button
                      data-testid="add-action"
                      disabled={isEmpty(triggerValue) || isNil(triggerValue)}
                      type="primary"
                      onClick={() => add({})}>
                      {t('label.add-entity', {
                        entity: t('label.action'),
                      })}
                    </Button>
                  </Col>
                )}
                <Form.ErrorList errors={errors} />
              </Row>
            )}
          </Form.List>
        </Col>
      </Row>
    </Card>
  );
}

export default ObservabilityFormActionItem;
