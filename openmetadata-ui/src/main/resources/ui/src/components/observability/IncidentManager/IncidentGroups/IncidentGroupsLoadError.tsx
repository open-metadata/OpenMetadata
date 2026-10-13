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
import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { AlertCircle } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { IncidentGroupsLoadErrorProps } from './IncidentGroups.types';

/** A read of the incident groups or of a group's incidents failed: says so in place, with a retry. */
const IncidentGroupsLoadError = ({
  onRetry,
  'data-testid': testId,
}: IncidentGroupsLoadErrorProps) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:relative tw:min-h-80 tw:w-full" data-testid={testId}>
      <EmptyPlaceholder
        actions={[
          {
            key: 'retry',
            color: 'secondary',
            label: t('label.retry'),
            onPress: onRetry,
          },
        ]}
        icon={<AlertCircle className="tw:text-fg-error-primary" />}
        title={t('server.entity-fetch-error', {
          entity: t('label.incident-plural'),
        })}
        variant="blank"
      />
    </Box>
  );
};

export default IncidentGroupsLoadError;
