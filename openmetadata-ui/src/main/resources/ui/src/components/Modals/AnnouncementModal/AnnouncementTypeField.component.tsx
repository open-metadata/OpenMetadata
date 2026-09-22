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

import { Badge, Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../generated/entity/feed/announcement';
import {
  ANNOUNCEMENT_COLORS,
  ANNOUNCEMENT_SURFACE_CLASSES,
  ANNOUNCEMENT_TYPE_CONFIG,
} from '../../../utils/AnnouncementsUtils';

const ANNOUNCEMENT_TYPES = Object.values(AnnouncementType);
const ANNOUNCEMENT_COLOR_VALUES = Object.values(AnnouncementColor);

/**
 * Both fields are controlled by antd's `Form.Item`, which injects `value`/`onChange`
 * — hence the optional props rather than required ones.
 */
interface AnnouncementTypeSelectProps {
  value?: AnnouncementType;
  onChange?: (value: AnnouncementType) => void;
}

interface AnnouncementColorSelectProps {
  value?: AnnouncementColor;
  onChange?: (value: AnnouncementColor) => void;
}

export const AnnouncementTypeSelect = ({
  value,
  onChange,
}: AnnouncementTypeSelectProps) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:flex-wrap tw:gap-2"
      data-testid="announcement-type-select">
      {ANNOUNCEMENT_TYPES.map((type) => {
        const {
          color,
          icon: TypeIcon,
          labelKey,
        } = ANNOUNCEMENT_TYPE_CONFIG[type];
        const isSelected = value === type;

        return (
          <button
            aria-pressed={isSelected}
            className="tw:cursor-pointer tw:border-none tw:bg-transparent tw:p-0"
            data-testid={`announcement-type-${type}`}
            key={type}
            type="button"
            onClick={() => onChange?.(type)}>
            <Badge
              className={classNames(
                'tw:inline-flex tw:items-center tw:gap-1',
                isSelected && 'tw:outline-2'
              )}
              color={isSelected ? color : 'gray'}
              size="md">
              <TypeIcon className="tw:size-3.5" />
              {t(labelKey)}
            </Badge>
          </button>
        );
      })}
    </Box>
  );
};

export const AnnouncementColorSelect = ({
  value,
  onChange,
}: AnnouncementColorSelectProps) => (
  <Box
    className="tw:flex-wrap tw:gap-2"
    data-testid="announcement-color-select">
    {ANNOUNCEMENT_COLOR_VALUES.map((color) => (
      <button
        aria-label={color}
        aria-pressed={value === color}
        className={classNames(
          'tw:size-6 tw:cursor-pointer tw:rounded-full tw:border-none tw:p-0.5',
          value === color
            ? 'tw:outline-2 tw:-outline-offset-1 tw:outline-brand'
            : 'tw:outline-none',
          ANNOUNCEMENT_SURFACE_CLASSES[ANNOUNCEMENT_COLORS[color]].icon
        )}
        data-testid={`announcement-color-${color}`}
        key={color}
        type="button"
        onClick={() => onChange?.(color)}>
        <span className="tw:block tw:size-full tw:rounded-full tw:bg-current" />
      </button>
    ))}
  </Box>
);
