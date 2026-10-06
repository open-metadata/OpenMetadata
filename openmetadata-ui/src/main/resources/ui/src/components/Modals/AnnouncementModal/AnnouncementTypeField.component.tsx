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
  RadioButton,
  RadioGroup,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../generated/entity/feed/announcement';
import {
  ANNOUNCEMENT_COLORS,
  ANNOUNCEMENT_COLOR_LABEL_KEYS,
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
// the type's own colour, so a Critical chip does not shout while the form is
// still a draft.
const CHIP_CLASS = 'tw:cursor-pointer';

/**
 * One of five mutually exclusive types, so a radio group rather than a row of
 * `aria-pressed` buttons: the group is one tab stop with arrow keys between the
 * options, and a screen reader reads "3 of 5" instead of five separate toggles.
 * The radio circle itself is hidden — the chip is the control's whole visual.
 */
export const AnnouncementTypeSelect = ({
  value,
  onChange,
}: AnnouncementTypeSelectProps) => {
  const { t } = useTranslation();

  return (
    <RadioGroup
      aria-label={t('label.announcement-type')}
      className="tw:flex-row tw:flex-wrap tw:gap-2"
      data-testid="announcement-type-select"
      value={value ?? null}
      onChange={(next) => onChange(next as AnnouncementType)}>
      {ANNOUNCEMENT_TYPE_ORDER.map((type) => {
        const { icon, labelKey } = ANNOUNCEMENT_TYPE_CONFIG[type];
        // Selection is the badge's own `color`, not a class laid over a
        // `modern` chip: `color` and `modern` share the same `rounded-md`
        // shape, so a brand fill against the resting grey reads as selected
        // without changing the chip's size or outline weight. The previous
        // `bg-tertiary` overlay was a grey on a white surface — a difference
        // too small to see which of the five was chosen.
        const chipColor = value === type ? 'brand' : 'gray';

        return (
          <RadioButton
            className={({ isFocusVisible }) =>
              classNames(
                // Core draws the focus ring on `RadioButtonBase`, the circular
                // indicator — which this chip hides. Without moving the ring
                // onto the chip, arrowing through the group gives no visible
                // focus at all; the selection fill is the only cue.
                'tw:rounded-md',
                isFocusVisible &&
                  'tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring'
              )
            }
            data-testid={`announcement-type-${type}`}
            indicatorClassName="tw:hidden"
            key={type}
            label={
              /* Custom has no fixed icon of its own to preview — its colour is
                 still to be picked — so it takes a dot, as the frame draws it. */
              type === AnnouncementType.Custom ? (
                <BadgeWithDot
                  className={CHIP_CLASS}
                  color={chipColor}
                  size="sm"
                  type="color">
                  {t(labelKey)}
                </BadgeWithDot>
              ) : (
                <BadgeWithIcon
                  className={CHIP_CLASS}
                  color={chipColor}
                  iconLeading={icon}
                  size="sm"
                  type="color">
                  {t(labelKey)}
                </BadgeWithIcon>
              )
            }
            value={type}
          />
        );
      })}
    </RadioGroup>
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

/**
 * Also a radio group, but here the radio indicator *is* the swatch: the family's
 * `500` step fills it through `bg-current`, and the selected state's white centre
 * dot and brand edge come from `RadioButtonBase` rather than being drawn again.
 */
export const AnnouncementColorSelect = ({
  value,
  onChange,
}: AnnouncementColorSelectProps) => {
  const { t } = useTranslation();

  return (
    <RadioGroup
      aria-label={t('label.color')}
      className="tw:min-h-10 tw:flex-row tw:flex-wrap tw:items-center tw:gap-2"
      data-testid="announcement-color-select"
      value={value ?? null}
      onChange={(next) => onChange(next as AnnouncementColor)}>
      {getColorOptions(value).map((color) => (
        <RadioButton
          aria-label={t(ANNOUNCEMENT_COLOR_LABEL_KEYS[color])}
          className="tw:cursor-pointer"
          data-testid={`announcement-color-${color}`}
          indicatorClassName={classNames(
            'tw:size-6 tw:min-h-6 tw:min-w-6 tw:bg-current',
            ANNOUNCEMENT_SURFACE_CLASSES[ANNOUNCEMENT_COLORS[color]].icon
          )}
          key={color}
          value={color}
        />
      ))}
    </RadioGroup>
  );
};
