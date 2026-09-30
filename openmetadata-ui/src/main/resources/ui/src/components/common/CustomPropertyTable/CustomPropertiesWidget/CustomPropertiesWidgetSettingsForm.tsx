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
import { Box, Divider, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useEntityTypeCustomProperties } from '../../../../hooks/useEntityTypeCustomProperties';
import Loader from '../../Loader/Loader';
import { CustomPropertiesWidgetStyle } from './CustomPropertiesWidget.interface';
import { withWidgetStyle } from './CustomPropertiesWidget.utils';
import {
  CustomPropertiesWidgetSettingsFormProps,
  SettingsStepProps,
  StepState,
} from './CustomPropertiesWidgetSettingsForm.interface';
import { CustomPropertiesWidgetStylePicker } from './CustomPropertiesWidgetStylePicker';
import { CustomPropertyPicker } from './CustomPropertyPicker';

const STEP_BADGE_CLASS: Record<StepState, string> = {
  disabled: 'tw:bg-secondary tw:text-quaternary',
  active: 'tw:bg-brand-primary tw:text-brand-secondary',
  done: 'tw:bg-brand-solid tw:text-primary_on-brand',
};

const SettingsStep = ({
  step,
  state,
  title,
  description,
  children,
}: SettingsStepProps) => (
  <Box
    className={classNames({ 'tw:opacity-60': state === 'disabled' })}
    direction="col"
    gap={4}>
    <Box align="start" gap={3}>
      <span
        aria-hidden
        className={classNames(
          'tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-semibold',
          STEP_BADGE_CLASS[state]
        )}>
        {step}
      </span>
      <Box direction="col" gap={1}>
        {/* Plain heading: Typography's prose styles size h3 at 20px. */}
        <h3 className="tw:m-0 tw:text-sm tw:font-semibold tw:text-primary">
          {title}
        </h3>
        <Typography className="tw:text-tertiary" size="text-sm">
          {description}
        </Typography>
      </Box>
    </Box>
    <div className="tw:pl-9">{children}</div>
  </Box>
);

/** Two steps: how the widget sits on the tab, then which properties it shows. */
export const CustomPropertiesWidgetSettingsForm = ({
  entityType,
  style,
  value,
  onStyleChange,
  onChange,
}: CustomPropertiesWidgetSettingsFormProps) => {
  const { t } = useTranslation();
  const { customProperties, isLoading } =
    useEntityTypeCustomProperties(entityType);
  const hasStyle = Boolean(style);

  const handleStyleChange = (nextStyle: CustomPropertiesWidgetStyle) => {
    onStyleChange(nextStyle);
    onChange(withWidgetStyle(value, nextStyle));
  };

  const renderProperties = () => {
    if (isLoading) {
      return <Loader size="small" />;
    }

    if (customProperties.length === 0) {
      return (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.no-custom-properties-defined')}
        </Typography>
      );
    }

    return (
      <CustomPropertyPicker
        isDisabled={!hasStyle}
        properties={customProperties}
        value={value}
        onChange={onChange}
      />
    );
  };

  let propertiesHint = t('message.choose-widget-style-first');
  if (style === 'preview') {
    propertiesHint = t('message.custom-properties-pick-hint');
  } else if (style === 'fullWidth') {
    propertiesHint = t('message.custom-properties-pick-and-size-hint');
  }

  return (
    <Box
      data-testid="custom-properties-widget-settings"
      direction="col"
      gap={6}>
      <SettingsStep
        description={t('message.custom-properties-widget-style-description')}
        state={hasStyle ? 'done' : 'active'}
        step={1}
        title={t('label.widget-style')}>
        <CustomPropertiesWidgetStylePicker
          value={style}
          onChange={handleStyleChange}
        />
      </SettingsStep>
      <Divider />
      <SettingsStep
        description={propertiesHint}
        state={hasStyle ? 'active' : 'disabled'}
        step={2}
        title={t('label.property-plural')}>
        {renderProperties()}
      </SettingsStep>
    </Box>
  );
};
