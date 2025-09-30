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
import {
  ContractSecurity,
  DataConsumers,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { filterSelectOptions } from '../../../utils/CommonUtils';
import { getPopupContainer } from '../../../utils/formUtils';
import { getColumnOptionsFromTableColumn } from '../../../utils/TableUtils';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import './contract-security-form-tab.less';

export const ContractSecurityFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onNext: () => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  nextLabel?: string;
  prevLabel?: string;
}> = ({ onChange, onNext, onPrev, nextLabel, prevLabel, initialValues }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { data: tableData } = useGenericContext();
  const addFunctionRef = useRef<
    | ((
        defaultValue?: ContractSecurity,
        insertIndex?: number | undefined
      ) => void)
    | null
  >(null);
  const [editingKey, setEditingKey] = useState<number | null>(null);

  const consumerFormData: DataConsumers[] = Form.useWatch('consumers', form);
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

  const handleAddConsumers = () => {
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

    setEditingKey(consumerFormData.length ?? 0);
  };

  const handleDeleteConsumer = useCallback(
    (key: number) => {
      const filteredValue =
        consumerFormData
          ?.filter((_item, idx) => idx !== key)
          ?.filter(Boolean) ?? [];
      form.setFieldsValue({
        consumers: filteredValue,
      });
      onChange({
        security: {
          dataClassification: dataClassificationFormItem,
          consumers: filteredValue,
        },
      });
    },
    [consumerFormData]
  );

  const handleFormChange: FormProps['onValuesChange'] = (_, values) => {
    onChange({
      security: values,
    });
  };

  useEffect(() => {
    if (!isEmpty(initialValues?.security)) {
      form.setFieldsValue(initialValues?.security);
    } else {
      form.setFieldsValue({
        dataClassification: '',
        consumers: [
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
    }
    setEditingKey(0);
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
                  {t('label.consumer-plural')}
                </Typography.Text>
                <Typography.Paragraph className="consumer-description">
                  {t('message.contract-security-consume-description')}
                </Typography.Paragraph>
              </div>

              <Button
                className="add-consumer-button"
                data-testid="add-consumer-button"
                disabled={!isNull(editingKey) || !addFunctionRef.current}
                icon={<Icon className="anticon" component={PlusIcon} />}
                type="link"
                onClick={handleAddConsumers}>
                {t('label.add-entity', { entity: t('label.consumer') })}
              </Button>
            </div>

            <Form.List name="consumers">
              {(consumerFields, { add: addConsumer }) => {
                // Store the add function so it can be used outside
                if (!addFunctionRef.current) {
                  addFunctionRef.current = addConsumer;
                }

                return (
                  <>
                    {consumerFields.map((consumerField, consumerIndex) => {
                      return (
                        <ExpandableCard
                          cardProps={{
                            className: classNames(
                              'contract-consumer-security-card expandable-card',
                              {
                                'expanded-active-card':
                                  editingKey === consumerField.name,
                              }
                            ),
                            title: (
                              <div className="w-full d-flex justify-between items-center">
                                {editingKey === consumerField.key ? null : (
                                  <div className="security-form-item-title-container">
                                    <div className="d-flex items-center gap-6">
                                      <div className="d-flex flex-column">
                                        <Typography.Text className="consumer-form-item-title">
                                          {consumerFormData?.[consumerField.key]
                                            ?.accessPolicy ||
                                            t('label.untitled')}
                                        </Typography.Text>
                                      </div>
                                    </div>
                                    <div className="d-flex items-center gap-2">
                                      <EditIconButton
                                        newLook
                                        className="edit-expand-button"
                                        data-testid={`edit-consumer-${consumerField.key}`}
                                        size="middle"
                                        onClick={() =>
                                          setEditingKey(consumerField.key)
                                        }
                                      />

                                      <Button
                                        danger
                                        className="delete-expand-button"
                                        data-testid={`delete-consumer-${consumerField.key}`}
                                        icon={<DeleteIcon />}
                                        size="middle"
                                        onClick={() => {
                                          handleDeleteConsumer(
                                            consumerField.key
                                          );
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ),
                          }}
                          dataTestId={`contract-consumer-card-${consumerField.key}`}
                          defaultExpanded={editingKey === consumerField.name}
                          key={consumerField.name}>
                          {editingKey === consumerField.name ? (
                            <>
                              <Row
                                className="security-form-item-content"
                                key={consumerField.key}>
                                <Col span={24}>
                                  <Row
                                    className="contract-consumer-security-card-row"
                                    gutter={[0, 16]}>
                                    <Col span={24}>
                                      <Form.Item
                                        label={t('label.access-policy')}
                                        name={[
                                          consumerField.name,
                                          'accessPolicy',
                                        ]}>
                                        <Input
                                          data-testid={`access-policy-input-${consumerIndex}`}
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
                                        name={[
                                          consumerField.name,
                                          'identities',
                                        ]}>
                                        <Select
                                          data-testid={`identities-input-${consumerIndex}`}
                                          id={`identities-input-${consumerIndex}`}
                                          mode="tags"
                                          placeholder={t(
                                            'label.please-enter-value',
                                            {
                                              name: t('label.identities'),
                                            }
                                          )}
                                        />
                                      </Form.Item>
                                    </Col>
                                  </Row>

                                  <Divider />

                                  <Form.List
                                    name={[consumerField.name, 'rowFilters']}>
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
                                              data-testid={`add-row-filter-button-${consumerIndex}`}
                                              icon={
                                                <Icon component={PlusIcon} />
                                              }
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
                                                          data-testid={`columnName-input-${consumerIndex}-${rowFilterIndex}`}
                                                          filterOption={
                                                            filterSelectOptions
                                                          }
                                                          getPopupContainer={
                                                            getPopupContainer
                                                          }
                                                          id={`columnName-input-${consumerIndex}-${rowFilterIndex}`}
                                                          options={
                                                            columnOptions
                                                          }
                                                          placeholder={t(
                                                            'label.please-enter-entity-name',
                                                            {
                                                              entity:
                                                                t(
                                                                  'label.column'
                                                                ),
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
                                                          data-testid={`values-${consumerIndex}-${rowFilterIndex}`}
                                                          id={`values-${consumerIndex}-${rowFilterIndex}`}
                                                          mode="tags"
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
                                                            component={
                                                              CloseIcon
                                                            }
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
                                              data-testid="cancel-consumer-button"
                                              onClick={() =>
                                                setEditingKey(null)
                                              }>
                                              {t('label.cancel')}
                                            </Button>
                                            <Button
                                              className="m-l-md"
                                              data-testid="save-consumer-button"
                                              type="primary"
                                              onClick={() =>
                                                setEditingKey(null)
                                              }>
                                              {t('label.save')}
                                            </Button>
                                          </div>
                                        </>
                                      );
                                    }}
                                  </Form.List>
                                </Col>
                              </Row>
                            </>
                          ) : (
                            <Form.List
                              name={[consumerField.name, 'rowFilters']}>
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
                                                  data-testid={`columnName-input-${consumerIndex}-${rowFilterIndex}`}
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
                                                  data-testid={`values-${consumerIndex}-${rowFilterIndex}`}
                                                  id={`values-${consumerIndex}-${rowFilterIndex}`}
                                                  mode="tags"
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
                          )}
                        </ExpandableCard>
                      );
                    })}
                  </>
                );
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
          {prevLabel ?? t('label.previous')}
        </Button>
        <Button
          className="contract-next-button"
          type="primary"
          onClick={onNext}>
          {nextLabel ?? t('label.next')}
          <Icon component={RightIcon} />
        </Button>
      </div>
    </>
  );
};
