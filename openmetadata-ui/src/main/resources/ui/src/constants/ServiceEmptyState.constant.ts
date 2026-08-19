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
  BarChartSquare02,
  Brackets,
  Cube01,
  Database01,
  Dataflow03,
  HardDrive,
  LayersThree01,
  MessageSquare01,
  SearchMd,
  Server01,
  Shield01,
} from '@untitledui/icons';
import { FC } from 'react';
import { ServiceCategory } from '../enums/service.enum';

export interface ServiceEmptyStateConfig {
  icon: FC<{ className?: string }>;
  titleKey: string;
  descriptionKey: string;
}

/**
 * Brand color for the placeholder icons, matching the design.
 *
 * Applied by the consumer when it renders the icon element
 * (`<Icon className={SERVICE_EMPTY_STATE_ICON_CLASS} />`) rather than stored per-config: a bare
 * component reference — which is what this `.ts` module holds, so it stays free of JSX — has
 * nowhere to carry a className, and `EmptyPlaceholder` merges the class off the rendered element.
 */
export const SERVICE_EMPTY_STATE_ICON_CLASS = 'tw:text-fg-brand-primary';

/**
 * First-run placeholder shown on a service listing that has no services yet — one entry per
 * category so an empty list explains what that category is for instead of reading as a dead end.
 *
 * Icons are the same ones the connections tab rail uses per category (`CATEGORY_ICONS` in
 * Collate's `ConnectionsSecondaryNav.tsx`) — kept as a literal duplicate here rather than a shared
 * import because that file lives in the Collate app, which depends on this OSS module, not the
 * other way around.
 */
export const SERVICE_EMPTY_STATE: Record<
  ServiceCategory,
  ServiceEmptyStateConfig
> = {
  [ServiceCategory.API_SERVICES]: {
    icon: Brackets,
    titleKey: 'message.empty-api-services-title',
    descriptionKey: 'message.empty-api-services-description',
  },
  [ServiceCategory.DASHBOARD_SERVICES]: {
    icon: BarChartSquare02,
    titleKey: 'message.empty-dashboard-services-title',
    descriptionKey: 'message.empty-dashboard-services-description',
  },
  [ServiceCategory.DATABASE_SERVICES]: {
    icon: Database01,
    titleKey: 'message.empty-database-services-title',
    descriptionKey: 'message.empty-database-services-description',
  },
  [ServiceCategory.DRIVE_SERVICES]: {
    icon: HardDrive,
    titleKey: 'message.empty-drive-services-title',
    descriptionKey: 'message.empty-drive-services-description',
  },
  [ServiceCategory.MESSAGING_SERVICES]: {
    icon: MessageSquare01,
    titleKey: 'message.empty-messaging-services-title',
    descriptionKey: 'message.empty-messaging-services-description',
  },
  [ServiceCategory.METADATA_SERVICES]: {
    icon: LayersThree01,
    titleKey: 'message.empty-metadata-services-title',
    descriptionKey: 'message.empty-metadata-services-description',
  },
  [ServiceCategory.ML_MODEL_SERVICES]: {
    icon: Cube01,
    titleKey: 'message.empty-ml-model-services-title',
    descriptionKey: 'message.empty-ml-model-services-description',
  },
  [ServiceCategory.PIPELINE_SERVICES]: {
    icon: Dataflow03,
    titleKey: 'message.empty-pipeline-services-title',
    descriptionKey: 'message.empty-pipeline-services-description',
  },
  [ServiceCategory.SEARCH_SERVICES]: {
    icon: SearchMd,
    titleKey: 'message.empty-search-services-title',
    descriptionKey: 'message.empty-search-services-description',
  },
  [ServiceCategory.SECURITY_SERVICES]: {
    icon: Shield01,
    titleKey: 'message.empty-security-services-title',
    descriptionKey: 'message.empty-security-services-description',
  },
  [ServiceCategory.STORAGE_SERVICES]: {
    icon: Server01,
    titleKey: 'message.empty-storage-services-title',
    descriptionKey: 'message.empty-storage-services-description',
  },
};

export const getServiceEmptyStateConfig = (
  serviceCategory: string
): ServiceEmptyStateConfig =>
  SERVICE_EMPTY_STATE[serviceCategory as ServiceCategory] ??
  SERVICE_EMPTY_STATE[ServiceCategory.DATABASE_SERVICES];
