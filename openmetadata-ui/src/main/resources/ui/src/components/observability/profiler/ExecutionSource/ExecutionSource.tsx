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
import { useTranslation } from 'react-i18next';
import { TableExecutionSource } from '../../../../generated/type/tableExecutionSource';
import { CopyToClipboardButton } from '../../../common/CopyToClipboardButton/CopyToClipboardButton';

interface ExecutionSourceProps {
  source?: TableExecutionSource;
  isSharded?: boolean;
  testId?: string;
  copyable?: boolean;
}

export const ExecutionSource = ({
  source,
  isSharded = false,
  testId,
  copyable = true,
}: ExecutionSourceProps) => {
  const { t } = useTranslation();
  const physicalName = source
    ? `${source.databaseName}.${source.schemaName}.${source.tableName}`
    : undefined;

  if (!source && !isSharded) {
    return null;
  }

  return (
    <Box data-testid={testId} direction="col" gap={1}>
      <Typography color="secondary" size="text-xs" weight="medium">
        {t('label.execution-source')}
      </Typography>
      <Box align="center" gap={2}>
        <Typography className="tw:break-all" size="text-xs">
          {physicalName ?? t('message.execution-source-unavailable')}
        </Typography>
        {physicalName && copyable && (
          <CopyToClipboardButton copyText={physicalName} />
        )}
      </Box>
    </Box>
  );
};
