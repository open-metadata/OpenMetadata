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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { CornerDownLeft } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

const DataAssetPickerFooter: FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:px-3 tw:py-2 tw:border-t tw:border-secondary tw:bg-secondary tw:shrink-0"
      gap={2}>
      <Box align="center" gap={1}>
        <Badge size="xs" type="color">
          <CornerDownLeft className="tw:text-tertiary" size={12} />
        </Badge>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('label.select-lowercase')}
        </Typography>
      </Box>
      <Typography className="tw:text-tertiary" size="text-xs">
        ·
      </Typography>
      <Box align="center" gap={1}>
        <Badge size="xs" type="color">
          {t('label.esc')}
        </Badge>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('label.close-lowercase')}
        </Typography>
      </Box>
    </Box>
  );
};

export default DataAssetPickerFooter;
