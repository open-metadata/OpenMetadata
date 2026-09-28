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
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CommonWidgetType,
  GridSizes,
} from '../../../../constants/CustomizeWidgets.constants';
import { WidgetWidths } from '../../../../enums/CustomizablePage.enum';
import { getWidgetWidthLabelFromKey } from '../../../../utils/CustomizableLandingPagePureUtils';
import { DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.constants';
import { CustomPropertiesWidgetSettings } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.types';
import { isCustomPropertiesWidgetSettingsValid } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.utils';
import { CustomPropertiesWidgetSettingsForm } from '../../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidgetSettingsForm';

interface AddCustomPropertiesWidgetTabContentProps {
  entityType?: string;
  maxGridSizeSupport: number;
  widget: CommonWidgetType;
  onAdd: (
    widget: CommonWidgetType,
    widgetSize: number,
    settings: CustomPropertiesWidgetSettings
  ) => void;
}

export const AddCustomPropertiesWidgetTabContent = ({
  entityType,
  maxGridSizeSupport,
  widget,
  onAdd,
}: AddCustomPropertiesWidgetTabContentProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(
    DEFAULT_CUSTOM_PROPERTIES_WIDGET_SETTINGS
  );
  const [gridSize, setGridSize] = useState<GridSizes>(widget.data.gridSizes[0]);
  const widgetSize = WidgetWidths[gridSize];
  const canAdd =
    isCustomPropertiesWidgetSettingsValid(settings) &&
    widgetSize <= maxGridSizeSupport;

  return (
    <Box data-testid="custom-properties-widget-content" direction="col" gap={5}>
      <Box direction="col" gap={2}>
        <Typography className="tw:font-medium tw:text-secondary" size="text-sm">
          {t('label.size')}
        </Typography>
        <ButtonGroup
          disallowEmptySelection
          aria-label={t('label.size')}
          data-testid="size-selector-button"
          selectedKeys={new Set([gridSize])}
          size="sm"
          onSelectionChange={(keys) => {
            const [key] = [...keys];
            if (key) {
              setGridSize(key as GridSizes);
            }
          }}>
          {widget.data.gridSizes.map((size) => (
            <ButtonGroupItem
              data-testid={`${size}-size-selector`}
              id={size}
              key={size}>
              {getWidgetWidthLabelFromKey(size)}
            </ButtonGroupItem>
          ))}
        </ButtonGroup>
      </Box>
      <CustomPropertiesWidgetSettingsForm
        entityType={entityType}
        value={settings}
        onChange={setSettings}
      />
      <Box justify="end">
        <Button
          data-testid="add-widget-button"
          iconLeading={Plus}
          isDisabled={!canAdd}
          size="sm"
          onPress={() => onAdd(widget, widgetSize, settings)}>
          {t('label.add')}
        </Button>
      </Box>
    </Box>
  );
};
