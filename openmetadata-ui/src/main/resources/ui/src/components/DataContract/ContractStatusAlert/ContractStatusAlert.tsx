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
  Alert,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContractStatusAlertProps } from './ContractStatusAlert.types';

// A contract result carries no server-side size limit, so a long validation
// failure would otherwise push the whole contract below the fold. Past this
// length the message collapses to two lines behind a toggle.
const COLLAPSE_THRESHOLD = 400;

const ContractStatusAlert = ({ message }: ContractStatusAlertProps) => {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  if (isDismissed || !message) {
    return null;
  }

  const isCollapsible = message.length > COLLAPSE_THRESHOLD;

  return (
    <Alert
      closable
      data-testid="contract-status-alert"
      variant="error"
      onClose={() => setIsDismissed(true)}>
      <Box align="start" direction="col" gap={1}>
        <Typography
          data-testid="contract-status-alert-message"
          ellipsis={isCollapsible && !isExpanded ? { rows: 2 } : undefined}>
          {message}
        </Typography>
        {isCollapsible && (
          <Button
            color="link-color"
            data-testid="contract-status-alert-toggle"
            size="sm"
            onPress={() => setIsExpanded((expanded) => !expanded)}>
            {isExpanded ? t('label.show-less') : t('label.show-more')}
          </Button>
        )}
      </Box>
    </Alert>
  );
};

export default ContractStatusAlert;
