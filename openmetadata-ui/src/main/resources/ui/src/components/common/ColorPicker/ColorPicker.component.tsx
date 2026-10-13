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
  value?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
}

const ColorPicker = ({
  id,
  value = '',
  onBlur,
  onChange,
}: ColorPickerProps) => {
  const { t } = useTranslation();
  const testId = id ? `${id}-color` : 'color';

  return (
    <Box align="center" gap={2}>
      <Box className="tw:w-16 tw:shrink-0">
        <Input
          aria-label={t('label.color')}
          inputDataTestId={`${testId}-picker`}
          type="color"
          value={value}
          onBlur={onBlur}
          onChange={onChange}
        />
      </Box>
      <Box className="tw:flex-1">
        <Input
          aria-label={t('label.color')}
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
