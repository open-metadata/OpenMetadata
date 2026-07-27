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
import type {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { NotificationTemplate } from '../../generated/entity/events/notificationTemplate';
import { CreateEventSubscription } from '../../generated/events/api/createEventSubscription';
import {
  Destination,
  EventFilterRule,
  EventSubscription,
  SubscriptionCategory,
  SubscriptionType,
  Webhook,
} from '../../generated/events/eventSubscription';
import type { AddAlertFormWidgetProps } from '../../utils/AlertsClassBase';
import { AddAlertPageLoadingState } from '../AddNotificationPage/AddNotificationPage.interface';

export interface ObservabilityFilterResourceDescriptor {
  containerEntities?: string[];
  name?: string;
  supportedActions?: EventFilterRule[];
  supportedFilters?: EventFilterRule[];
}

export interface UseObservabilityAlertFormOptions {
  afterSaveAction?: (fqn: string) => Promise<void> | void;
  form?: FormInstance<ModifiedCreateEventSubscription>;
  fqn?: string;
  onCancel?: () => void;
}

export interface UseObservabilityAlertResourcesReturn {
  containerEntities?: string[];
  filterResources: ObservabilityFilterResourceDescriptor[];
  loading: boolean;
  shouldShowActionsSection: boolean;
  shouldShowFiltersSection: boolean;
  supportedFilters?: EventFilterRule[];
  supportedTriggers?: EventFilterRule[];
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

export interface ModifiedWebhookConfig extends Webhook {
  headers?: { key: string; value: string }[];
  queryParams?: { key: string; value: string }[];
}

export interface ModifiedDestination extends Destination {
  destinationType: SubscriptionType | SubscriptionCategory;
  config?: ModifiedWebhookConfig;
}

export interface ModifiedEventSubscription
  extends Omit<EventSubscription, 'notificationTemplate'> {
  destinations: ModifiedDestination[];
  notificationTemplate?: string | EventSubscription['notificationTemplate'];
  timeout: number;
  readTimeout: number;
}

export interface ModifiedCreateEventSubscription
  extends Omit<CreateEventSubscription, 'notificationTemplate'> {
  notificationTemplate?:
    | string
    | CreateEventSubscription['notificationTemplate'];
  customNotificationTemplateData?: NotificationTemplate;
  destinations: ModifiedDestination[];
  timeout: number;
  readTimeout: number;
}

export interface UseObservabilityAlertFormReturn {
  alert?: ModifiedEventSubscription;
  breadcrumb: {
    name: string;
    url: string;
  }[];
  containerEntities?: string[];
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
  shouldShowActionsSection: boolean;
  shouldShowFiltersSection: boolean;
  supportedFilters?: EventFilterRule[];
  supportedTriggers?: EventFilterRule[];
  templateResourcePermission: OperationPermission;
  templates: NotificationTemplate[];
}

export type ObservabilityAlertFormProps = UseObservabilityAlertFormReturn;

export type ObservabilityAlertFormFieldsProps = Pick<
  ObservabilityAlertFormProps,
  | 'alert'
  | 'containerEntities'
  | 'extraFormWidgets'
  | 'filterResources'
  | 'form'
  | 'isLoading'
  | 'shouldShowActionsSection'
  | 'shouldShowFiltersSection'
  | 'supportedFilters'
  | 'supportedTriggers'
  | 'templateResourcePermission'
  | 'templates'
>;

export interface AddObservabilityPageProps {
  pageTitle: string;
}
