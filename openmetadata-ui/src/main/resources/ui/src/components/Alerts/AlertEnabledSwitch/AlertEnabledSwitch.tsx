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
import { Alert, Box, Toggle } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface AlertEnabledSwitchProps {
  isEnabled: boolean;
  /** False for a user who cannot edit the alert. */
  canEdit: boolean;
  onChange: (isEnabled: boolean) => void;
}

/**
 * Switches an alert on or off from its form. While it is off, the notice says the alert sends
 * nothing and that what happens meanwhile is not sent later; the live region announces it.
 */
const AlertEnabledSwitch = ({
  isEnabled,
  canEdit,
  onChange,
}: AlertEnabledSwitchProps) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={3}>
      <Toggle
        data-testid="alert-enabled-switch"
        isDisabled={!canEdit}
        isSelected={isEnabled}
        label={t('label.enabled')}
        onChange={onChange}
      />
      <div aria-live="polite" role="status">
        {!isEnabled && (
          <Alert
            data-testid="alert-disabled-notice"
            title={t('message.alert-disabled-form-notice')}
            variant="warning"
          />
        )}
      </div>
    </Box>
  );
};

export default AlertEnabledSwitch;
