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
  Checkbox,
  RadioButton,
  RadioGroup,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityTypeCustomProperties } from '../../../../hooks/useEntityTypeCustomProperties';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../Loader/Loader';
import { CUSTOM_PROPERTIES_WIDGET_DEFAULT_LIMIT } from './CustomPropertiesWidget.constants';
import {
  CustomPropertiesDisplayMode,
  CustomPropertiesWidgetSettings,
} from './CustomPropertiesWidget.types';
import {
  applyPropertyLayout,
  getWidgetDefaultWidth,
  selectWidgetProperties,
  toPropertyLayout,
} from './CustomPropertiesWidget.utils';
import { CustomPropertyLayoutEditor } from './CustomPropertyLayoutEditor';

interface CustomPropertiesWidgetSettingsFormProps {
  entityType?: string;
  value: CustomPropertiesWidgetSettings;
  onChange: (value: CustomPropertiesWidgetSettings) => void;
}

export const CustomPropertiesWidgetSettingsForm = ({
  entityType,
  value,
  onChange,
}: CustomPropertiesWidgetSettingsFormProps) => {
  const { t } = useTranslation();
  const { customProperties, isLoading } =
    useEntityTypeCustomProperties(entityType);

  const layoutItems = useMemo(
    () =>
      applyPropertyLayout(
        selectWidgetProperties(customProperties, value),
        value.propertyLayout,
        getWidgetDefaultWidth
      ),
    [customProperties, value]
  );

  const toggleProperty = (name: string, isSelected: boolean) =>
    onChange({
      ...value,
      // Appending keeps the order in which properties were picked, which is
      // the order the widget shows them in.
      propertyNames: isSelected
        ? [...value.propertyNames, name]
        : value.propertyNames.filter((selected) => selected !== name),
    });

  return (
    <Box
      data-testid="custom-properties-widget-settings"
      direction="col"
      gap={5}>
      <Box direction="col" gap={3}>
        <Typography className="tw:font-medium tw:text-secondary" size="text-sm">
          {t('label.properties-to-show')}
        </Typography>
        <RadioGroup
          aria-label={t('label.properties-to-show')}
          className="tw:gap-3"
          value={value.displayMode}
          onChange={(displayMode) =>
            onChange({
              ...value,
              displayMode: displayMode as CustomPropertiesDisplayMode,
            })
          }>
          <RadioButton
            data-testid="display-mode-default"
            label={t('label.first-count-property-plural', {
              count: CUSTOM_PROPERTIES_WIDGET_DEFAULT_LIMIT,
            })}
            value="default"
          />
          <RadioButton
            data-testid="display-mode-all"
            label={t('label.all-entity', {
              entity: t('label.property-plural'),
            })}
            value="all"
          />
          <RadioButton
            data-testid="display-mode-selected"
            label={t('label.selected-property-plural')}
            value="selected"
          />
        </RadioGroup>
        {value.displayMode === 'selected' && (
          <Box
            className="tw:max-h-60 tw:overflow-y-auto tw:rounded-lg tw:border tw:border-secondary tw:p-3"
            data-testid="custom-property-checkbox-list"
            direction="col"
            gap={2}>
            {isLoading && <Loader size="small" />}
            {!isLoading && customProperties.length === 0 && (
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('message.no-custom-properties-defined')}
              </Typography>
            )}
            {customProperties.map((property) => (
              <Checkbox
                data-testid={`custom-property-checkbox-${property.name}`}
                isSelected={value.propertyNames.includes(property.name)}
                key={property.name}
                label={getEntityName(property)}
                onChange={(isSelected) =>
                  toggleProperty(property.name, isSelected)
                }
              />
            ))}
          </Box>
        )}
      </Box>
      {layoutItems.length > 0 && (
        <Box direction="col" gap={2}>
          <Typography
            className="tw:font-medium tw:text-secondary"
            size="text-sm">
            {t('label.layout')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-xs">
            {t('message.custom-property-layout-hint')}
          </Typography>
          <CustomPropertyLayoutEditor
            items={layoutItems}
            onChange={(items) =>
              onChange({ ...value, propertyLayout: toPropertyLayout(items) })
            }
          />
        </Box>
      )}
      <Toggle
        data-testid="custom-properties-widget-show-header"
        hint={t('message.custom-properties-widget-header-hint')}
        isSelected={value.showHeader}
        label={t('label.show-widget-header')}
        onChange={(showHeader) => onChange({ ...value, showHeader })}
      />
    </Box>
  );
};
