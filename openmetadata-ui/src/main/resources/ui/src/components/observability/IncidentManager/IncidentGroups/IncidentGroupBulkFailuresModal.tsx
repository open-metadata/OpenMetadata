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
  Button,
  SimpleModal,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { IncidentGroupBulkFailuresModalProps } from './IncidentGroups.types';

/**
 * The incidents a bulk change could not be applied to, each with the reason
 * the server gave — so a partial success never reads as a full one.
 */
const IncidentGroupBulkFailuresModal = ({
  outcome,
  onClose,
}: IncidentGroupBulkFailuresModalProps) => {
  const { t } = useTranslation();

  return (
    <SimpleModal
      data-testid="incident-groups-bulk-failures-modal"
      footer={
        <Button
          color="secondary"
          data-testid="incident-groups-bulk-failures-close"
          onPress={onClose}>
          {t('label.close')}
        </Button>
      }
      isOpen={Boolean(outcome)}
      title={t('label.incident-plural-not-updated')}
      onCancel={onClose}>
      {outcome && (
        <Box direction="col" gap={3}>
          <Typography as="p" className="tw:text-tertiary" size="text-sm">
            {t('message.bulk-incident-partial-failure', {
              failed: outcome.failures.length,
              total: outcome.total,
            })}
          </Typography>
          <ul className="tw:flex tw:max-h-80 tw:flex-col tw:gap-2 tw:overflow-y-auto">
            {outcome.failures.map((failure) => (
              <li
                className="tw:flex tw:flex-col"
                data-testid="incident-groups-bulk-failure"
                // One open incident per test case, so its FQN names the entry;
                // a failure the server returned without its request has only
                // its message.
                key={failure.request?.testCaseReference ?? failure.message}>
                <Typography
                  as="span"
                  className="tw:text-primary"
                  size="text-sm"
                  weight="medium">
                  {failure.request?.testCaseReference}
                </Typography>
                <Typography
                  as="span"
                  className="tw:text-tertiary"
                  size="text-xs">
                  {failure.message}
                </Typography>
              </li>
            ))}
          </ul>
        </Box>
      )}
    </SimpleModal>
  );
};

export default IncidentGroupBulkFailuresModal;
