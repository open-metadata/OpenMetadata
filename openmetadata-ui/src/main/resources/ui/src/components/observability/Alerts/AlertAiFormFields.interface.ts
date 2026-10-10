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

import { SelectItemType } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { InlineAlertProps } from '../../../components/common/InlineAlert/InlineAlert.interface';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { NotificationTemplate } from '../../../generated/entity/events/notificationTemplate';
import {
  Destination,
  EventFilterRule,
} from '../../../generated/events/eventSubscription';
import { EventType } from '../../../generated/type/changeEvent';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
  ObservabilityFilterResourceDescriptor,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import type { AlertSourceSearch } from '../../../utils/Alerts/AlertSourceSearch';

export type AlertAiFormMode = 'add' | 'edit' | 'view';

export type AlertAiFormValue =
  | ModifiedCreateEventSubscription
  | ModifiedEventSubscription;

export type RuleSectionField = 'actions' | 'filters';

export type AlertAiFormValidationErrors = Record<string, string>;

export interface AlertAiFormFieldsProps {
  alert?: ModifiedEventSubscription;
  containerEntities?: string[];
  filterResources: ObservabilityFilterResourceDescriptor[];
  inlineAlert?: InlineAlertProps;
  isViewOnly?: boolean;
  // Accepts a value or a functional updater. Prefer the updater — it composes against the latest
  // state so rapid edits don't clobber each other. The value form stays assignable to the
  // value-only AlertAiTemplateSectionProps.onChange (Collate), so the two repos can merge in any order.
  onChange?: (
    valueOrUpdater:
      | ModifiedCreateEventSubscription
      | ((
          prev: ModifiedCreateEventSubscription
        ) => ModifiedCreateEventSubscription)
  ) => void;
  /** The recipient categories the server offers for the selected sources. */
  recipientCategories?: string[];
  showBasicFields?: boolean;
  shouldShowActionsSection: boolean;
  shouldShowFiltersSection: boolean;
  supportedFilters?: EventFilterRule[];
  supportedTriggers?: EventFilterRule[];
  templateResourcePermission?: OperationPermission;
  templates?: NotificationTemplate[];
  templatesLoading?: boolean;
  validationErrors?: AlertAiFormValidationErrors;
  value: AlertAiFormValue;
}

interface AlertAiFormBaseProps
  extends Omit<
    AlertAiFormFieldsProps,
    'isViewOnly' | 'onChange' | 'showBasicFields' | 'value'
  > {
  fieldDocDisplay?: 'popover' | 'panel';
  formId?: string;
  showHint?: boolean;
}

export interface AlertAiEditableFormProps extends AlertAiFormBaseProps {
  mode: Exclude<AlertAiFormMode, 'view'>;
  onChange: (
    valueOrUpdater:
      | ModifiedCreateEventSubscription
      | ((
          prev: ModifiedCreateEventSubscription
        ) => ModifiedCreateEventSubscription)
  ) => void;
  onSubmit: (value: ModifiedCreateEventSubscription) => Promise<void> | void;
  value: ModifiedCreateEventSubscription;
}

export interface AlertAiViewFormProps extends AlertAiFormBaseProps {
  mode: 'view';
  onChange?: never;
  onSubmit?: never;
  value: AlertAiFormValue;
}

export type AlertAiFormProps = AlertAiEditableFormProps | AlertAiViewFormProps;

export interface AlertAiFieldStateProps {
  isViewOnly?: boolean;
  onChange?: AlertAiFormFieldsProps['onChange'];
  value: AlertAiFormValue;
}

export interface AlertAiFormExternalProps extends AlertAiFieldStateProps {
  inlineAlert?: InlineAlertProps;
}

export interface AlertAiSectionProps {
  children: ReactNode;
  description?: string;
  isRequired?: boolean;
  title: string;
}

export interface RuleSectionProps {
  containerEntities?: string[];
  field: RuleSectionField;
  selectedSource?: string;
  supportedEventTypes?: EventType[];
  supportedRules?: EventFilterRule[];
  title: string;
  isViewOnly?: boolean;
  onChange?: AlertAiFormFieldsProps['onChange'];
  validationErrors?: AlertAiFormValidationErrors;
  value: AlertAiFormValue;
}

export interface RuleArgumentFieldProps {
  testId?: string;
  sourceSearch?: AlertSourceSearch;
  argument: string;
  containerEntities?: string[];
  supportedEventTypes?: EventType[];
  field: RuleSectionField;
  index: number;
  name: number;
  isViewOnly?: boolean;
  onChange?: AlertAiFormFieldsProps['onChange'];
  validationErrors?: AlertAiFormValidationErrors;
  value: AlertAiFormValue;
}

export interface AiArgumentTextInputProps extends RuleArgumentFieldProps {
  label: string;
  placeholder: string;
}

export interface AiArgumentMultiSelectProps extends RuleArgumentFieldProps {
  items: SelectItemType[];
  label: string;
  placeholder: string;
}

export interface AiArgumentAutocompleteProps extends RuleArgumentFieldProps {
  label: string;
  placeholder: string;
  selectedSource?: string;
}

export interface AlertAiDestinationSectionProps {
  isViewOnly?: boolean;
  onChange?: AlertAiFormFieldsProps['onChange'];
  recipientCategories?: string[];
  selectedSource?: string;
  validationErrors?: AlertAiFormValidationErrors;
  value: AlertAiFormValue;
}

export interface AlertAiDestinationItemProps
  extends AlertAiDestinationSectionProps {
  name: number;
  remove?: (index: number) => void;
  destination: ModifiedDestination;
  destinationsWithStatus?: Destination[];
  isDestinationStatusLoading?: boolean;
}
