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
import { KeyboardEvent, useCallback, useRef } from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DIMENSION_COLOR_OPTIONS } from '../../constants/DataQualityDimension.constants';

const COLOR_GROUP_LABEL_ID = 'dimension-color-group-label';

/** Arrow keys move the selection inside a radio group; Home/End jump to its ends. */
const KEY_OFFSETS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

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

  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectColor = useCallback(
    (swatch: string) => setValue('color', swatch, { shouldDirty: true }),
    [setValue]
  );

  // One tab stop for the whole group: the selected swatch, or the first one when the current
  // colour is not in the palette.
  const isRovingTabStop = (swatch: string, index: number) =>
    color === swatch ||
    (index === 0 &&
      !DIMENSION_COLOR_OPTIONS.some((option) => option.color === color));

  const handleSwatchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const offset = KEY_OFFSETS[event.key];
      let nextIndex: number | undefined;

      if (offset !== undefined) {
        nextIndex =
          (index + offset + DIMENSION_COLOR_OPTIONS.length) %
          DIMENSION_COLOR_OPTIONS.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = DIMENSION_COLOR_OPTIONS.length - 1;
      }

      if (nextIndex === undefined) {
        return;
      }

      event.preventDefault();
      selectColor(DIMENSION_COLOR_OPTIONS[nextIndex].color);
      swatchRefs.current[nextIndex]?.focus();
    },
    [selectColor]
  );

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
                // Distinct from the hint: reusing it would leave the text unchanged when the
                // field flips to invalid, so nothing but the styling would move.
                message: t('message.dimension-name-invalid'),
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

          {/* A single-choice palette, so it is a radio group: one tab stop, arrow keys move
              between swatches, and the group takes its accessible name from the text above it
              rather than from a <label> with no control attached to it. */}
          <Box direction="col" gap={2}>
            <Typography
              as="span"
              id={COLOR_GROUP_LABEL_ID}
              size="text-sm"
              weight="medium">
              {t('label.color')}
            </Typography>
            <Box
              aria-labelledby={COLOR_GROUP_LABEL_ID}
              gap={2}
              role="radiogroup"
              wrap="wrap">
              {DIMENSION_COLOR_OPTIONS.map(
                ({ color: swatch, labelKey }, index) => (
                  <button
                    aria-checked={color === swatch}
                    aria-label={t(labelKey)}
                    className={`dimension-color-swatch${
                      color === swatch ? ' selected' : ''
                    }`}
                    data-testid={`color-${swatch}`}
                    key={swatch}
                    ref={(element) => {
                      swatchRefs.current[index] = element;
                    }}
                    role="radio"
                    style={{ backgroundColor: swatch }}
                    tabIndex={isRovingTabStop(swatch, index) ? 0 : -1}
                    type="button"
                    onClick={() => selectColor(swatch)}
                    onKeyDown={(event) => handleSwatchKeyDown(event, index)}
                  />
                )
              )}
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
