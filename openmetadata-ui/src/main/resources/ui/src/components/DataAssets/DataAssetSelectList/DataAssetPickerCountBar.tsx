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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DataAssetPickerCountBarProps } from './DataAssetPicker.interface';

const DataAssetPickerCountBar: FC<DataAssetPickerCountBarProps> = ({
  count,
  total,
}) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:px-3.5 tw:py-1.5 tw:bg-secondary tw:border-b tw:border-t tw:border-secondary tw:shrink-0">
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('label.showing-count-of-total-assets', { count, total })}
      </Typography>
    </Box>
  );
};

export default DataAssetPickerCountBar;
