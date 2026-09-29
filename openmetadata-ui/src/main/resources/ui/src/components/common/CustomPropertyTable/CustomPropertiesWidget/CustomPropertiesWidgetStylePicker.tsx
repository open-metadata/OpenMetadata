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
  Box,
  RadioButtonBase,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { Radio } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  CUSTOM_PROPERTIES_WIDGET_STYLES,
  CUSTOM_PROPERTIES_WIDGET_STYLE_LABEL,
} from './CustomPropertiesWidget.constants';
import { CustomPropertiesWidgetStyle } from './CustomPropertiesWidget.types';

const STYLE_TEXT_KEYS: Record<
  CustomPropertiesWidgetStyle,
  { description: string; hint: string }
> = {
  preview: {
    description: 'message.custom-properties-preview-style-description',
    hint: 'message.custom-properties-preview-style-hint',
  },
  fullWidth: {
    description: 'message.custom-properties-full-width-style-description',
    hint: 'message.custom-properties-full-width-style-hint',
  },
};

const SKELETON_BAR = 'tw:h-2.5 tw:rounded-sm tw:bg-quaternary';

/** Thumbnail of the tab with the widget in place: side list or full section. */
const StyleIllustration = ({
  style,
  isSelected,
}: {
  style: CustomPropertiesWidgetStyle;
  isSelected: boolean;
}) => {
  const widgetClass = classNames(
    'tw:rounded-md tw:border tw:bg-primary',
    isSelected ? 'tw:border-brand' : 'tw:border-secondary'
  );

  return (
    <div
      aria-hidden
      className={classNames(
        'tw:flex tw:h-22 tw:gap-2 tw:rounded-lg tw:p-3',
        isSelected ? 'tw:bg-brand-primary' : 'tw:bg-secondary'
      )}>
      {style === 'preview' ? (
        <>
          <div className="tw:flex-1 tw:rounded-md tw:border tw:border-secondary tw:bg-primary" />
          <div
            className={classNames(
              widgetClass,
              'tw:flex tw:w-11 tw:flex-col tw:gap-1.5 tw:p-1.5'
            )}>
            {[0, 1, 2, 3, 4].map((line) => (
              <span
                className="tw:h-1 tw:rounded-sm tw:bg-quaternary"
                key={line}
              />
            ))}
          </div>
        </>
      ) : (
        <div
          className={classNames(
            widgetClass,
            'tw:flex tw:flex-1 tw:flex-col tw:gap-1.5 tw:p-2'
          )}>
          <span
            className={classNames(
              'tw:h-1 tw:w-1/3 tw:rounded-sm',
              isSelected ? 'tw:bg-brand-solid' : 'tw:bg-quaternary'
            )}
          />
          <div className="tw:flex tw:gap-1.5">
            <span className={classNames(SKELETON_BAR, 'tw:flex-1')} />
            <span className={classNames(SKELETON_BAR, 'tw:flex-1')} />
          </div>
          <span className={SKELETON_BAR} />
        </div>
      )}
    </div>
  );
};

interface CustomPropertiesWidgetStylePickerProps {
  value?: CustomPropertiesWidgetStyle;
  onChange: (style: CustomPropertiesWidgetStyle) => void;
}

export const CustomPropertiesWidgetStylePicker = ({
  value,
  onChange,
}: CustomPropertiesWidgetStylePickerProps) => {
  const { t } = useTranslation();

  return (
    <RadioGroup
      aria-label={t('label.widget-style')}
      className="tw:grid tw:grid-cols-2 tw:gap-3"
      value={value ?? null}
      onChange={(style) => onChange(style as CustomPropertiesWidgetStyle)}>
      {CUSTOM_PROPERTIES_WIDGET_STYLES.map((style) => {
        const keys = STYLE_TEXT_KEYS[style];

        return (
          <Box direction="col" gap={2} key={style}>
            <Radio
              className={({ isSelected, isFocusVisible }) =>
                classNames(
                  'tw:flex tw:flex-1 tw:cursor-pointer tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:bg-primary tw:p-3 tw:outline-focus-ring',
                  isSelected
                    ? 'tw:border-brand'
                    : 'tw:border-secondary tw:hover:border-primary',
                  isFocusVisible && 'tw:outline-2 tw:outline-offset-2'
                )
              }
              data-testid={`widget-style-${style}`}
              value={style}>
              {({ isSelected }) => (
                <>
                  <StyleIllustration isSelected={isSelected} style={style} />
                  <Box align="start" gap={3}>
                    <RadioButtonBase
                      className="tw:mt-0.5"
                      isSelected={isSelected}
                      size="sm"
                    />
                    <Box direction="col" gap={1}>
                      <Typography
                        className="tw:font-semibold tw:text-primary"
                        size="text-sm">
                        {t(CUSTOM_PROPERTIES_WIDGET_STYLE_LABEL[style])}
                      </Typography>
                      <Typography className="tw:text-tertiary" size="text-sm">
                        {t(keys.description)}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}
            </Radio>
            <Box align="center" className="tw:px-1" gap={2}>
              <InfoCircle className="tw:size-3.5 tw:shrink-0 tw:text-fg-quaternary" />
              <Typography className="tw:text-tertiary" size="text-xs">
                {t(keys.hint)}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </RadioGroup>
  );
};
