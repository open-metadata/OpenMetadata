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
import { Typography } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityTypeCustomProperties } from '../../../../hooks/useEntityTypeCustomProperties';
import { asyncNoop } from '../../../../utils/CustomizePage/CustomizePageWidgetUtils';
import Loader from '../../Loader/Loader';
import { CustomPropertiesRightPanel } from './CustomPropertiesRightPanel';
import {
  getCustomPropertiesWidgetSettings,
  selectWidgetProperties,
} from './CustomPropertiesWidget.utils';

const EMPTY_EXTENSION = {};

interface CustomPropertiesWidgetPreviewProps {
  entityType?: string;
  config?: Record<string, unknown>;
}

/**
 * Persona-editor preview of the Custom Properties widget: the real layout
 * and settings, with the entity type's properties and no values.
 */
export const CustomPropertiesWidgetPreview = ({
  entityType,
  config,
}: CustomPropertiesWidgetPreviewProps) => {
  const { t } = useTranslation();
  const { customProperties, isLoading } =
    useEntityTypeCustomProperties(entityType);
  const settings = useMemo(
    () => getCustomPropertiesWidgetSettings(config),
    [config]
  );
  const properties = useMemo(
    () => selectWidgetProperties(customProperties, settings),
    [customProperties, settings]
  );

  if (isLoading) {
    return <Loader size="small" />;
  }

  if (properties.length === 0) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('message.no-custom-properties-defined')}
      </Typography>
    );
  }

  return (
    <CustomPropertiesRightPanel
      extension={EMPTY_EXTENSION}
      hasEditPermissions={false}
      properties={properties}
      widgetSettings={settings}
      onExtensionUpdate={asyncNoop}
      onValueSave={asyncNoop}
    />
  );
};
