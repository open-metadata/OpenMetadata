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
import { isEmpty, isNil } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AsyncSelect } from '../../../components/AsyncSelect/AsyncSelect';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import {
  ENTITY_TO_SEARCH_INDEX_MAP,
  SearchIndex,
} from '../../../enums/search.enum';
import {
  CreateEventSubscription,
  Effect,
} from '../../../generated/events/api/createEventSubscription';
import { EventFilterRule } from '../../../generated/events/eventSubscription';
import { InputType } from '../../../generated/events/filterResourceDescriptor';
import { searchData } from '../../../rest/miscAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { ObservabilityFormFiltersItemProps } from './ObservabilityFormFiltersItem.interface';

function ObservabilityFormFiltersItem({
  heading,
  subHeading,
  filterResources,
}: Readonly<ObservabilityFormFiltersItemProps>) {
  const { t } = useTranslation();

  const form = Form.useFormInstance();

  // Watchers
  const filters = Form.useWatch<EventFilterRule[]>(['input', 'filters'], form);
  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const supportedFilters = useMemo(
    () =>
      filterResources.find((resource) => resource.name === selectedTrigger)
        ?.supportedFilters,
    [filterResources, selectedTrigger]
  );

  const searchEntity = useCallback(
    async (search: string, searchIndex: SearchIndex, filters?: string) => {
      try {
        const response = await searchData(
          search,
          1,
          PAGE_SIZE_LARGE,
          filters ?? '',
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
        ENTITY_TO_SEARCH_INDEX_MAP[selectedTrigger]
      );
    },
    [searchEntity, selectedTrigger]
  );

  const getTableSuggestions = useCallback(
    async (searchText: string) => {
      return searchEntity(searchText, SearchIndex.TABLE);
    },
    [searchEntity]
  );

  const getDomainOptions = useCallback(
    async (searchText: string) => {
      return searchEntity(searchText, SearchIndex.DOMAIN);
    },
    [searchEntity]
  );

  const getOwnerOptions = useCallback(
    async (searchText: string) => {
      return searchEntity(searchText, SearchIndex.USER, 'isBot:false');
    },
    [searchEntity]
  );

  // Run time values needed for conditional rendering
  const functions = useMemo(() => {
    return supportedFilters?.map((func) => ({
      label: getEntityName(func),
      value: func.name,
      disabled: filters?.some((d) => d.name === func.name),
    }));
  }, [supportedFilters, filters]);

  const showAddFilter = useCallback(
    (fields: FormListFieldData[]) =>
      fields.length < (supportedFilters?.length ?? 1),
    [supportedFilters]
  );

  const getFieldByArgumentType = useCallback(
    (fieldName: number, argument: string, index: number) => {
      let field: JSX.Element;
      switch (argument) {
        case 'fqnList':
          field = (
            <Col key="fqn-list-select" span={11}>
              <Form.Item
                className="w-full"
                name={[fieldName, 'arguments', index, 'input']}
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
          );

          break;

        case 'domainList':
          field = (
            <Col key="domain-select" span={11}>
              <Form.Item
                className="w-full"
                name={[fieldName, 'arguments', index, 'input']}
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
          );

          break;

        case 'tableNameList':
          field = (
            <Col key="domain-select" span={11}>
              <Form.Item
                className="w-full"
                name={[fieldName, 'arguments', index, 'input']}
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
          );

          break;

        case 'ownerNameList':
          field = (
            <Col key="owner-select" span={11}>
              <Form.Item
                className="w-full"
                name={[fieldName, 'arguments', index, 'input']}
                rules={[
                  {
                    required: true,
                    message: t('message.field-text-is-required', {
                      fieldText: t('label.entity-list', {
                        entity: t('label.entity-name', {
                          entity: t('label.owner'),
                        }),
                      }),
                    }),
                  },
                ]}>
                <AsyncSelect
                  api={getOwnerOptions}
                  data-testid="owner-select"
                  mode="multiple"
                  placeholder={t('label.search-by-type', {
                    type: t('label.owner-lowercase'),
                  })}
                />
              </Form.Item>
            </Col>
          );

          break;

        default:
          field = <></>;
      }

      return (
        <>
          {field}
          <Form.Item
            hidden
            dependencies={[fieldName, 'arguments', index, 'input']}
            initialValue={argument}
            key={`${argument}-name`}
            name={[fieldName, 'arguments', index, 'name']}
          />
        </>
      );
    },
    [getEntityByFQN, getDomainOptions]
  );

  // Render condition field based on function selected
  const getConditionField = (condition: string, name: number) => {
    const selectedFilter = supportedFilters?.find(
      (filter) => filter.name === condition
    );
    const requireInput = selectedFilter?.inputType === InputType.Runtime;
    const requiredArguments = selectedFilter?.arguments;

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
    <Card className="alert-form-item-container">
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
          <Form.List name={['input', 'filters']}>
            {(fields, { add, remove }, { errors }) => (
              <Row gutter={[16, 16]} key="filters">
                {fields.map(({ key, name }) => {
                  const effect =
                    form.getFieldValue(['input', 'filters', name, 'effect']) ??
                    Effect.Include;

                  return (
                    <Col key={`observability-${key}`} span={24}>
                      <Row gutter={[8, 8]}>
                        <Col span={11}>
                          <Form.Item
                            key={`filter-${key}`}
                            name={[name, 'name']}
                            rules={[
                              {
                                required: true,
                                message: t('message.field-text-is-required', {
                                  fieldText: t('label.filter'),
                                }),
                              },
                            ]}>
                            <Select
                              options={functions}
                              placeholder={t('label.select-field', {
                                field: t('label.filter'),
                              })}
                              onChange={() => {
                                form.setFieldValue(
                                  ['input', 'filters', name, 'arguments'],
                                  []
                                );
                              }}
                            />
                          </Form.Item>
                        </Col>
                        {!isNil(supportedFilters) &&
                          !isEmpty(filters) &&
                          filters[name] &&
                          getConditionField(filters[name].name ?? '', name)}
                        <Col span={2}>
                          <Button
                            data-testid={`remove-filter-rule-${name}`}
                            icon={<CloseOutlined />}
                            onClick={() => remove(name)}
                          />
                        </Col>
                      </Row>
                      <Form.Item
                        label={
                          <Typography.Text>
                            {t('label.include')}
                          </Typography.Text>
                        }
                        name={[name, 'effect']}
                        normalize={(value) =>
                          value ? Effect.Include : Effect.Exclude
                        }>
                        <Switch checked={effect === Effect.Include} />
                      </Form.Item>
                    </Col>
                  );
                })}
                {showAddFilter(fields) ? (
                  <Col span={24}>
                    <Button
                      data-testid="add-filters"
                      disabled={
                        isEmpty(selectedTrigger) || isNil(selectedTrigger)
                      }
                      type="primary"
                      onClick={() =>
                        add({
                          effect: Effect.Include,
                        })
                      }>
                      {t('label.add-entity', {
                        entity: t('label.filter'),
                      })}
                    </Button>
                  </Col>
                ) : null}
                <Form.ErrorList errors={errors} />
              </Row>
            )}
          </Form.List>
        </Col>
      </Row>
    </Card>
  );
}

export default ObservabilityFormFiltersItem;
