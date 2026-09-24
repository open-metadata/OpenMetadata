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
  Button,
  FieldProp,
  FieldTypes,
  FormField,
  FormFields,
  FormItemLabel,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import NotificationDestinationBridge, {
  DestinationFormValidator,
} from './NotificationDestinationBridge';
import NotificationFiltersEditor from './NotificationFiltersEditor';
import NotificationSourceSelect from './NotificationSourceSelect';
import InlineAlert from '../../../../../common/InlineAlert/InlineAlert';
import Loader from '../../../../../common/Loader/Loader';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { NAME_FIELD_RULES } from '../../../../../../constants/Form.constants';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import {
  AlertType,
  EventFilterRule,
  EventSubscription,
  ProviderType,
} from '../../../../../../generated/events/eventSubscription';
import { FilterResourceDescriptor } from '../../../../../../generated/events/filterResourceDescriptor';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import type {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
} from './Notification.types';
import {
  createNotificationAlert,
  getAlertsFromName,
  getResourceFunctions,
  updateNotificationAlert,
} from '../../../../../../rest/alertsAPI';
import alertsClassBase from '../../../../../../utils/AlertsClassBase';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import { NotificationView } from './Notification.types';

interface NotificationAlertFormProps {
  fqn?: string;
  onNavigate: (view: NotificationView) => void;
}

type AlertFormValues = {
  displayName: string;
  description?: string;
  resources: string[];
  filters: EventFilterRule[];
  destinations: ModifiedDestination[];
  timeout: number;
  readTimeout: number;
};

function alertToFormValues(
  modifiedAlert: ReturnType<typeof alertsClassBase.getModifiedAlertDataForForm>
): AlertFormValues {
  return {
    displayName: getEntityName(modifiedAlert),
    description: modifiedAlert.description ?? '',
    resources:
      (
        modifiedAlert as unknown as {
          filteringRules?: { resources?: string[] };
        }
      ).filteringRules?.resources ?? [],
    filters:
      (
        modifiedAlert as unknown as {
          input?: { filters?: EventFilterRule[] };
        }
      ).input?.filters ?? [],
    destinations: modifiedAlert.destinations ?? [],
    timeout: modifiedAlert.timeout ?? 10,
    readTimeout: modifiedAlert.readTimeout ?? 30,
  };
}

const NotificationAlertForm: React.FC<NotificationAlertFormProps> = ({
  fqn,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { setInlineAlertDetails, inlineAlertDetails, currentUser } =
    useApplicationStore();
  const { getResourceLimit } = useLimitStore();

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entityFunctions, setEntityFunctions] = useState<
    FilterResourceDescriptor[]
  >([]);
  const [alert, setAlert] = useState<ModifiedEventSubscription>();
  const [initialData, setInitialData] = useState<EventSubscription>();

  const destinationValidateRef = useRef<DestinationFormValidator>();

  const isEditMode = Boolean(fqn);

  const form = useForm<AlertFormValues>({
    defaultValues: {
      displayName: '',
      description: '',
      resources: [],
      filters: [],
      destinations: [],
      timeout: 10,
      readTimeout: 30,
    },
  });

  const resources = form.watch('resources');
  const filters = form.watch('filters');
  const destinations = form.watch('destinations');
  const timeout = form.watch('timeout');
  const readTimeout = form.watch('readTimeout');

  const [selectedTrigger] = resources;

  const supportedFilters = useMemo(
    () =>
      entityFunctions.find((r) => r.name === selectedTrigger)?.supportedFilters,
    [entityFunctions, selectedTrigger]
  );

  const containerEntities = useMemo(
    () =>
      entityFunctions.find((r) => r.name === selectedTrigger)
        ?.containerEntities,
    [entityFunctions, selectedTrigger]
  );

  const supportedEventTypes = useMemo(
    () =>
      entityFunctions.find((r) => r.name === selectedTrigger)
        ?.supportedEventTypes,
    [entityFunctions, selectedTrigger]
  );

  const shouldShowFiltersSection = useMemo(
    () => (selectedTrigger ? !isEmpty(supportedFilters) : true),
    [selectedTrigger, supportedFilters]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [functionsResponse, alertResponse] = await Promise.allSettled([
        getResourceFunctions(),
        fqn ? getAlertsFromName(fqn) : Promise.resolve(null),
      ]);

      if (functionsResponse.status === 'fulfilled') {
        setEntityFunctions(functionsResponse.value.data);
      } else {
        showErrorToast(
          t('server.entity-fetch-error', { entity: t('label.config') })
        );
      }

      if (fqn && alertResponse.status === 'fulfilled' && alertResponse.value) {
        const rawAlert = alertResponse.value as EventSubscription;
        const modifiedAlert =
          alertsClassBase.getModifiedAlertDataForForm(rawAlert);

        setInitialData(rawAlert);
        setAlert(modifiedAlert);
        form.reset(alertToFormValues(modifiedAlert));
      } else if (fqn && alertResponse.status === 'rejected') {
        showErrorToast(
          t('server.entity-fetch-error', { entity: t('label.alert') })
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [fqn, form, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isSystemProvider = useMemo(
    () => alert?.provider === ProviderType.System,
    [alert]
  );

  const nameField: FieldProp = {
    name: 'displayName',
    label: t('label.name'),
    type: FieldTypes.TEXT,
    required: true,
    placeholder: t('label.enter-entity', { entity: t('label.name') }),
    rules: NAME_FIELD_RULES,
    props: { 'data-testid': 'alert-name-input' },
  };

  const handleSave = async (values: AlertFormValues) => {
    try {
      await destinationValidateRef.current?.();
    } catch {
      return;
    }

    setSaving(true);
    try {
      // Destructure out filters so it doesn't appear at top-level in the payload.
      // The backend rejects unknown top-level fields; filters belong only in input.filters.
      const { filters: _filters, ...restValues } = values;

      const submitData: ModifiedCreateEventSubscription = {
        ...restValues,
        name: values.displayName,
        alertType: AlertType.Notification,
        provider: ProviderType.User,
        input: {
          filters: values.filters.map(
            ({ name, effect, arguments: args }) => ({
              name,
              effect,
              arguments: args,
            })
          ),
        },
      } as unknown as ModifiedCreateEventSubscription;

      await alertsClassBase.handleAlertSave({
        data: submitData,
        fqn: fqn ?? '',
        initialData,
        currentUser,
        createAlertAPI: createNotificationAlert,
        updateAlertAPI: updateNotificationAlert,
        afterSaveAction: async (savedFqn: string) => {
          if (isEditMode) {
            onNavigate({
              type: 'detail',
              fqn: savedFqn,
              name: values.displayName,
            });
          } else {
            onNavigate({ type: 'list' });
            await getResourceLimit('eventsubscription', true, true);
          }
        },
        setInlineAlertDetails,
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  if (isSystemProvider) {
    return (
      <Box className="tw:flex tw:items-center tw:justify-center tw:h-full tw:p-6">
        <Typography
          className="tw:text-secondary tw:max-w-md tw:text-center"
          size="text-sm">
          {t('message.system-alert-edit-message')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="tw:flex tw:flex-col tw:h-full" direction="col">
      {/* Scrollable content area */}
      <Box className="tw:flex-1 tw:overflow-y-auto tw:p-6 tw:pt-0" direction="col">
        <Box className="tw:max-w-[50%] tw:w-full" direction="col" gap={4}>
          {/* Title + description */}
          <Box direction="col" gap={1}>
            <Typography size="text-lg" weight="semibold">
              {t(`label.${isEditMode ? 'edit' : 'add'}-entity`, {
                entity: t('label.alert'),
              })}
            </Typography>
            <Typography className="tw:text-secondary" size="text-sm">
              {t('message.alerts-description')}
            </Typography>
          </Box>

          <HookForm form={form}>
            <Box direction="col" gap={4}>
              {/* Name field */}
              <FormFields fields={[nameField]} />

              {/* Description field */}
              <FormField control={form.control} name="description">
                {({ field }) => (
                  <Box direction="col" gap={1}>
                    <FormItemLabel label={t('label.description')} />
                    <RichTextEditor
                      className="new-form-style"
                      data-testid="description"
                      initialValue={field.value ?? ''}
                      onTextChange={field.onChange}
                    />
                  </Box>
                )}
              </FormField>

              {/* Source section */}
              <NotificationSourceSelect
                filterResources={entityFunctions}
                value={resources}
                onChange={(newResources) => {
                  form.setValue('resources', newResources, {
                    shouldValidate: true,
                  });
                  form.setValue('filters', []);
                  form.setValue('destinations', []);
                }}
              />

              {/* Filters section */}
              {shouldShowFiltersSection && (
                <NotificationFiltersEditor
                  containerEntities={containerEntities}
                  selectedResources={resources}
                  supportedEventTypes={supportedEventTypes}
                  supportedFilters={supportedFilters}
                  value={filters}
                  onChange={(newFilters) =>
                    form.setValue('filters', newFilters)
                  }
                />
              )}

              {/* Destinations section */}
              <NotificationDestinationBridge
                renderValidationField={(validate) => {
                  destinationValidateRef.current = validate;

                  return null;
                }}
                values={{ destinations, resources, timeout, readTimeout }}
                onChange={(vals) => {
                  Object.entries(vals).forEach(([k, v]) => {
                    form.setValue(k as keyof AlertFormValues, v as never);
                  });
                }}
              />

              {/* Inline alert errors */}
              {inlineAlertDetails && <InlineAlert {...inlineAlertDetails} />}
            </Box>
          </HookForm>
        </Box>
      </Box>

      {/* Fixed footer */}
      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-btn"
          onPress={() => onNavigate({ type: 'list' })}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-btn"
          isLoading={saving}
          onPress={() => form.handleSubmit(handleSave)()}>
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );
};

export default NotificationAlertForm;
