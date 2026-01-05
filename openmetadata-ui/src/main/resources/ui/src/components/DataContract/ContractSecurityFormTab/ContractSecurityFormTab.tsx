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
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Typography,
} from 'antd';
import { FormProps } from 'antd/lib/form/Form';
import classNames from 'classnames';
import { isEmpty, isNull } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/ic-cross.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { ReactComponent as RightIcon } from '../../../assets/svg/right-arrow.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/x-colored.svg';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { SUPPORTED_ROW_FILTER_ENTITIES } from '../../../constants/DataContract.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  ContractSecurity,
  DataContract,
  Policy,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { filterSelectOptions } from '../../../utils/CommonUtils';
import { getPopupContainer } from '../../../utils/formUtils';
import { getColumnOptionsFromTableColumn } from '../../../utils/TableUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import './contract-security-form-tab.less';

export const ContractSecurityFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onNext: () => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({ onChange, onNext, onPrev, buttonProps, initialValues }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { data: tableData } = useGenericContext();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const addFunctionRef = useRef<
    | ((
        defaultValue?: ContractSecurity,
        insertIndex?: number | undefined
      ) => void)
    | null
  >(null);
  const [editingKey, setEditingKey] = useState<number | null>(null);

  const policiesFormData: Policy[] = Form.useWatch('policies', form);
  const dataClassificationFormItem: string = Form.useWatch(
    'dataClassification',
    form
  );

  const columnOptions = useMemo(() => {
    const { columns } = tableData as Table;
    if (isEmpty(columns)) {
      return [];
    }

    return getColumnOptionsFromTableColumn(columns, true);
  }, [tableData]);

  const handleAddPolicy = () => {
    addFunctionRef.current?.({
      accessPolicy: '',
      identities: [],
      rowFilters: [
        {
          columnName: undefined,
          values: [],
        },
      ],
    });

    setEditingKey(policiesFormData.length ?? 0);
  };

  const handleDeletePolicy = useCallback(
    (key: number) => {
      const filteredValue =
        policiesFormData
          ?.filter((_item, idx) => idx !== key)
          ?.filter(Boolean) ?? [];
      form.setFieldsValue({
        policies: filteredValue,
      });
      onChange({
        security: {
          dataClassification: dataClassificationFormItem,
          policies: filteredValue,
        },
      });
    },
    [policiesFormData]
  );

  const handleFormChange: FormProps['onValuesChange'] = (_, values) => {
    onChange({
      security: values,
    });
  };

  useEffect(() => {
    if (isEmpty(initialValues?.security)) {
      form.setFieldsValue({
        dataClassification: '',
        policies: [
          {
            accessPolicy: '',
            identities: [],
            rowFilters: [
              {
                columnName: undefined,
                values: [],
              },
            ],
          },
        ],
      });

      setEditingKey(0);
    } else {
      form.setFieldsValue(initialValues?.security);

      if (!isEmpty(initialValues?.security?.policies)) {
        setEditingKey(0);
      }
    }
  }, [initialValues?.security]);

  return (
    <>
      <Card className="contract-security-form-container container bg-grey p-box">
        <div>
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.security')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.data-contract-security-description')}
          </Typography.Paragraph>
        </div>

        <Form
          className="new-form-style contract-security-form"
          form={form}
          layout="vertical"
          name="security"
          validateMessages={VALIDATION_MESSAGES}
          onValuesChange={handleFormChange}>
          <div className="contract-form-content-container">
            <Form.Item
              id="dataClassification"
              label={t('label.data-classification')}
              name="dataClassification">
              <Input
                data-testid="data-classification-input"
                placeholder={t('label.please-enter-entity-name', {
                  entity: t('label.data-classification'),
                })}
              />
            </Form.Item>
          </div>

          <div className="contract-form-content-container">
            <div className="d-flex justify-between items-center">
              <div className="consumer-title-container">
                <Typography.Text className="consumer-title">
                  {t('label.policy-plural')}
                </Typography.Text>
                <Typography.Paragraph className="consumer-description">
                  {t('message.contract-security-consume-description')}
                </Typography.Paragraph>
              </div>

              <Button
                className="add-policy-button"
                data-testid="add-policy-button"
                disabled={!isNull(editingKey) || !addFunctionRef.current}
                icon={<Icon className="anticon" component={PlusIcon} />}
                type="link"
                onClick={handleAddPolicy}>
                {t('label.add-entity', { entity: t('label.policy') })}
              </Button>
            </div>

            <Form.List name="policies">
              {(policyFields, { add: addPolicy }) => {
                // Store the add function so it can be used outside
                if (!addFunctionRef.current) {
                  addFunctionRef.current = addPolicy;
                }

                return policyFields.map((policyField, policyIndex) => {
                  return (
                    <ExpandableCard
                      cardProps={{
                        className: classNames(
                          'contract-consumer-security-card expandable-card',
                          {
                            'expanded-active-card':
                              editingKey === policyField.name,
                          }
                        ),
                        title: (
                          <div className="w-full d-flex justify-between items-center">
                            {editingKey === policyField.key ? null : (
                              <div className="security-form-item-title-container">
                                <div className="d-flex items-center gap-6">
                                  <div className="d-flex flex-column">
                                    <Typography.Text className="consumer-form-item-title">
                                      {policiesFormData?.[policyField.key]
                                        ?.accessPolicy || t('label.untitled')}
                                    </Typography.Text>
                                  </div>
                                </div>
                                <div className="d-flex items-center gap-2">
                                  <EditIconButton
                                    newLook
                                    className="edit-expand-button"
                                    data-testid={`edit-policy-${policyField.key}`}
                                    size="middle"
                                    onClick={() =>
                                      setEditingKey(policyField.key)
                                    }
                                  />

                                  <Button
                                    danger
                                    className="delete-expand-button"
                                    data-testid={`delete-policy-${policyField.key}`}
                                    icon={<DeleteIcon />}
                                    size="middle"
                                    onClick={() => {
                                      handleDeletePolicy(policyField.key);
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      }}
                      dataTestId={`contract-policy-card-${policyField.key}`}
                      defaultExpanded={editingKey === policyField.name}
                      key={policyField.name}>
                      {editingKey === policyField.name ? (
                        <Row
                          className="security-form-item-content"
                          key={policyField.key}>
                          <Col span={24}>
                            <Row
                              className="contract-consumer-security-card-row"
                              gutter={[0, 16]}>
                              <Col span={24}>
                                <Form.Item
                                  label={t('label.access-policy')}
                                  name={[policyField.name, 'accessPolicy']}>
                                  <Input
                                    data-testid={`access-policy-input-${policyIndex}`}
                                    placeholder={t(
                                      'label.please-enter-entity-name',
                                      {
                                        entity: t('label.access-policy'),
                                      }
                                    )}
                                  />
                                </Form.Item>
                              </Col>

                              <Col span={24}>
                                <Form.Item
                                  label={t('label.identities')}
                                  name={[policyField.name, 'identities']}>
                                  <Select
                                    data-testid={`identities-input-${policyIndex}`}
                                    id={`identities-input-${policyIndex}`}
                                    mode="tags"
                                    open={false}
                                    placeholder={t('label.please-enter-value', {
                                      name: t('label.identities'),
                                    })}
                                  />
                                </Form.Item>
                              </Col>
                            </Row>

                            {SUPPORTED_ROW_FILTER_ENTITIES.includes(
                              entityType
                            ) ? (
                              <>
                                <Divider />

                                <Form.List
                                  name={[policyField.name, 'rowFilters']}>
                                  {(
                                    rowFilterFields,
                                    {
                                      add: addRowFilter,
                                      remove: removeRowFilter,
                                    }
                                  ) => {
                                    return (
                                      <>
                                        <div className="d-flex items-center justify-between">
                                          <Typography.Text className="row-filter-title">
                                            {t('label.row-filter-plural')}
                                          </Typography.Text>

                                          <Button
                                            className="add-row-filter-button"
                                            data-testid={`add-row-filter-button-${policyIndex}`}
                                            icon={<Icon component={PlusIcon} />}
                                            type="link"
                                            onClick={() => addRowFilter()}>
                                            {t('label.add-entity', {
                                              entity: t('label.row-filter'),
                                            })}
                                          </Button>
                                        </div>

                                        <div className="contract-consumer-security-card-rule-container">
                                          {rowFilterFields.map(
                                            (
                                              rowFilterField,
                                              rowFilterIndex
                                            ) => {
                                              return (
                                                <Row
                                                  align="middle"
                                                  gutter={[16, 16]}
                                                  key={rowFilterField.key}>
                                                  <Col span={11}>
                                                    <Form.Item
                                                      label={t(
                                                        'label.column-name'
                                                      )}
                                                      name={[
                                                        rowFilterField.name,
                                                        'columnName',
                                                      ]}>
                                                      <Select
                                                        allowClear
                                                        showSearch
                                                        data-testid={`columnName-input-${policyIndex}-${rowFilterIndex}`}
                                                        filterOption={
                                                          filterSelectOptions
                                                        }
                                                        getPopupContainer={
                                                          getPopupContainer
                                                        }
                                                        id={`columnName-input-${policyIndex}-${rowFilterIndex}`}
                                                        options={columnOptions}
                                                        placeholder={t(
                                                          'label.please-enter-entity-name',
                                                          {
                                                            entity:
                                                              t('label.column'),
                                                          }
                                                        )}
                                                      />
                                                    </Form.Item>
                                                  </Col>

                                                  <Col span={11}>
                                                    <Form.Item
                                                      label={t(
                                                        'label.value-plural'
                                                      )}
                                                      name={[
                                                        rowFilterField.name,
                                                        'values',
                                                      ]}>
                                                      <Select
                                                        data-testid={`values-${policyIndex}-${rowFilterIndex}`}
                                                        id={`values-${policyIndex}-${rowFilterIndex}`}
                                                        mode="tags"
                                                        open={false}
                                                        placeholder={t(
                                                          'label.please-enter-value',
                                                          {
                                                            name: t(
                                                              'label.column-plural'
                                                            ),
                                                          }
                                                        )}
                                                      />
                                                    </Form.Item>
                                                  </Col>

                                                  <Col span={2}>
                                                    <Button
                                                      className="contract-consumer-security-card-rule-delete-button"
                                                      icon={
                                                        <Icon
                                                          component={CloseIcon}
                                                        />
                                                      }
                                                      size="small"
                                                      type="text"
                                                      onClick={() => {
                                                        removeRowFilter(
                                                          rowFilterField.name
                                                        );
                                                      }}
                                                    />
                                                  </Col>
                                                </Row>
                                              );
                                            }
                                          )}
                                        </div>

                                        <div className="contract-consumer-security-card-form-actions-items">
                                          <Button
                                            data-testid="cancel-policy-button"
                                            onClick={() => setEditingKey(null)}>
                                            {t('label.cancel')}
                                          </Button>
                                          <Button
                                            className="m-l-md"
                                            data-testid="save-policy-button"
                                            type="primary"
                                            onClick={() => setEditingKey(null)}>
                                            {t('label.save')}
                                          </Button>
                                        </div>
                                      </>
                                    );
                                  }}
                                </Form.List>
                              </>
                            ) : (
                              <div className="contract-consumer-security-card-form-actions-items">
                                <Button
                                  data-testid="cancel-policy-button"
                                  onClick={() => setEditingKey(null)}>
                                  {t('label.cancel')}
                                </Button>
                                <Button
                                  className="m-l-md"
                                  data-testid="save-policy-button"
                                  type="primary"
                                  onClick={() => setEditingKey(null)}>
                                  {t('label.save')}
                                </Button>
                              </div>
                            )}
                          </Col>
                        </Row>
                      ) : SUPPORTED_ROW_FILTER_ENTITIES.includes(entityType) ? (
                        <Form.List name={[policyField.name, 'rowFilters']}>
                          {(rowFilterFields) => {
                            return (
                              <div className="contract-consumer-security-card-rule-container">
                                {rowFilterFields.map(
                                  (rowFilterField, rowFilterIndex) => {
                                    return (
                                      <Row
                                        align="middle"
                                        gutter={[16, 16]}
                                        key={rowFilterField.key}>
                                        <Col span={11}>
                                          <Form.Item
                                            label={t('label.column-name')}
                                            name={[
                                              rowFilterField.name,
                                              'columnName',
                                            ]}>
                                            <Input
                                              disabled
                                              data-testid={`columnName-input-${policyIndex}-${rowFilterIndex}`}
                                              placeholder={t(
                                                'label.please-enter-entity-name',
                                                {
                                                  entity: t('label.column'),
                                                }
                                              )}
                                            />
                                          </Form.Item>
                                        </Col>

                                        <Col span={11}>
                                          <Form.Item
                                            label={t('label.value-plural')}
                                            name={[
                                              rowFilterField.name,
                                              'values',
                                            ]}>
                                            <Select
                                              disabled
                                              data-testid={`values-${policyIndex}-${rowFilterIndex}`}
                                              id={`values-${policyIndex}-${rowFilterIndex}`}
                                              mode="tags"
                                              open={false}
                                              placeholder={t(
                                                'label.please-enter-value',
                                                {
                                                  name: t(
                                                    'label.column-plural'
                                                  ),
                                                }
                                              )}
                                            />
                                          </Form.Item>
                                        </Col>
                                      </Row>
                                    );
                                  }
                                )}
                              </div>
                            );
                          }}
                        </Form.List>
                      ) : null}
                    </ExpandableCard>
                  );
                });
              }}
            </Form.List>
          </div>
        </Form>
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          onClick={onPrev}>
          {buttonProps.prevLabel ?? t('label.previous')}
        </Button>
        <Button
          className="contract-next-button"
          type="primary"
          onClick={onNext}>
          {buttonProps.nextLabel ?? t('label.next')}
          <Icon component={RightIcon} />
        </Button>
      </div>
    </>
  );
};
