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

import { Grid, Typography } from '@openmetadata/ui-core-components';
import { Button, Form } from 'antd';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import InlineAlert from '../../../components/common/InlineAlert/InlineAlert';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { AlertSelectionProvider } from '../../../hooks/useAlertSelection';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  ModifiedCreateEventSubscription,
  ObservabilityAlertFormProps,
} from '../AddObservabilityPage.interface';
import ObservabilityAlertFormFields from './ObservabilityAlertFormFields';

function ObservabilityAlertForm({
  alert,
  breadcrumb,
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
  selection,
  shouldShowActionsSection,
  shouldShowFiltersSection,
  templateResourcePermission,
  templates,
}: Readonly<ObservabilityAlertFormProps>) {
  const { t } = useTranslation();

  return (
    <Grid
      className="layout-row layout-grid"
      style={{ ...getLayoutGutter(16, 16) }}>
      <Grid.Item className="layout-column" span={24}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
      </Grid.Item>

      <Grid.Item className="layout-column" span={24}>
        <Typography as="h5" size="text-md" weight="semibold">
          {t(`label.${isEditMode ? 'edit' : 'add'}-entity`, {
            entity: t('label.alert'),
          })}
        </Typography>
        <Typography>{t('message.alerts-description')}</Typography>
      </Grid.Item>

      <Grid.Item className="layout-column" span={24}>
        <Form<ModifiedCreateEventSubscription>
          form={form}
          initialValues={{
            ...alert,
            displayName: getEntityName(alert),
            resources: alert?.filteringRules?.resources,
          }}
          validateMessages={VALIDATION_MESSAGES}
          onFinish={handleSave}>
          <Grid
            className="layout-row layout-grid"
            style={{ ...getLayoutGutter(20, 20) }}>
            <AlertSelectionProvider value={selection}>
              <ObservabilityAlertFormFields
                alert={alert}
                extraFormWidgets={extraFormWidgets}
                filterResources={filterResources}
                form={form}
                isLoading={isLoading}
                shouldShowActionsSection={shouldShowActionsSection}
                shouldShowFiltersSection={shouldShowFiltersSection}
                templateResourcePermission={templateResourcePermission}
                templates={templates}
              />
            </AlertSelectionProvider>

            {!isUndefined(inlineAlertDetails) && (
              <Grid.Item className="layout-column" span={24}>
                <InlineAlert {...inlineAlertDetails} />
              </Grid.Item>
            )}

            <Grid.Item className="layout-column" span={24}>
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
            </Grid.Item>
          </Grid>
        </Form>
      </Grid.Item>
    </Grid>
  );
}

export default ObservabilityAlertForm;
