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

import { TFunction } from 'i18next';
import { isEmpty, isNil, isString } from 'lodash';
import {
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { getMessageFromArgumentName } from '../../../utils/Alerts/AlertsUtilPure';
import {
  AlertAiFormValidationErrors,
  RuleSectionField,
} from './AlertAiFormFields.interface';
import {
  getValidationPath,
  isInternalDestination,
  isWebhookDestination,
} from './AlertAiFormFieldsPureUtils';

const isRequiredValueMissing = (value: unknown) => {
  if (Array.isArray(value)) {
    return isEmpty(value);
  }

  if (isString(value)) {
    return isEmpty(value.trim());
  }

  return isNil(value);
};

const getRequiredFieldMessage = (fieldText: string, t: TFunction) =>
  t('message.field-text-is-required', { fieldText });

const setRequiredError = ({
  errors,
  fieldText,
  path,
  t,
  value,
}: {
  errors: AlertAiFormValidationErrors;
  fieldText: string;
  path: string;
  t: TFunction;
  value: unknown;
}) => {
  if (isRequiredValueMissing(value)) {
    errors[path] = getRequiredFieldMessage(fieldText, t);
  }
};

const validateAlertAiRuleFields = ({
  errors,
  field,
  t,
  value,
}: {
  errors: AlertAiFormValidationErrors;
  field: RuleSectionField;
  t: TFunction;
  value: ModifiedCreateEventSubscription;
}) => {
  const selectedRules = value.input?.[field] ?? [];
  const ruleLabel =
    field === 'filters' ? t('label.filter') : t('label.trigger');

  selectedRules.forEach((rule, ruleIndex) => {
    setRequiredError({
      errors,
      fieldText: ruleLabel,
      path: getValidationPath('input', field, ruleIndex, 'name'),
      t,
      value: rule.name,
    });

    rule.arguments?.forEach((argument, argumentIndex) => {
      const argumentPath = getValidationPath(
        'input',
        field,
        ruleIndex,
        'arguments',
        argumentIndex,
        'input'
      );

      if (isRequiredValueMissing(argument.input)) {
        errors[argumentPath] = argument.name
          ? getMessageFromArgumentName(argument.name)
          : getRequiredFieldMessage(t('label.value'), t);
      }
    });
  });
};

const validateAlertAiDestinationConfig = ({
  destination,
  errors,
  index,
  t,
}: {
  destination: ModifiedDestination;
  errors: AlertAiFormValidationErrors;
  index: number;
  t: TFunction;
}) => {
  const destinationType = destination.destinationType;
  const configPath = (...path: (string | number)[]) =>
    getValidationPath('destinations', index, 'config', ...path);

  if (destinationType === SubscriptionType.Email) {
    setRequiredError({
      errors,
      fieldText: t('label.email'),
      path: configPath('receivers'),
      t,
      value: destination.config?.receivers,
    });
  }

  if (
    destinationType === SubscriptionCategory.Teams ||
    destinationType === SubscriptionCategory.Users
  ) {
    setRequiredError({
      errors,
      fieldText: t('label.receiver-plural'),
      path: configPath('receivers'),
      t,
      value: destination.config?.receivers,
    });
  }

  if (!isWebhookDestination(destinationType)) {
    return;
  }

  setRequiredError({
    errors,
    fieldText: t('label.endpoint-url'),
    path: configPath('endpoint'),
    t,
    value: destination.config?.endpoint,
  });

  const authType = destination.config?.authType?.type;

  if (authType === Type.Bearer) {
    setRequiredError({
      errors,
      fieldText: t('label.secret-key'),
      path: configPath('authType', 'secretKey'),
      t,
      value: destination.config?.authType?.secretKey,
    });
  }

  if (authType === Type.Oauth2) {
    setRequiredError({
      errors,
      fieldText: t('label.token-url'),
      path: configPath('authType', 'tokenUrl'),
      t,
      value: destination.config?.authType?.tokenUrl,
    });
    setRequiredError({
      errors,
      fieldText: t('label.client-id'),
      path: configPath('authType', 'clientId'),
      t,
      value: destination.config?.authType?.clientId,
    });
    setRequiredError({
      errors,
      fieldText: t('label.client-secret'),
      path: configPath('authType', 'clientSecret'),
      t,
      value: destination.config?.authType?.clientSecret,
    });
  }
};

const validateAlertAiDestinationFields = ({
  errors,
  t,
  value,
}: {
  errors: AlertAiFormValidationErrors;
  t: TFunction;
  value: ModifiedCreateEventSubscription;
}) => {
  setRequiredError({
    errors,
    fieldText: t('label.destination'),
    path: 'destinations',
    t,
    value: value.destinations,
  });

  value.destinations?.forEach((destination, index) => {
    setRequiredError({
      errors,
      fieldText: t('label.destination'),
      path: getValidationPath('destinations', index, 'destinationType'),
      t,
      value: destination.destinationType,
    });

    if (isInternalDestination(destination.destinationType)) {
      setRequiredError({
        errors,
        fieldText: t('label.type'),
        path: getValidationPath('destinations', index, 'type'),
        t,
        value: destination.type,
      });
    }

    if (
      destination.notifyDownstream &&
      Number(destination.downstreamDepth) <= 0
    ) {
      errors[getValidationPath('destinations', index, 'downstreamDepth')] = t(
        'message.value-must-be-greater-than',
        {
          field: t('label.downstream-depth'),
          minimum: 0,
        }
      );
    }

    validateAlertAiDestinationConfig({ destination, errors, index, t });
  });
};

/** Validates the controlled AI alert form before passing data to the OSS save hook. */
export const validateAlertAiForm = (
  value: ModifiedCreateEventSubscription,
  t: TFunction
): AlertAiFormValidationErrors => {
  const errors: AlertAiFormValidationErrors = {};

  setRequiredError({
    errors,
    fieldText: t('label.name'),
    path: 'displayName',
    t,
    value: value.displayName ?? value.name,
  });

  setRequiredError({
    errors,
    fieldText: t('label.source'),
    path: 'resources',
    t,
    value: value.resources,
  });

  validateAlertAiRuleFields({ errors, field: 'filters', t, value });
  validateAlertAiRuleFields({ errors, field: 'actions', t, value });
  validateAlertAiDestinationFields({ errors, t, value });

  return errors;
};
