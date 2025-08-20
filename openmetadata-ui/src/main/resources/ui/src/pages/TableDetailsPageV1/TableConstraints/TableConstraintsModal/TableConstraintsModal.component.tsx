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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Empty, Form, Modal, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { debounce, isEmpty } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import IconDelete from '../../../../assets/svg/ic-delete.svg?react';
import PlusIcon from '../../../../assets/svg/plus-primary.svg?react';
import Loader from '../../../../components/common/Loader/Loader';
import { PAGE_SIZE } from '../../../../constants/constants';
import {
  RELATIONSHIP_TYPE_OPTION,
  TABLE_CONSTRAINTS_TYPE_OPTIONS,
} from '../../../../constants/Table.constants';
import { SearchIndex } from '../../../../enums/search.enum';
import {
  ConstraintType,
  Table,
  TableConstraint,
} from '../../../../generated/entity/data/table';
import { searchQuery } from '../../../../rest/searchAPI';
import { getBreadcrumbsFromFqn } from '../../../../utils/EntityUtils';
import { getServiceNameQueryFilter } from '../../../../utils/ServiceUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../utils/StringsUtils';
import {
  createTableConstraintObject,
  getColumnOptionsFromTableColumn,
} from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import './table-constraint.style.less';
import {
  SelectOptions,
  TableConstraintForm,
  TableConstraintModalProps,
} from './TableConstraintsModal.interface';

const TableConstraintsModal = ({
  tableDetails,
  constraint,
  onSave,
  onClose,
}: TableConstraintModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRelatedColumnLoading, setIsRelatedColumnLoading] =
    useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');
  const [relatedColumns, setRelatedColumns] = useState<SelectOptions[]>([]);
  const constraintType = Form.useWatch('constraintType', form);

  const tableColumnNameOptions = useMemo(
    () => getColumnOptionsFromTableColumn(tableDetails?.columns ?? []),
    [tableDetails?.columns]
  );

  const getSearchResults = async (value: string) => {
    setRelatedColumns([]);
    setIsRelatedColumnLoading(true);
    try {
      const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
      const data = await searchQuery({
        query:
          value &&
          `(columns.name.keyword:*${encodedValue}*) OR (columns.fullyQualifiedName:*${encodedValue}*)`,
        searchIndex: SearchIndex.TABLE,
        queryFilter: getServiceNameQueryFilter(
          tableDetails?.service?.name ?? ''
        ),
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        includeDeleted: false,
      });
      const sources = data.hits.hits.map((hit) => hit._source);

      const allColumns = sources.reduce((acc: SelectOptions[], cv: Table) => {
        const columnOption = cv.columns
          .map((item) => ({
            label: item.fullyQualifiedName ?? '',
            value: item.fullyQualifiedName ?? '',
          }))
          .filter(Boolean);

        return [...acc, ...columnOption];
      }, []);

      setSearchValue(value);
      setRelatedColumns(allColumns);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.suggestion-lowercase-plural'),
        })
      );
    } finally {
      setIsRelatedColumnLoading(false);
    }
  };

  const debounceFetcher = useCallback(debounce(getSearchResults, 800), []);

  const handleSubmit = async () => {
    const primaryConstraints: string[] =
      form.getFieldValue('primaryConstraints');
    const foreignConstraints: TableConstraintForm[] =
      form.getFieldValue('foreignConstraints');
    const distConstraints: string[] = form.getFieldValue('distConstraints');
    const sortConstraints: string[] = form.getFieldValue('sortConstraints');
    const uniqueConstraints: string[] = form.getFieldValue('uniqueConstraints');

    try {
      setIsLoading(true);
      await form.validateFields();
      const foreignConstraintFilteredData = foreignConstraints
        .filter((obj) => !Object.values(obj).includes(undefined))
        .map((item) => ({
          ...item,
          columns: [item.columns],
          referredColumns: [item.referredColumns],
          constraintType: ConstraintType.ForeignKey,
        }));

      const allConstraintsData = [
        ...createTableConstraintObject(
          primaryConstraints,
          ConstraintType.PrimaryKey
        ),
        ...createTableConstraintObject(distConstraints, ConstraintType.DistKey),
        ...createTableConstraintObject(sortConstraints, ConstraintType.SortKey),
        ...createTableConstraintObject(
          uniqueConstraints,
          ConstraintType.Unique
        ),
        ...foreignConstraintFilteredData,
      ];

      await onSave(allConstraintsData);
    } catch (_) {
      // Nothing here
    } finally {
      setIsLoading(false);
    }
  };

  const relatedColumnOptions = useMemo(() => {
    return relatedColumns.map((node) => {
      const breadcrumbs = getBreadcrumbsFromFqn(node.label ?? '', true);

      return {
        label: (
          <div className="constraint-breadcrumb">
            <Space wrap align="start" className="w-full" size={4}>
              {breadcrumbs.slice(0, 4).map((breadcrumb, index) => (
                <Fragment key={breadcrumb.name}>
                  <Typography.Text
                    className="constraint-breadcrumb-item"
                    ellipsis={{ tooltip: true }}>
                    {breadcrumb.name}
                  </Typography.Text>
                  {index !== breadcrumbs.length - 2 && (
                    <Typography.Text className="text-xss">
                      {t('label.slash-symbol')}
                    </Typography.Text>
                  )}
                </Fragment>
              ))}
            </Space>
            <Typography.Text
              className="constraint-breadcrumb-item constraint-column-name"
              ellipsis={{ tooltip: true }}>
              {breadcrumbs[4].name}
            </Typography.Text>
          </div>
        ),
        value: node.value,
        data: node,
      };
    });
  }, [relatedColumns]);

  useEffect(() => {
    const constraintFormData = constraint?.reduce(
      (
        acc: {
          primary: TableConstraint;
          foreign: TableConstraint[];
          dist: TableConstraint;
          sort: TableConstraint;
          unique: TableConstraint;
        },
        cv: TableConstraint
      ) => {
        if (cv.constraintType === ConstraintType.PrimaryKey) {
          return { ...acc, primary: cv };
        } else if (cv.constraintType === ConstraintType.DistKey) {
          return { ...acc, dist: cv };
        } else if (cv.constraintType === ConstraintType.SortKey) {
          return { ...acc, sort: cv };
        } else if (cv.constraintType === ConstraintType.Unique) {
          return { ...acc, unique: cv };
        }

        return { ...acc, foreign: [...acc.foreign, cv] };
      },
      { primary: {}, dist: {}, sort: {}, unique: {}, foreign: [] }
    );

    const filteredConstraints = !isEmpty(constraintFormData?.foreign)
      ? constraintFormData?.foreign.map((item) => ({
          columns: item.columns?.[0],
          relationshipType: item.relationshipType,
          referredColumns: item.referredColumns?.[0],
        }))
      : [
          {
            columns: undefined,
            relationshipType: undefined,
            referredColumns: undefined,
          },
        ];

    form.setFieldsValue({
      foreignConstraints: filteredConstraints,
      primaryConstraints: constraintFormData?.primary.columns,
      distConstraints: constraintFormData?.dist.columns,
      sortConstraints: constraintFormData?.sort.columns,
      uniqueConstraints: constraintFormData?.unique.columns,
      constraintType: ConstraintType.PrimaryKey,
    });
  }, [constraint]);

  useEffect(() => {
    getSearchResults(searchValue);
  }, []);

  return (
    <Modal
      centered
      destroyOnClose
      open
      closable={false}
      data-testid="table-constraint-modal"
      footer={[
        <Button
          disabled={isLoading}
          key="cancel-btn"
          type="link"
          onClick={onClose}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-btn"
          key="save-btn"
          loading={isLoading}
          type="primary"
          onClick={form.submit}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      title={t(`label.${isEmpty(constraint) ? 'add' : 'update'}-entity`, {
        entity: t('label.table-constraint-plural'),
      })}
      onCancel={onClose}>
      <Form
        className="table-constraint-form"
        form={form}
        layout="vertical"
        onFinish={handleSubmit}>
        <Form.Item
          className="w-full"
          label={t('label.constraint-type')}
          name="constraintType">
          <Select
            allowClear
            autoClearSearchValue
            data-testid="constraint-type-select"
            options={TABLE_CONSTRAINTS_TYPE_OPTIONS}
            placeholder={t('label.select-entity', {
              entity: t('label.constraint-type'),
            })}
          />
        </Form.Item>

        {constraintType === ConstraintType.PrimaryKey && (
          <div className="table-constraint-form-container">
            <Form.Item
              className="w-full"
              label={t('label.entity-key-plural', {
                entity: t('label.primary'),
              })}
              name="primaryConstraints">
              <Select
                allowClear
                autoClearSearchValue
                data-testid="primary-constraint-type-select"
                mode="multiple"
                options={tableColumnNameOptions}
                placeholder={t('label.select-entity', {
                  entity: t('label.primary-key-plural'),
                })}
              />
            </Form.Item>
          </div>
        )}

        {constraintType === ConstraintType.Unique && (
          <div className="table-constraint-form-container">
            <Form.Item
              className="w-full"
              label={t('label.unique')}
              name="uniqueConstraints">
              <Select
                allowClear
                autoClearSearchValue
                data-testid="unique-constraint-type-select"
                mode="multiple"
                options={tableColumnNameOptions}
                placeholder={t('label.select-entity', {
                  entity: t('label.entity-key-plural', {
                    entity: t('label.unique'),
                  }),
                })}
              />
            </Form.Item>
          </div>
        )}

        {constraintType === ConstraintType.SortKey && (
          <div className="table-constraint-form-container">
            <Form.Item
              className="w-full"
              label={t('label.entity-key-plural', {
                entity: t('label.sort'),
              })}
              name="sortConstraints">
              <Select
                allowClear
                autoClearSearchValue
                data-testid="sort-constraint-type-select"
                mode="multiple"
                options={tableColumnNameOptions}
                placeholder={t('label.select-entity', {
                  entity: t('label.entity-key-plural', {
                    entity: t('label.sort'),
                  }),
                })}
              />
            </Form.Item>
          </div>
        )}

        {constraintType === ConstraintType.DistKey && (
          <div className="table-constraint-form-container">
            <Form.Item
              className="w-full"
              label={t('label.entity-key-plural', {
                entity: t('label.dist'),
              })}
              name="distConstraints">
              <Select
                allowClear
                autoClearSearchValue
                data-testid="dist-constraint-type-select"
                mode="multiple"
                options={tableColumnNameOptions}
                placeholder={t('label.select-entity', {
                  entity: t('label.entity-key-plural', {
                    entity: t('label.dist'),
                  }),
                })}
              />
            </Form.Item>
          </div>
        )}

        {constraintType === ConstraintType.ForeignKey && (
          <Form.List name="foreignConstraints">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div className="table-constraint-form-container" key={key}>
                    <Form.Item
                      className="w-full"
                      {...restField}
                      label={t('label.entity-name', {
                        entity: t('label.column'),
                      })}
                      name={[name, 'columns']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.entity-name', {
                              entity: t('label.column'),
                            }),
                          }),
                        },
                      ]}>
                      <Select
                        data-testid={`${key}-column-type-select`}
                        options={tableColumnNameOptions}
                        placeholder={t('label.select-entity', {
                          entity: t('label.table-entity-text', {
                            entityText: t('label.column'),
                          }),
                        })}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      className="w-full"
                      label={t('label.entity-type-plural', {
                        entity: t('label.relationship'),
                      })}
                      name={[name, 'relationshipType']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.entity-type-plural', {
                              entity: t('label.relationship'),
                            }),
                          }),
                        },
                      ]}>
                      <Select
                        data-testid={`${key}-relationship-type-select`}
                        options={RELATIONSHIP_TYPE_OPTION}
                        placeholder={t('label.select-entity', {
                          entity: t('label.relationship-type'),
                        })}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      className="w-full"
                      label={t('label.related-column')}
                      name={[name, 'referredColumns']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.related-column'),
                          }),
                        },
                      ]}>
                      <Select
                        allowClear
                        showSearch
                        data-testid={`${key}-related-column-select`}
                        notFoundContent={
                          isRelatedColumnLoading ? (
                            <Loader size="small" />
                          ) : (
                            <Empty
                              description={t('label.no-entity-available', {
                                entity: t('label.column-plural'),
                              })}
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                          )
                        }
                        optionLabelProp="label"
                        placeholder={t('label.select-entity', {
                          entity: t('label.related-column'),
                        })}
                        onSearch={debounceFetcher}>
                        {relatedColumnOptions.map(({ label, value, data }) => (
                          <Select.Option
                            data-testid={`option-label-${data.label}`}
                            key={value}
                            value={value}>
                            {label}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Button
                      className="delete-constraint-button"
                      data-testid={`${key}-delete-constraint-button`}
                      icon={
                        <Icon
                          className="align-middle text-grey-muted"
                          component={IconDelete}
                          style={{ fontSize: '16px' }}
                        />
                      }
                      size="small"
                      type="text"
                      onClick={() => remove(name)}
                    />
                  </div>
                ))}
                <Button
                  className="text-primary d-flex items-center m-t-md"
                  data-testid="add-constraint-button"
                  icon={<PlusIcon className="anticon" />}
                  size="small"
                  onClick={() => add()}>
                  {t('label.add-entity', {
                    entity: t('label.constraint-plural'),
                  })}
                </Button>
              </>
            )}
          </Form.List>
        )}
      </Form>
    </Modal>
  );
};

export default TableConstraintsModal;
