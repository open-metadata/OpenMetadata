/*
 *  Copyright 2024 Collate.
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

import type { FormInstance } from 'antd';
import type { ComponentType } from 'react';
import type { InlineAlertProps } from '../../components/common/InlineAlert/InlineAlert.interface';
import type { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import type { ResourceEntity } from '../../enums/permissions.enum';
import type { NotificationTemplate } from '../../generated/entity/events/notificationTemplate';
import {
  AlertType,
  EventFilterRule,
} from '../../generated/events/eventSubscription';
import { EventType } from '../../generated/type/changeEvent';
import type { AlertSelection } from '../../hooks/useAlertSelection';
import type { AddAlertFormWidgetProps } from '../../utils/AlertsClassBase';
import type {
  AddAlertPageLoadingState,
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
  ModifiedWebhookConfig,
} from '../../utils/AlertsClassBase.interface';

export type {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
  ModifiedWebhookConfig,
};

export interface ObservabilityFilterResourceDescriptor {
  containerEntities?: string[];
  name?: string;
  supportedActions?: EventFilterRule[];
  /** Event types the source emits; narrows the event-type filter options. */
  supportedEventTypes?: EventType[];
  supportedFilters?: EventFilterRule[];
}

export interface UseObservabilityAlertFormOptions {
  afterSaveAction?: (fqn: string) => Promise<void> | void;
  /** Defaults to Observability; selects which resource catalogue to load. */
  alertType?: AlertType;
  form?: FormInstance<ModifiedCreateEventSubscription>;
  fqn?: string;
  onCancel?: () => void;
}

export interface UseAlertFormDataOptions
  extends Omit<UseObservabilityAlertFormOptions, 'form'> {
  /** The chosen alert sources; the server says what they support. */
  sources?: string[];
  /** The filters and triggers chosen so far, so the server can warn about sources they never match. */
  input?: ModifiedCreateEventSubscription['input'];
}

export interface UseObservabilityAlertResourcesReturn {
  filterResources: ObservabilityFilterResourceDescriptor[];
  loading: boolean;
  selection: AlertSelection;
  shouldShowActionsSection: boolean;
  shouldShowFiltersSection: boolean;
}

export interface UseObservabilityAlertTemplatesReturn {
  loading: boolean;
  templateResourcePermission: OperationPermission;
  templates: NotificationTemplate[];
}

export interface UseObservabilityAlertTemplatesOptions {
  extraFormWidgets: Record<string, ComponentType<AddAlertFormWidgetProps>>;
  getResourcePermission: (
    resourceEntity: ResourceEntity
  ) => Promise<OperationPermission>;
}

export interface UseObservabilityAlertFormReturn {
  alert?: ModifiedEventSubscription;
  breadcrumb: {
    name: string;
    url: string;
  }[];
  extraFormButtons: Record<string, ComponentType<AddAlertFormWidgetProps>>;
  extraFormWidgets: Record<string, ComponentType<AddAlertFormWidgetProps>>;
  filterResources: ObservabilityFilterResourceDescriptor[];
  form: FormInstance<ModifiedCreateEventSubscription>;
  handleCancel: () => void;
  handleSave: (data: ModifiedCreateEventSubscription) => Promise<void>;
  inlineAlertDetails?: InlineAlertProps;
  isEditMode: boolean;
  isLoading: boolean;
  loadingState: AddAlertPageLoadingState;
  saving: boolean;
  selection: AlertSelection;
  shouldShowActionsSection: boolean;
  shouldShowFiltersSection: boolean;
  templateResourcePermission: OperationPermission;
  templates: NotificationTemplate[];
}

export type UseAlertFormDataReturn = Omit<
  UseObservabilityAlertFormReturn,
  'form'
>;

export type ObservabilityAlertFormProps = UseObservabilityAlertFormReturn;

export type ObservabilityAlertFormFieldsProps = Pick<
  ObservabilityAlertFormProps,
  | 'alert'
  | 'extraFormWidgets'
  | 'filterResources'
  | 'form'
  | 'isLoading'
  | 'shouldShowActionsSection'
  | 'shouldShowFiltersSection'
  | 'templateResourcePermission'
  | 'templates'
>;

export interface AddObservabilityPageProps {
  pageTitle: string;
}
