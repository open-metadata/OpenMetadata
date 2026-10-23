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
import type { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, trim } from 'lodash';
import { DEFAULT_READ_TIMEOUT } from '../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../constants/constants';
import type { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import type { NotificationTemplate } from '../generated/entity/events/notificationTemplate';
import type { User } from '../generated/entity/teams/user';
import type { CreateEventSubscription } from '../generated/events/api/createEventSubscription';
import {
  SubscriptionCategory,
  type AlertFilteringInput,
  type ArgumentsInput,
  type EventFilterRule,
  type EventSubscription,
} from '../generated/events/eventSubscription';
import { searchContracts } from '../rest/contractAPI';
import type { NameSearch } from './Alerts/AlertSourceSearch';
import {
  getConfigHeaderArrayFromObject,
  getConfigHeaderObjectFromArray,
  getConfigQueryParamsArrayFromObject,
  getConfigQueryParamsObjectFromArray,
  getRandomizedAlertName,
} from './Alerts/AlertsUtilPure';
import type {
  HandleAlertSaveProps,
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from './AlertsClassBase.interface';
import { getEntityName } from './EntityNameUtils';
import { handleEntityCreationError } from './formUtils';
import { t } from './i18next/LocalUtil';
import { showErrorToast, showSuccessToast } from './ToastUtils';

export interface AddAlertFormWidgetProps {
  /**
   * The classic antd form instance, for widgets that write into it. Typed `unknown` so this
   * file stays antd-free; the AI alert modal does not pass it.
   */
  formRef?: unknown;
  /** The current form values, passed by every caller. */
  values?: ModifiedCreateEventSubscription;
  onValuesChange?: (changes: Partial<ModifiedCreateEventSubscription>) => void;
  alertDetails?: ModifiedEventSubscription;
  templates?: NotificationTemplate[];
  loading?: boolean;
  isViewMode?: boolean;
  templateResourcePermission?: OperationPermission;
}

/** Props for the notification template section of the AI alert form. */
export interface AlertAiTemplateSectionProps {
  /** Edits `notificationTemplate` and `customNotificationTemplateData`. */
  value: ModifiedCreateEventSubscription | ModifiedEventSubscription;
  onChange?: (value: ModifiedCreateEventSubscription) => void;
  isViewOnly?: boolean;
  loading?: boolean;
  templates?: NotificationTemplate[];
  templateResourcePermission?: OperationPermission;
}

// Data contracts are not in the search indexes, so their names come from the contract API.
const searchDataContractNames: NameSearch = async (searchText) => {
  try {
    const contracts = await searchContracts(searchText, PAGE_SIZE_LARGE);

    return contracts
      .map((contract) => contract.fullyQualifiedName ?? '')
      .filter(Boolean)
      .map((fullyQualifiedName) => ({
        label: fullyQualifiedName,
        value: fullyQualifiedName,
      }));
  } catch (error) {
    showErrorToast(
      error as AxiosError,
      t('server.entity-fetch-error', { entity: t('label.data-contract') })
    );

    return [];
  }
};

/**
 * Converts the legacy `filteringRules.rules`/`actions` shape — `EventFilterRule[]`, where each
 * rule's `arguments` are argument names — into the modern `input` selections (`ArgumentsInput[]`)
 * the AI alert form edits. Each rule's name, effect and prefix condition are preserved, and its
 * arguments are carried by name. The argument *values* of a hand-written rule live only in its SpEL
 * `condition`, which the selection-based form cannot represent; carrying the names is enough to
 * list a saved rule instead of hiding it, so a saved alert never shows its rules blank.
 */
const rulesToArgumentsInput = (rules?: EventFilterRule[]): ArgumentsInput[] =>
  (rules ?? []).map((rule) => ({
    arguments: rule.arguments?.map((argumentName) => ({ name: argumentName })),
    effect: rule.effect,
    name: rule.name,
    prefixCondition: rule.prefixCondition,
  }));

/**
 * Returns the `input` the AI alert form should display. A modern alert already carries
 * its selections in `input`. A legacy alert whose rules live only in `filteringRules.rules`/`actions`
 * with no `input` — the backend's `WrittenByHand` classification, still evaluated at runtime — is
 * seeded from that legacy shape so the form shows its saved rules instead of hiding them.
 * This mirrors the existing `filteringRules.resources` fallback the Sources section already relies on.
 *
 * The seeded arguments carry names but no `input` values (their values live in the SpEL `condition`,
 * which the selection-based form cannot represent). `getAlertUpdateData` strips those incomplete
 * rules from the submitted `input` so the backend keeps the original `filteringRules` via its
 * `WrittenByHand` policy, instead of recompiling from selections it cannot rebuild.
 */
const getAlertInputForForm = (
  alert: Pick<EventSubscription, 'input' | 'filteringRules'>
): AlertFilteringInput | undefined => {
  if (alert.input) {
    return alert.input;
  }
  const rules = alert.filteringRules?.rules;
  const actions = alert.filteringRules?.actions;

  if (!rules?.length && !actions?.length) {
    return undefined;
  }

  return {
    filters: rulesToArgumentsInput(rules),
    actions: rulesToArgumentsInput(actions),
  };
};

/**
 * Returns the `input` to include in the PATCH body. A legacy alert (no `input` of its own)
 * carries its rules only in `filteringRules` as SpEL `condition`s the selection-based form
 * cannot represent. The form seeds `input` from that legacy shape for display (see
 * `getAlertInputForForm`), but the seeded arguments carry names without values. Submitting
 * any `input` — even one that keeps only a user-added rule — makes the backend choose
 * `FromSelections`, which replaces the entire `filteringRules` and silently drops the
 * hand-written rules. Submitting a partially filled legacy rule makes the backend reject
 * the save. And submitting an `input` from which the user deleted or toggled a legacy rule
 * still leaves `filteringRules` untouched, so the edit is silently ignored.
 *
 * So a legacy alert never submits `input`: the backend's `WrittenByHand` policy keeps the
 * original `filteringRules` unchanged. The user can still edit the alert's name, description,
 * destinations, and sources. A modern alert carries its own `input`, which the form edits
 * directly, so it is passed through unchanged.
 */
const getSubmittedInput = (
  input: AlertFilteringInput | undefined,
  initialData: EventSubscription
): { actions: ArgumentsInput[]; filters: ArgumentsInput[] } | undefined => {
  if (initialData.input == null) {
    return undefined;
  }

  return {
    actions: input?.actions ?? [],
    filters: input?.filters ?? [],
  };
};

class AlertsClassBase {
  /**
   * The AI alert form's notification template section. Templates are a Collate
   * feature, so OSS renders none; Collate returns its own section.
   */
  public getAlertAiTemplateSection(): React.ComponentType<AlertAiTemplateSectionProps> | null {
    return null;
  }

  /** Sources whose names are not in the search indexes, with the search that finds them. */
  public getSourceNameSearch(): Record<string, NameSearch> {
    return { [EntityType.DATA_CONTRACT]: searchDataContractNames };
  }

  public getAddAlertFormExtraWidgets() {
    const widgets: Record<
      string,
      React.ComponentType<AddAlertFormWidgetProps>
    > = {};

    return widgets;
  }
  public getAddAlertFormExtraButtons() {
    const buttons: Record<
      string,
      React.ComponentType<AddAlertFormWidgetProps>
    > = {};

    return buttons;
  }

  public formatDestinations(
    data: ModifiedCreateEventSubscription,
    initialData?: EventSubscription
  ) {
    const destinations = data.destinations?.map((d) => {
      const initialDestination =
        d.id && initialData?.destinations?.find((dest) => dest.id === d.id);

      return {
        ...(initialDestination ?? {}),
        type: d.type,
        config: {
          ...d.config,
          headers: getConfigHeaderObjectFromArray(d.config?.headers),
          queryParams: getConfigQueryParamsObjectFromArray(
            d.config?.queryParams
          ),
        },
        category: d.category,
        timeout: data.timeout,
        readTimeout: data.readTimeout,
        notifyDownstream: d.notifyDownstream,
        downstreamDepth: d.downstreamDepth,
      };
    });

    return destinations;
  }

  public getCommonAlertFieldsData(
    data: ModifiedCreateEventSubscription,
    initialData?: EventSubscription
  ) {
    const alertName = trim(initialData?.name ?? getRandomizedAlertName());
    const alertDisplayName = trim(getEntityName(data));
    const destinations = this.formatDestinations(data, initialData);

    return { alertName, alertDisplayName, destinations };
  }

  public getAlertCreationData(
    data: ModifiedCreateEventSubscription,
    initialData?: EventSubscription,
    currentUser?: User
  ): CreateEventSubscription {
    const { alertName, alertDisplayName, destinations } =
      this.getCommonAlertFieldsData(data, initialData);
    // Remove timeout from alert object since it's only for UI

    const { timeout: _timeout, readTimeout: _readTimeout, ...finalData } = data;

    return {
      ...(finalData as CreateEventSubscription),
      destinations,
      name: alertName,
      displayName: alertDisplayName,
      ...(currentUser?.id
        ? {
            owners: [
              {
                id: currentUser.id,
                type: EntityType.USER,
              },
            ],
          }
        : {}),
    };
  }

  public getAlertUpdateData(
    data: ModifiedCreateEventSubscription,
    initialData: EventSubscription
  ) {
    const { alertName, alertDisplayName, destinations } =
      this.getCommonAlertFieldsData(data, initialData);
    const { description, input, owners, resources } = data;
    const submittedInput = getSubmittedInput(input, initialData);

    return {
      ...initialData,
      description,
      displayName: alertDisplayName,
      name: alertName,
      ...(submittedInput ? { input: submittedInput } : {}),
      owners,
      filteringRules: {
        ...initialData.filteringRules,
        resources: resources ?? [],
      },
      destinations: destinations ?? [],
    };
  }

  public async handleAlertSave({
    data,
    fqn,
    initialData,
    createAlertAPI,
    updateAlertAPI,
    afterSaveAction,
    setInlineAlertDetails,
    currentUser,
  }: HandleAlertSaveProps) {
    try {
      let alertDetails;

      if (fqn && !isUndefined(initialData)) {
        const newAlertData: EventSubscription = this.getAlertUpdateData(
          data,
          initialData
        );

        const jsonPatch = compare(
          omitBy(initialData, isUndefined),
          newAlertData
        );

        alertDetails = await updateAlertAPI(initialData.id, jsonPatch);
      } else {
        const finalData = this.getAlertCreationData(
          data,
          initialData,
          currentUser
        );

        alertDetails = await createAlertAPI(finalData);
      }

      const action = fqn && !isUndefined(initialData) ? 'update' : 'create';
      showSuccessToast(
        t(`server.${action}-entity-success`, {
          entity: t('label.alert-plural'),
        })
      );
      afterSaveAction(alertDetails.fullyQualifiedName ?? '');
    } catch (error) {
      handleEntityCreationError({
        error: error as AxiosError,
        entity: t('label.alert'),
        entityLowercase: t('label.alert-lowercase'),
        entityLowercasePlural: t('label.alert-lowercase-plural'),
        setInlineAlertDetails,
        name: data.name,
        defaultErrorType: 'create',
      });
    }
  }

  public getModifiedAlertDataForForm(
    alertData: EventSubscription
  ): ModifiedEventSubscription {
    // Seed `input` from the legacy `filteringRules` shape when it is absent, so a saved
    // WrittenByHand alert's rules/actions are shown in view mode and editable in the drawer —
    // and so a save carries them in `input` instead of the backend recompiling them away.
    const input = getAlertInputForForm(alertData);

    return {
      ...alertData,
      ...(input ? { input } : {}),
      timeout: alertData.destinations[0].timeout ?? 10,
      readTimeout:
        alertData.destinations[0].readTimeout ?? DEFAULT_READ_TIMEOUT,
      destinations: alertData.destinations.map((destination) => {
        const isExternalDestination =
          destination.category === SubscriptionCategory.External;

        return {
          ...destination,
          destinationType: isExternalDestination
            ? destination.type
            : destination.category,
          config: {
            ...destination.config,
            headers: getConfigHeaderArrayFromObject(
              destination.config?.headers
            ),
            queryParams: getConfigQueryParamsArrayFromObject(
              destination.config?.queryParams
            ),
          },
        };
      }),
    };
  }
}

const alertsClassBase = new AlertsClassBase();

export default alertsClassBase;
export { AlertsClassBase };
