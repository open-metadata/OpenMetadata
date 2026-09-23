/*
 *  Copyright 2022 Collate.
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
  BadgeColors,
  IconComponentType,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  AlertTriangle,
  Announcement02,
  InfoCircle,
  SlashCircle01,
} from '@untitledui/icons';
import { EntityType } from '../enums/entity.enum';
import {
  AnnouncementColor,
  AnnouncementStatus,
  AnnouncementType,
} from '../generated/entity/feed/announcement';
import { AnnouncementEntity } from '../rest/announcementsAPI';

export const ANNOUNCEMENT_ENTITIES = [
  EntityType.TABLE,
  EntityType.DASHBOARD,
  EntityType.TOPIC,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.STORED_PROCEDURE,
  EntityType.SEARCH_INDEX,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.DATABASE_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.METADATA_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.DRIVE_SERVICE,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.METRIC,
  EntityType.CHART,
  EntityType.DIRECTORY,
  EntityType.FILE,
  EntityType.SPREADSHEET,
  EntityType.WORKSHEET,
  EntityType.DATA_PRODUCT,
  EntityType.DOMAIN,
];

/* 
    @param startTime: number  -> Milliseconds
    @param endTime: number -> Milliseconds
    @returns boolean
    
*/
export const isActiveAnnouncement = (startTime: number, endTime: number) => {
  const currentTime = Date.now();

  return currentTime > startTime && currentTime < endTime;
};

/*
    @param startTime: number -> Milliseconds
    @returns boolean
*/
export const isScheduledAnnouncement = (startTime: number) =>
  Date.now() < startTime;

/**
 * `AnnouncementColor` (schema) and `BadgeColors` (ui-core-components) are the same
 * palette families. Mapping them explicitly keeps that pinned at compile time — if
 * either list drifts, this record stops type-checking.
 */
export const ANNOUNCEMENT_COLORS: Record<AnnouncementColor, BadgeColors> = {
  [AnnouncementColor.Gray]: 'gray',
  [AnnouncementColor.Brand]: 'brand',
  [AnnouncementColor.Error]: 'error',
  [AnnouncementColor.Warning]: 'warning',
  [AnnouncementColor.Success]: 'success',
  [AnnouncementColor.GrayBlue]: 'gray-blue',
  [AnnouncementColor.BlueLight]: 'blue-light',
  [AnnouncementColor.Blue]: 'blue',
  [AnnouncementColor.BlueDark]: 'blue-dark',
  [AnnouncementColor.Indigo]: 'indigo',
  [AnnouncementColor.Purple]: 'purple',
  [AnnouncementColor.Pink]: 'pink',
  [AnnouncementColor.Orange]: 'orange',
};

export interface AnnouncementTypeConfig {
  color: BadgeColors;
  icon: IconComponentType;
  labelKey: string;
}

export const ANNOUNCEMENT_TYPE_CONFIG: Record<
  AnnouncementType,
  AnnouncementTypeConfig
> = {
  [AnnouncementType.Critical]: {
    color: 'error',
    icon: AlertCircle,
    labelKey: 'label.critical',
  },
  [AnnouncementType.Notice]: {
    color: 'blue',
    icon: InfoCircle,
    labelKey: 'label.notice',
  },
  [AnnouncementType.Warning]: {
    color: 'warning',
    icon: AlertTriangle,
    labelKey: 'label.warning',
  },
  [AnnouncementType.Deprecation]: {
    color: 'gray',
    icon: SlashCircle01,
    labelKey: 'label.deprecation',
  },
  [AnnouncementType.Custom]: {
    color: 'pink',
    icon: Announcement02,
    labelKey: 'label.custom',
  },
};

export const DEFAULT_ANNOUNCEMENT_TYPE = AnnouncementType.Notice;

/**
 * Resolves the icon, badge label and palette family an announcement renders with.
 * Only `Custom` honours the stored `color`; every other type derives it from the type
 * so the severity stays readable at a glance.
 */
export const getAnnouncementTypeConfig = (
  announcement: Pick<AnnouncementEntity, 'announcementType' | 'color'>
): AnnouncementTypeConfig => {
  const type = announcement.announcementType ?? DEFAULT_ANNOUNCEMENT_TYPE;
  const config =
    ANNOUNCEMENT_TYPE_CONFIG[type] ??
    ANNOUNCEMENT_TYPE_CONFIG[DEFAULT_ANNOUNCEMENT_TYPE];

  if (type !== AnnouncementType.Custom || !announcement.color) {
    return config;
  }

  return { ...config, color: ANNOUNCEMENT_COLORS[announcement.color] };
};

/**
 * Banner surface classes per palette family. Written out in full because Tailwind
 * only emits classes it can see as literals — `tw:bg-utility-${color}-50` would
 * compile to nothing. `Badge` keeps its own table for the pill itself; this one is
 * the banner behind it, where background, border and title colour are needed apart.
 */
export const ANNOUNCEMENT_SURFACE_CLASSES: Record<
  BadgeColors,
  { surface: string; icon: string; title: string; border: string }
> = {
  gray: {
    surface: 'tw:bg-utility-gray-50 tw:outline-utility-gray-200',
    icon: 'tw:text-utility-gray-500',
    title: 'tw:text-utility-gray-700',
    border: 'tw:border-utility-gray-200',
  },
  brand: {
    surface: 'tw:bg-utility-brand-50 tw:outline-utility-brand-200',
    icon: 'tw:text-utility-brand-500',
    title: 'tw:text-utility-brand-700',
    border: 'tw:border-utility-brand-200',
  },
  error: {
    surface: 'tw:bg-utility-error-50 tw:outline-utility-error-200',
    icon: 'tw:text-utility-error-500',
    title: 'tw:text-utility-error-700',
    border: 'tw:border-utility-error-200',
  },
  warning: {
    surface: 'tw:bg-utility-warning-50 tw:outline-utility-warning-200',
    icon: 'tw:text-utility-warning-500',
    title: 'tw:text-utility-warning-700',
    border: 'tw:border-utility-warning-200',
  },
  success: {
    surface: 'tw:bg-utility-success-50 tw:outline-utility-success-200',
    icon: 'tw:text-utility-success-500',
    title: 'tw:text-utility-success-700',
    border: 'tw:border-utility-success-200',
  },
  'gray-blue': {
    surface: 'tw:bg-utility-gray-blue-50 tw:outline-utility-gray-blue-200',
    icon: 'tw:text-utility-gray-blue-500',
    title: 'tw:text-utility-gray-blue-700',
    border: 'tw:border-utility-gray-blue-200',
  },
  'blue-light': {
    surface: 'tw:bg-utility-blue-light-50 tw:outline-utility-blue-light-200',
    icon: 'tw:text-utility-blue-light-500',
    title: 'tw:text-utility-blue-light-700',
    border: 'tw:border-utility-blue-light-200',
  },
  blue: {
    surface: 'tw:bg-utility-blue-50 tw:outline-utility-blue-200',
    icon: 'tw:text-utility-blue-500',
    title: 'tw:text-utility-blue-700',
    border: 'tw:border-utility-blue-200',
  },
  'blue-dark': {
    surface: 'tw:bg-utility-blue-dark-50 tw:outline-utility-blue-dark-200',
    icon: 'tw:text-utility-blue-dark-500',
    title: 'tw:text-utility-blue-dark-700',
    border: 'tw:border-utility-blue-dark-200',
  },
  indigo: {
    surface: 'tw:bg-utility-indigo-50 tw:outline-utility-indigo-200',
    icon: 'tw:text-utility-indigo-500',
    title: 'tw:text-utility-indigo-700',
    border: 'tw:border-utility-indigo-200',
  },
  purple: {
    surface: 'tw:bg-utility-purple-50 tw:outline-utility-purple-200',
    icon: 'tw:text-utility-purple-500',
    title: 'tw:text-utility-purple-700',
    border: 'tw:border-utility-purple-200',
  },
  pink: {
    surface: 'tw:bg-utility-pink-50 tw:outline-utility-pink-200',
    icon: 'tw:text-utility-pink-500',
    title: 'tw:text-utility-pink-700',
    border: 'tw:border-utility-pink-200',
  },
  orange: {
    surface: 'tw:bg-utility-orange-50 tw:outline-utility-orange-200',
    icon: 'tw:text-utility-orange-500',
    title: 'tw:text-utility-orange-700',
    border: 'tw:border-utility-orange-200',
  },
};

/**
 * The server stamps `status` on write, but it is a snapshot — an announcement that
 * was Active when stored is Expired once its window closes. Recomputing from the
 * window keeps the drawer's filters honest between writes.
 */
export const getAnnouncementStatus = (
  announcement: Pick<AnnouncementEntity, 'startTime' | 'endTime'>
): AnnouncementStatus => {
  if (isScheduledAnnouncement(announcement.startTime)) {
    return AnnouncementStatus.Scheduled;
  }

  return isActiveAnnouncement(announcement.startTime, announcement.endTime)
    ? AnnouncementStatus.Active
    : AnnouncementStatus.Expired;
};

/** Text colour for the status label on an announcement card. */
export const ANNOUNCEMENT_STATUS_CLASSES: Record<AnnouncementStatus, string> = {
  [AnnouncementStatus.Active]: 'tw:text-utility-success-700',
  [AnnouncementStatus.Scheduled]: 'tw:text-utility-blue-700',
  [AnnouncementStatus.Expired]: 'tw:text-utility-gray-700',
};

export const ANNOUNCEMENT_STATUS_LABEL_KEYS: Record<
  AnnouncementStatus,
  string
> = {
  [AnnouncementStatus.Active]: 'label.active',
  [AnnouncementStatus.Scheduled]: 'label.scheduled',
  [AnnouncementStatus.Expired]: 'label.in-active',
};
