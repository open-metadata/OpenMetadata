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
  BadgeWithDot,
  BadgeWithIcon,
  Box,
} from '@openmetadata/ui-core-components';
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
  ANNOUNCEMENT_TYPE_ORDER,
  CUSTOM_ANNOUNCEMENT_COLORS,
} from '../../../utils/AnnouncementsUtils';

interface AnnouncementTypeSelectProps {
  value?: AnnouncementType;
  onChange: (value: AnnouncementType) => void;
}

interface AnnouncementColorSelectProps {
  value?: AnnouncementColor;
  onChange: (value: AnnouncementColor) => void;
}

// The chips stay neutral whatever the type: the choice is shown by fill, not by
// colour, so a Critical chip does not shout while the form is still a draft.
const CHIP_CLASS = 'tw:cursor-pointer';
const SELECTED_CHIP_CLASS = 'tw:bg-tertiary tw:text-primary';

export const AnnouncementTypeSelect = ({
  value,
  onChange,
}: AnnouncementTypeSelectProps) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:flex-wrap tw:gap-2"
      data-testid="announcement-type-select">
      {ANNOUNCEMENT_TYPE_ORDER.map((type) => {
        const { icon, labelKey } = ANNOUNCEMENT_TYPE_CONFIG[type];
        const isSelected = value === type;
        const className = classNames(
          CHIP_CLASS,
          isSelected && SELECTED_CHIP_CLASS
        );

        return (
          <button
            aria-pressed={isSelected}
            className="tw:cursor-pointer tw:rounded-md tw:border-none tw:bg-transparent tw:p-0"
            data-testid={`announcement-type-${type}`}
            key={type}
            type="button"
            onClick={() => onChange(type)}>
            {/* Custom has no fixed icon of its own to preview — its colour is
                still to be picked — so it takes a dot, as the frame draws it. */}
            {type === AnnouncementType.Custom ? (
              <BadgeWithDot
                className={className}
                color="gray"
                size="sm"
                type="modern">
                {t(labelKey)}
              </BadgeWithDot>
            ) : (
              <BadgeWithIcon
                className={className}
                color="gray"
                iconLeading={icon}
                size="sm"
                type="modern">
                {t(labelKey)}
              </BadgeWithIcon>
            )}
          </button>
        );
      })}
    </Box>
  );
};

/**
 * An announcement stored with a colour the form no longer offers keeps it on
 * edit: the swatch is appended rather than silently dropped from the selection.
 */
const getColorOptions = (value?: AnnouncementColor): AnnouncementColor[] =>
  !value || CUSTOM_ANNOUNCEMENT_COLORS.includes(value)
    ? CUSTOM_ANNOUNCEMENT_COLORS
    : [...CUSTOM_ANNOUNCEMENT_COLORS, value];

export const AnnouncementColorSelect = ({
  value,
  onChange,
}: AnnouncementColorSelectProps) => (
  <Box
    align="center"
    className="tw:min-h-10 tw:flex-wrap tw:gap-2"
    data-testid="announcement-color-select">
    {getColorOptions(value).map((color) => (
      <button
        aria-label={color}
        aria-pressed={value === color}
        className={classNames(
          'tw:size-6 tw:cursor-pointer tw:rounded-full tw:border-none tw:p-0.5',
          // The ring marks the selection, and keyboard focus when unselected —
          // a bare `outline-none` here left focus with no visible indicator.
          value === color
            ? 'tw:outline-2 tw:-outline-offset-1 tw:outline-brand'
            : 'tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-1 tw:focus-visible:outline-brand',
          ANNOUNCEMENT_SURFACE_CLASSES[ANNOUNCEMENT_COLORS[color]].icon
        )}
        data-testid={`announcement-color-${color}`}
        key={color}
        type="button"
        onClick={() => onChange(color)}>
        <span className="tw:block tw:size-full tw:rounded-full tw:bg-current" />
      </button>
    ))}
  </Box>
);
