/*
 *  Copyright 2026 Collate.
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

import { Button, Col, Divider, Form, Input, Row, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import { ComponentProps, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import AlertFormSourceItem from '../../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItem from '../../../components/Alerts/DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormFiltersItem from '../../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../../../components/Alerts/ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import InlineAlert from '../../../components/common/InlineAlert/InlineAlert';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { ProviderType } from '../../../generated/entity/events/notificationTemplate';
import { AlertType } from '../../../generated/events/eventSubscription';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  ModifiedCreateEventSubscription,
  ObservabilityAlertFormProps,
} from '../AddObservabilityPage.interface';

function ObservabilityAlertForm({
  alert,
  breadcrumb,
  containerEntities,
  extraFormButtons,
  extraFormWidgets,
  filterResources,
  form,
  handleCancel,
  handleSave,
  inlineAlertDetails,
  isEditMode,
  isLoading,
  saving,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  supportedFilters,
  supportedTriggers,
  templateResourcePermission,
  templates,
}: Readonly<ObservabilityAlertFormProps>) {
  const { t } = useTranslation();
  const observabilityFormFiltersItemProps = {
    containerEntities,
    supportedFilters,
  } as ComponentProps<typeof ObservabilityFormFiltersItem>;

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
      </Col>

      <Col span={24}>
        <Typography.Title level={5}>
          {t(`label.${isEditMode ? 'edit' : 'add'}-entity`, {
            entity: t('label.alert'),
          })}
        </Typography.Title>
        <Typography.Text>{t('message.alerts-description')}</Typography.Text>
      </Col>

      <Col span={24}>
        <Form<ModifiedCreateEventSubscription>
          form={form}
          initialValues={{
            ...alert,
            displayName: getEntityName(alert),
            resources: alert?.filteringRules?.resources,
          }}
          validateMessages={VALIDATION_MESSAGES}
          onFinish={handleSave}>
          <Row gutter={[20, 20]}>
            <Col span={24}>
              <Form.Item
                label={t('label.name')}
                labelCol={{ span: 24 }}
                name="displayName"
                rules={NAME_FIELD_RULES}>
                <Input placeholder={t('label.name')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label={t('label.description')}
                labelCol={{ span: 24 }}
                name="description"
                trigger="onTextChange">
                <RichTextEditor
                  data-testid="description"
                  initialValue={alert?.description}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Row justify="center">
                <Col span={24}>
                  <AlertFormSourceItem filterResources={filterResources} />
                </Col>
                {shouldShowFiltersSection && (
                  <>
                    <Col>
                      <Divider dashed type="vertical" />
                    </Col>
                    <Col span={24}>
                      <ObservabilityFormFiltersItem
                        {...observabilityFormFiltersItemProps}
                      />
                    </Col>
                  </>
                )}
                {shouldShowActionsSection && (
                  <>
                    <Col>
                      <Divider dashed type="vertical" />
                    </Col>
                    <Col span={24}>
                      <ObservabilityFormTriggerItem
                        supportedTriggers={supportedTriggers}
                      />
                    </Col>
                  </>
                )}
                <Col>
                  <Divider dashed type="vertical" />
                </Col>
                <Col span={24}>
                  <DestinationFormItem />
                </Col>

                {!isEmpty(extraFormWidgets) && (
                  <>
                    {Object.entries(extraFormWidgets).map(([name, Widget]) => (
                      <Fragment key={name}>
                        <Col>
                          <Divider dashed type="vertical" />
                        </Col>
                        <Col span={24}>
                          <Widget
                            alertDetails={alert}
                            formRef={form}
                            loading={isLoading}
                            templateResourcePermission={
                              templateResourcePermission
                            }
                            templates={templates}
                          />
                        </Col>
                      </Fragment>
                    ))}
                  </>
                )}
              </Row>
            </Col>
            <Form.Item
              hidden
              initialValue={AlertType.Observability}
              name="alertType"
            />
            <Form.Item
              hidden
              initialValue={ProviderType.User}
              name="provider"
            />

            {!isUndefined(inlineAlertDetails) && (
              <Col span={24}>
                <InlineAlert {...inlineAlertDetails} />
              </Col>
            )}

            <Col span={24}>
              <div className="flex justify-end gap-2">
                <Button
                  data-testid="cancel-button"
                  type="text"
                  onClick={handleCancel}>
                  {t('label.cancel')}
                </Button>

                {Object.entries(extraFormButtons).map(
                  ([name, ButtonComponent]) => (
                    <ButtonComponent
                      alertDetails={alert}
                      formRef={form}
                      key={name}
                      templateResourcePermission={templateResourcePermission}
                      templates={templates}
                    />
                  )
                )}
                <Button
                  data-testid="save-button"
                  htmlType="submit"
                  loading={saving}
                  type="primary">
                  {t('label.save')}
                </Button>
              </div>
            </Col>
          </Row>
        </Form>
      </Col>
    </Row>
  );
}

export default ObservabilityAlertForm;
