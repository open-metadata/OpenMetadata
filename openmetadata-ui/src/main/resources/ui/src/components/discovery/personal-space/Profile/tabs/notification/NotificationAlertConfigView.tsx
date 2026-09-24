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

import {
  Box,
  Card,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../../../../constants/constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  NotificationTemplate,
  ProviderType,
} from '../../../../../../generated/entity/events/notificationTemplate';
import { Effect } from '../../../../../../generated/events/api/createEventSubscription';
import { EventFilterRule } from '../../../../../../generated/events/eventFilterRule';
import {
  EventSubscription,
} from '../../../../../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../../../../../generated/events/filterResourceDescriptor';
import { getResourceFunctions } from '../../../../../../rest/alertsAPI';
import { getAllNotificationTemplates } from '../../../../../../rest/notificationtemplateAPI';
import alertsClassBase from '../../../../../../utils/AlertsClassBase';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import Loader from '../../../../../common/Loader/Loader';
import NotificationDestinationBridge from './NotificationDestinationBridge';
import NotificationFiltersEditor from './NotificationFiltersEditor';
import NotificationSourceSelect from './NotificationSourceSelect';

interface AlertConfigLoadingState {
  templates: boolean;
  functions: boolean;
}

// ─── Inline read-only trigger display ────────────────────────────────────────

function ReadOnlyTriggerDisplay({
  actions,
  supportedTriggers,
}: {
  actions: EventFilterRule[];
  supportedTriggers?: EventFilterRule[];
}) {
  const { t } = useTranslation();

  return (
    <Card className="tw:w-full" size="md">
      <Card.Content>
        <Box direction="col" gap={3}>
          <Box direction="col" gap={1}>
            <Typography size="text-sm" weight="medium">
              {t('label.trigger')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('message.alerts-trigger-description')}
            </Typography>
          </Box>

          <Box data-testid="triggers-list" direction="col" gap={3}>
            {actions.map((action) => {
              const triggerDef = supportedTriggers?.find(
                (tr) => tr.name === action.name
              );
              const effect = action.effect ?? Effect.Include;
              const triggerKey = action.name ?? action.effect ?? 'unknown';

              return (
                <Box
                  data-testid={`trigger-${triggerKey}`}
                  direction="col"
                  gap={2}
                  key={triggerKey}>
                  <Typography
                    className="tw:bg-secondary tw:rounded-md tw:px-2 tw:py-1 tw:border tw:border-secondary tw:text-secondary tw:self-start"
                    data-testid={`trigger-name-${triggerKey}`}
                    size="text-sm">
                    {getEntityName(triggerDef) || action.name}
                  </Typography>

                  <Box align="center" direction="row" gap={2}>
                    <Typography size="text-sm">
                      {t('label.include')}
                    </Typography>
                    <Toggle
                      isDisabled
                      data-testid={`trigger-switch-${triggerKey}`}
                      isSelected={effect === Effect.Include}
                      onChange={() => {}}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
}

// ─── Extract alert data from modified/raw alert ──────────────────────────────

function extractAlertViewData(
  alertDetails: EventSubscription,
  modifiedAlertData: ReturnType<typeof alertsClassBase.getModifiedAlertDataForForm>
) {
  const alertResources =
    modifiedAlertData?.filteringRules?.resources ??
    alertDetails.filteringRules?.resources ??
    [];
  const alertFilters =
    (
      modifiedAlertData as unknown as {
        input?: { filters?: EventFilterRule[] };
      }
    )?.input?.filters ??
    (alertDetails as unknown as { input?: { filters?: EventFilterRule[] } })
      ?.input?.filters ??
    [];
  const alertActions =
    (
      modifiedAlertData as unknown as {
        input?: { actions?: EventFilterRule[] };
      }
    )?.input?.actions ?? [];

  return {
    alertResources,
    alertFilters,
    alertActions,
    destinations: modifiedAlertData.destinations ?? [],
    alertTimeout: modifiedAlertData.timeout,
    alertReadTimeout: modifiedAlertData.readTimeout,
  };
}

// ─── Main component ──────────────────────────────────────────────────────────

interface NotificationAlertConfigViewProps {
  alertDetails: EventSubscription;
}

function NotificationAlertConfigView({
  alertDetails,
}: NotificationAlertConfigViewProps) {
  const { t } = useTranslation();
  const { getResourcePermission } = usePermissionProvider();
  const modifiedAlertData = useMemo(
    () => alertsClassBase.getModifiedAlertDataForForm(alertDetails),
    [alertDetails]
  );
  const [loadingState, setLoadingState] = useState<AlertConfigLoadingState>({
    templates: false,
    functions: false,
  });
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [filterResources, setFilterResources] = useState<
    FilterResourceDescriptor[]
  >([]);
  const [templateResourcePermission, setTemplateResourcePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const {
    supportedFilters,
    supportedTriggers,
    containerEntities,
    supportedEventTypes,
  } = useMemo(() => {
    const resource = filterResources.find(
      (resource) => resource.name === alertDetails.filteringRules?.resources[0]
    );

    return {
      supportedFilters: resource?.supportedFilters,
      supportedTriggers: resource?.supportedActions,
      containerEntities: resource?.containerEntities,
      supportedEventTypes: resource?.supportedEventTypes,
    };
  }, [filterResources, alertDetails]);

  const fetchFunctions = useCallback(async () => {
    try {
      setLoadingState((prev) => ({ ...prev, functions: true }));
      const response = await getResourceFunctions();
      setFilterResources(response.data);
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.config') })
      );
    } finally {
      setLoadingState((prev) => ({ ...prev, functions: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extraFormWidgets = useMemo(
    () => alertsClassBase.getAddAlertFormExtraWidgets(),
    []
  );

  const fetchTemplates = useCallback(async () => {
    setLoadingState((state) => ({ ...state, templates: true }));
    try {
      const permission = await getResourcePermission(
        ResourceEntity.NOTIFICATION_TEMPLATE
      );

      setTemplateResourcePermission(permission);

      const { canViewAll } = getDerivedPermissionFlags(permission);
      if (canViewAll) {
        const { data } = await getAllNotificationTemplates({
          limit: PAGE_SIZE_LARGE,
          provider: ProviderType.User,
        });

        setTemplates(data);
      }
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.template-plural') })
      );
    } finally {
      setLoadingState((state) => ({ ...state, templates: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEmpty(extraFormWidgets)) {
      fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraFormWidgets]);

  useEffect(() => {
    fetchFunctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = useMemo(
    () => Object.values(loadingState).some((val) => val),
    [loadingState]
  );

  if (isLoading) {
    return <Loader />;
  }

  const {
    alertResources,
    alertFilters,
    alertActions,
    destinations,
    alertTimeout,
    alertReadTimeout,
  } = extractAlertViewData(alertDetails, modifiedAlertData);

  return (
    <Box className='tw:w-[60%]' direction="col" gap={4}>
      <NotificationSourceSelect
        isViewMode
        filterResources={filterResources}
        value={alertResources}
        onChange={() => {}}
      />

      {!isEmpty(alertFilters) && (
        <>
          <Box className="tw:border-t tw:border-secondary" />
          <NotificationFiltersEditor
            isViewMode
            containerEntities={containerEntities}
            selectedResources={alertResources}
            supportedEventTypes={supportedEventTypes}
            supportedFilters={supportedFilters}
            value={alertFilters}
            onChange={() => {}}
          />
        </>
      )}

      {!isEmpty(alertActions) && (
        <>
          <Box className="tw:border-t tw:border-secondary" />
          <ReadOnlyTriggerDisplay
            actions={alertActions}
            supportedTriggers={supportedTriggers}
          />
        </>
      )}

      <Box className="tw:border-t tw:border-secondary" />

      <NotificationDestinationBridge
        isViewMode
        renderValidationField={() => null}
        values={{
          destinations,
          readTimeout: alertReadTimeout,
          resources: alertResources,
          timeout: alertTimeout,
        }}
        onChange={() => {}}
      />

      {!isEmpty(extraFormWidgets) && (
        <>
          {Object.entries(extraFormWidgets).map(([name, Widget]) => (
            <Fragment key={name}>
              <Box className="tw:border-t tw:border-secondary" />
              <Widget
                isViewMode
                alertDetails={modifiedAlertData}
                formRef={null as never}
                loading={isLoading}
                templateResourcePermission={templateResourcePermission}
                templates={templates}
              />
            </Fragment>
          ))}
        </>
      )}
    </Box>
  );
}

export default NotificationAlertConfigView;
