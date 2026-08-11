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

import { Col, Divider, Form, Input, Row } from 'antd';
import { isEmpty } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import AlertFormSourceItem from '../../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItem from '../../../components/Alerts/DestinationFormItem/DestinationFormItem.component';
import ObservabilityFormFiltersItem from '../../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../../../components/Alerts/ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { NAME_FIELD_RULES } from '../../../constants/Form.constants';
import { ProviderType } from '../../../generated/entity/events/notificationTemplate';
import { AlertType } from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ObservabilityAlertFormFieldsProps,
} from '../AddObservabilityPage.interface';

function ObservabilityAlertFormFields({
  alert,
  containerEntities,
  extraFormWidgets,
  filterResources,
  form,
  isLoading,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  supportedFilters,
  supportedTriggers,
  templateResourcePermission,
  templates,
}: Readonly<ObservabilityAlertFormFieldsProps>) {
  const { t } = useTranslation();

  return (
    <>
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
                  containerEntities={containerEntities}
                  supportedFilters={supportedFilters}
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
                      templateResourcePermission={templateResourcePermission}
                      templates={templates}
                    />
                  </Col>
                </Fragment>
              ))}
            </>
          )}
        </Row>
      </Col>
      <Form.Item<ModifiedCreateEventSubscription>
        hidden
        initialValue={AlertType.Observability}
        name="alertType"
      />
      <Form.Item<ModifiedCreateEventSubscription>
        hidden
        initialValue={ProviderType.User}
        name="provider"
      />
    </>
  );
}

export default ObservabilityAlertFormFields;
