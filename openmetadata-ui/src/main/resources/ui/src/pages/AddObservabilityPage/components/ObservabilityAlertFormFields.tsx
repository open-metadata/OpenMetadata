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

import { Box, Divider, Grid } from '@openmetadata/ui-core-components';
import { Form, Input } from 'antd';
import { isEmpty } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import AlertFormSourceItem from '../../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem';
import DestinationFormItemFormBridge, {
  DestinationFormFieldRegistrar,
} from '../../../components/Alerts/DestinationFormItem/DestinationFormItemFormBridge';
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
  extraFormWidgets,
  filterResources,
  form,
  isLoading,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  templateResourcePermission,
  templates,
}: Readonly<ObservabilityAlertFormFieldsProps>) {
  const { t } = useTranslation();
  const destinations = Form.useWatch('destinations', form);
  const timeout = Form.useWatch('timeout', form);
  const readTimeout = Form.useWatch('readTimeout', form);

  return (
    <>
      <Grid.Item className="layout-column" span={24}>
        <Form.Item
          label={t('label.name')}
          labelCol={{ span: 24 }}
          name="displayName"
          rules={NAME_FIELD_RULES}>
          <Input placeholder={t('label.name')} />
        </Form.Item>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
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
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Box className="layout-row" justify="center" wrap="wrap">
          <Box
            className="layout-column tw:block"
            style={{ maxWidth: '100%', flex: `0 0 ${'100%'}` }}>
            <AlertFormSourceItem filterResources={filterResources} />
          </Box>
          {shouldShowFiltersSection && (
            <>
              <Box className="layout-column tw:block">
                <Divider
                  dashed
                  className="tw:mx-2 tw:h-6 tw:border-r"
                  orientation="vertical"
                />
              </Box>
              <Box
                className="layout-column tw:block"
                style={{ maxWidth: '100%', flex: `0 0 ${'100%'}` }}>
                <ObservabilityFormFiltersItem />
              </Box>
            </>
          )}
          {shouldShowActionsSection && (
            <>
              <Box className="layout-column tw:block">
                <Divider
                  dashed
                  className="tw:mx-2 tw:h-6 tw:border-r"
                  orientation="vertical"
                />
              </Box>
              <Box
                className="layout-column tw:block"
                style={{ maxWidth: '100%', flex: `0 0 ${'100%'}` }}>
                <ObservabilityFormTriggerItem />
              </Box>
            </>
          )}
          <Box className="layout-column tw:block">
            <Divider
              dashed
              className="tw:mx-2 tw:h-6 tw:border-r"
              orientation="vertical"
            />
          </Box>
          <Box
            className="layout-column tw:block"
            style={{ maxWidth: '100%', flex: `0 0 ${'100%'}` }}>
            <DestinationFormItemFormBridge
              renderValidationField={(validate) => (
                <Form.Item
                  hidden
                  name="destinations"
                  rules={[{ validator: validate }]}>
                  <DestinationFormFieldRegistrar />
                </Form.Item>
              )}
              values={{ destinations, readTimeout, timeout }}
              onChange={(values) => {
                // Each shared field must be replaced at its root. Ant's bulk
                // setter deep-merges destination array entries and would restore
                // config removed by a type change.
                Object.entries(values).forEach(([name, value]) =>
                  form.setFieldValue(name, value)
                );
              }}
            />
          </Box>

          {!isEmpty(extraFormWidgets) && (
            <>
              {Object.entries(extraFormWidgets).map(([name, Widget]) => (
                <Fragment key={name}>
                  <Box className="layout-column tw:block">
                    <Divider
                      dashed
                      className="tw:mx-2 tw:h-6 tw:border-r"
                      orientation="vertical"
                    />
                  </Box>
                  <Box
                    className="layout-column tw:block"
                    style={{ maxWidth: '100%', flex: `0 0 ${'100%'}` }}>
                    <Widget
                      alertDetails={alert}
                      formRef={form}
                      loading={isLoading}
                      templateResourcePermission={templateResourcePermission}
                      templates={templates}
                    />
                  </Box>
                </Fragment>
              ))}
            </>
          )}
        </Box>
      </Grid.Item>
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
