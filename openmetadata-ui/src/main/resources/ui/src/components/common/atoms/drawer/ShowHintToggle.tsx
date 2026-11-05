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
import { Box, Toggle, Typography } from '@openmetadata/ui-core-components';
import { Lightbulb05 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

interface ShowHintToggleProps {
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}

/**
 * The Show Hint control for a form header that has a Form Hint column. It never
 * shrinks and its label never wraps, so it keeps its size when the header
 * narrows.
 */
export const ShowHintToggle = ({
  isSelected,
  onChange,
}: Readonly<ShowHintToggleProps>) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:shrink-0" gap={2}>
      <Lightbulb05 aria-hidden className="tw:text-secondary" size={16} />
      <Typography
        className="tw:whitespace-nowrap tw:text-secondary"
        size="text-sm"
        weight="medium">
        {t('label.show-hint')}
      </Typography>
      <Toggle
        aria-label={t('label.show-hint')}
        data-testid="show-hint-toggle"
        isSelected={isSelected}
        size="sm"
        onChange={onChange}
      />
    </Box>
  );
};
