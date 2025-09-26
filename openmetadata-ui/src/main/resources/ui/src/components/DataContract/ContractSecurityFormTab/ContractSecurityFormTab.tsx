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
import { Button, Card, Col, Form, Input, Row, Select, Typography } from 'antd';
import { FormProps } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/ic-cross.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { ReactComponent as RightIcon } from '../../../assets/svg/right-arrow.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/x-colored.svg';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { DataContract } from '../../../generated/entity/data/dataContract';
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

  const handleFormChange: FormProps['onValuesChange'] = (_, values) => {
    onChange({
      security: values,
    });
  };

  useEffect(() => {
    if (!isEmpty(initialValues)) {
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
                columnName: '',
                values: [],
              },
            ],
          },
        ],
      });
    }
  }, [initialValues]);

  return (
    <>
      <Card className="container bg-grey p-box">
        <div>
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.security')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.data-contract-security-description')}
          </Typography.Paragraph>
        </div>

        <div className="contract-form-content-container">
          <Form
            className="new-form-style contract-security-form"
            form={form}
            layout="vertical"
            name="security"
            validateMessages={VALIDATION_MESSAGES}
            onValuesChange={handleFormChange}>
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

            <Typography.Text className="m-b-md d-block">
              {t('label.consumer-plural')}
            </Typography.Text>

            <Form.List name="consumers">
              {(
                consumerFields,
                { add: addConsumer, remove: removeConsumer }
              ) => {
                return (
                  <>
                    {consumerFields.map((consumerField, consumerIndex) => {
                      return (
                        <Row className="m-b-md" key={consumerField.key}>
                          <Col span={24}>
                            <Card className="contract-consumer-security-card">
                              <Row
                                className="contract-consumer-security-card-row"
                                gutter={[0, 16]}>
                                <Col span={24}>
                                  <Form.Item
                                    label={t('label.access-policy')}
                                    name={[consumerField.name, 'accessPolicy']}>
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
                                    name={[consumerField.name, 'identities']}>
                                    <Select
                                      data-testid={`identities-input-${consumerIndex}`}
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

                                <Col span={24}>
                                  <Typography.Text className="m-b-md d-block">
                                    {t('label.row-filter-plural')}
                                  </Typography.Text>
                                </Col>
                              </Row>

                              <Form.List
                                name={[consumerField.name, 'rowFilters']}>
                                {(
                                  rowFilterFields,
                                  { add: addRowFilter, remove: removeRowFilter }
                                ) => {
                                  return (
                                    <>
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
                                                    label={t(
                                                      'label.column-name'
                                                    )}
                                                    name={[
                                                      rowFilterField.name,
                                                      'columnName',
                                                    ]}>
                                                    <Input
                                                      data-testid={`columnName-input-${consumerIndex}-${rowFilterIndex}`}
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
                                                      data-testid={`values-${consumerIndex}-${rowFilterIndex}`}
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
                                          className="add-row-filter-button"
                                          data-testid={`add-row-filter-button-${consumerIndex}`}
                                          icon={<Icon component={PlusIcon} />}
                                          type="link"
                                          onClick={() => addRowFilter()}>
                                          {t('label.add-entity', {
                                            entity: t('label.row-filter'),
                                          })}
                                        </Button>

                                        <Button
                                          className="delete-consumer-filter-button"
                                          data-testid={`delete-consumer-filter-button-${consumerIndex}`}
                                          icon={<Icon component={DeleteIcon} />}
                                          type="link"
                                          onClick={() => {
                                            removeConsumer(consumerField.name);
                                          }}>
                                          {t('label.remove-entity', {
                                            entity: t('label.consumer'),
                                          })}
                                        </Button>
                                      </div>
                                    </>
                                  );
                                }}
                              </Form.List>
                            </Card>
                          </Col>
                        </Row>
                      );
                    })}
                    <Form.Item>
                      <Button
                        className="add-consumer-button"
                        data-testid="add-consumer-button"
                        icon={<Icon component={PlusIcon} />}
                        type="link"
                        onClick={() =>
                          addConsumer({
                            accessPolicy: '',
                            identities: [],
                            rowFilters: [
                              {
                                columnName: '',
                                values: [],
                              },
                            ],
                          })
                        }>
                        {t('label.add-entity', { entity: t('label.consumer') })}
                      </Button>
                    </Form.Item>
                  </>
                );
              }}
            </Form.List>
          </Form>
        </div>
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
