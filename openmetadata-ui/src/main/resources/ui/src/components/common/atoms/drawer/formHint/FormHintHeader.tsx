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
import { Lightbulb05 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

/** Title row of the Form Hint column. */
export const FormHintHeader = () => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:gap-2" direction="row">
      <Lightbulb05 aria-hidden className="tw:size-4 tw:text-secondary" />
      <Typography
        className="tw:whitespace-nowrap tw:text-secondary"
        size="text-sm"
        weight="medium">
        {t('label.form-hint')}
      </Typography>
    </Box>
  );
};
