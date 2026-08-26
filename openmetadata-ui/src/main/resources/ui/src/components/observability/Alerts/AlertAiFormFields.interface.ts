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
import InlineAlert from '../../../components/common/InlineAlert/InlineAlert';
import { NotificationTemplate } from '../../../generated/entity/events/notificationTemplate';
import {
  Destination,
  EventFilterRule,
} from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
  ObservabilityFilterResourceDescriptor,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { ComponentProps, ReactNode } from 'react';

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
  inlineAlert?: ComponentProps<typeof InlineAlert>;
  isViewOnly?: boolean;
  onChange?: (value: ModifiedCreateEventSubscription) => void;
  showBasicFields?: boolean;
  shouldShowActionsSection: boolean;
  shouldShowFiltersSection: boolean;
  supportedFilters?: EventFilterRule[];
  supportedTriggers?: EventFilterRule[];
  templates?: NotificationTemplate[];
  validationErrors?: AlertAiFormValidationErrors;
  value: AlertAiFormValue;
}

interface AlertAiFormBaseProps
  extends Omit<
    AlertAiFormFieldsProps,
    'isViewOnly' | 'onChange' | 'showBasicFields' | 'value'
  > {
  formId?: string;
  showHint?: boolean;
}

export interface AlertAiEditableFormProps extends AlertAiFormBaseProps {
  mode: Exclude<AlertAiFormMode, 'view'>;
  onChange: (value: ModifiedCreateEventSubscription) => void;
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
  inlineAlert?: ComponentProps<typeof InlineAlert>;
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
  supportedRules?: EventFilterRule[];
  title: string;
  isViewOnly?: boolean;
  onChange?: AlertAiFormFieldsProps['onChange'];
  validationErrors?: AlertAiFormValidationErrors;
  value: AlertAiFormValue;
}

export interface RuleArgumentFieldProps {
  argument: string;
  containerEntities?: string[];
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

export interface AlertAiNotificationSectionProps {
  isViewOnly?: boolean;
  onChange?: AlertAiFormFieldsProps['onChange'];
  templates?: NotificationTemplate[];
  value: AlertAiFormValue;
}
