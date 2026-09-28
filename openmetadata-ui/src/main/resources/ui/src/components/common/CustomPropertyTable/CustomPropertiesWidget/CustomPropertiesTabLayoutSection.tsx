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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityTypeCustomProperties } from '../../../../hooks/useEntityTypeCustomProperties';
import Loader from '../../Loader/Loader';
import { CustomPropertyLayoutItem } from './CustomPropertiesWidget.types';
import {
  applyPropertyLayout,
  getTabDefaultWidth,
  toPropertyLayout,
} from './CustomPropertiesWidget.utils';
import { CustomPropertyLayoutEditor } from './CustomPropertyLayoutEditor';

interface CustomPropertiesTabLayoutSectionProps {
  entityType?: string;
  propertyLayout: CustomPropertyLayoutItem[];
  onChange: (propertyLayout: CustomPropertyLayoutItem[]) => void;
}

/** Persona-editor body of the Custom Properties tab: arrange its cards. */
export const CustomPropertiesTabLayoutSection = ({
  entityType,
  propertyLayout,
  onChange,
}: CustomPropertiesTabLayoutSectionProps) => {
  const { t } = useTranslation();
  const { customProperties, isLoading } =
    useEntityTypeCustomProperties(entityType);
  const items = useMemo(
    () =>
      applyPropertyLayout(customProperties, propertyLayout, getTabDefaultWidth),
    [customProperties, propertyLayout]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Box
      className="tw:p-4"
      data-testid="custom-properties-tab-layout"
      direction="col"
      gap={3}>
      {items.length === 0 ? (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.no-custom-properties-defined')}
        </Typography>
      ) : (
        <>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.custom-property-layout-hint')}
          </Typography>
          <CustomPropertyLayoutEditor
            items={items}
            onChange={(next) => onChange(toPropertyLayout(next))}
          />
        </>
      )}
    </Box>
  );
};
