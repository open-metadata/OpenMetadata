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
  Grid,
  Input,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DIMENSION_COLOR_PALETTE } from '../../constants/DataQualityDimension.constants';

export interface DimensionFormValues {
  name: string;
  displayName?: string;
  description?: string;
  color: string;
}

export interface DimensionFormProps {
  hookForm: UseFormReturn<DimensionFormValues>;
  isEditing: boolean;
}

const DimensionForm = ({ hookForm, isEditing }: DimensionFormProps) => {
  const { t } = useTranslation();
  const { control, setValue } = hookForm;

  // Watched rather than held in local state so the preview tracks every keystroke and every
  // swatch click from the one source of truth.
  const color = useWatch({ control, name: 'color' });
  const name = useWatch({ control, name: 'name' });
  const displayName = useWatch({ control, name: 'displayName' });
  const previewLabel = displayName || name || t('label.dimension');

  return (
    <Grid colGap="6">
      <Grid.Item span={15}>
        <Box direction="col" gap={5}>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                isRequired
                // The name is referenced by the API and by every test case relationship, so it
                // is read-only once the dimension exists.
                hint={
                  fieldState.error?.message ??
                  (isEditing
                    ? t('message.dimension-name-is-fixed-after-creation')
                    : t('message.dimension-name-help'))
                }
                inputDataTestId="dimension-name"
                isDisabled={isEditing}
                isInvalid={Boolean(fieldState.error)}
                label={t('label.name')}
              />
            )}
            rules={{
              required: t('label.field-required', { field: t('label.name') }),
              pattern: {
                value: /^[\w-]+$/,
                message: t('message.dimension-name-help'),
              },
            }}
          />

          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <Input
                {...field}
                hint={t('message.dimension-display-name-help')}
                inputDataTestId="dimension-display-name"
                label={t('label.display-name')}
                value={field.value ?? ''}
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <TextArea
                {...field}
                data-testid="dimension-description"
                label={t('label.description')}
                placeholder={t('message.dimension-description-placeholder')}
                rows={4}
                value={field.value ?? ''}
              />
            )}
          />

          <Box direction="col" gap={2}>
            <Typography as="label" size="text-sm" weight="medium">
              {t('label.color')}
            </Typography>
            <Box gap={2} wrap="wrap">
              {DIMENSION_COLOR_PALETTE.map((swatch) => (
                <button
                  aria-label={swatch}
                  aria-pressed={color === swatch}
                  className={`dimension-color-swatch${
                    color === swatch ? ' selected' : ''
                  }`}
                  data-testid={`color-${swatch}`}
                  key={swatch}
                  style={{ backgroundColor: swatch }}
                  type="button"
                  onClick={() =>
                    setValue('color', swatch, { shouldDirty: true })
                  }
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Grid.Item>

      <Grid.Item span={9}>
        <Box className="dimension-side-panel" direction="col" gap={3}>
          <Typography color="secondary" size="text-sm">
            {t('label.preview')}
          </Typography>
          <Box align="center" className="dimension-preview" gap={2}>
            <span
              className="dimension-color-dot"
              style={{ backgroundColor: color }}
            />
            <Typography size="text-sm" weight="semibold">
              {previewLabel}
            </Typography>
          </Box>
          <Typography color="secondary" size="text-sm">
            {t('message.data-quality-dimensions-description')}
          </Typography>
        </Box>
      </Grid.Item>
    </Grid>
  );
};

export default DimensionForm;
