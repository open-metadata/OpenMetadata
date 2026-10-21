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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import type { UseAlertCapabilitiesReturn } from '../../../../../../hooks/useAlertCapabilities';
import AlertSourcePicker from '../../../../../Alerts/AlertSourcePicker/AlertSourcePicker';

interface NotificationSourceSelectProps {
  capabilities: UseAlertCapabilitiesReturn;
  value: string[];
}

/** Every source a saved alert watches, read-only, as the alert's configuration shows it. */
function NotificationSourceSelect({
  capabilities,
  value,
}: Readonly<NotificationSourceSelectProps>) {
  const { t } = useTranslation();

  return (
    <Card className="tw:w-full" size="md" variant="muted">
      <Card.Content>
        <Box direction="col" gap={3}>
          <Box direction="col" gap={1}>
            <Typography size="text-sm" weight="medium">
              {t('label.source')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('message.alerts-source-description')}
            </Typography>
          </Box>
          <AlertSourcePicker
            isDisabled
            capabilities={capabilities}
            value={value}
          />
        </Box>
      </Card.Content>
    </Card>
  );
}

export default NotificationSourceSelect;
