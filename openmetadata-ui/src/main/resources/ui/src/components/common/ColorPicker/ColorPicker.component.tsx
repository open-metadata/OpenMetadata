/*
 *  Copyright 2023 Collate.
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
import { Box, Input } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

export interface ColorPickerProps {
  id?: string;
  /** Names both controls, so each theme colour is distinguishable. */
  label: string;
  value?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
}

const ColorPicker = ({
  id,
  label,
  value = '',
  onBlur,
  onChange,
}: ColorPickerProps) => {
  const { t } = useTranslation();
  const testId = id ? `${id}-color` : 'color';

  return (
    <Box align="center" gap={2}>
      {/* Core has no colour swatch control; a core Input squeezes the native
          swatch into a thin stripe, so the swatch stays a native colour input. */}
      <input
        aria-label={t('label.select-field', { field: label })}
        className="tw:h-10 tw:w-16 tw:shrink-0 tw:cursor-pointer tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:p-1"
        data-testid={`${testId}-picker`}
        type="color"
        value={value}
        onBlur={onBlur}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <Box className="tw:flex-1">
        <Input
          aria-label={label}
          id={id}
          inputDataTestId={`${testId}-input`}
          placeholder={t('message.hex-code-placeholder')}
          value={value}
          onBlur={onBlur}
          onChange={onChange}
        />
      </Box>
    </Box>
  );
};

export default ColorPicker;
