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
import { Card, Toggle } from '@openmetadata/ui-core-components';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface AlertEnabledSwitchProps {
  isEnabled: boolean;
  /** False for a user who cannot edit the alert. */
  canEdit?: boolean;
  onChange: (isEnabled: boolean) => void;
}

/**
 * The settings row that switches an alert on or off from its form. The description says what
 * the current state means, and its live region announces the change.
 */
const AlertEnabledSwitch = ({
  isEnabled,
  canEdit = true,
  onChange,
}: AlertEnabledSwitchProps) => {
  const { t } = useTranslation();
  const descriptionId = useId();

  return (
    <Card data-testid="alert-enabled-row">
      <Card.Header
        extra={
          <Toggle
            aria-describedby={descriptionId}
            aria-label={t('label.enabled')}
            data-testid="alert-enabled-switch"
            isDisabled={!canEdit}
            isSelected={isEnabled}
            onChange={onChange}
          />
        }
        hasDivider={false}
        subtitle={
          <span
            aria-live="polite"
            data-testid="alert-enabled-description"
            id={descriptionId}>
            {isEnabled
              ? t('message.alert-enabled-description')
              : t('message.alert-disabled-description')}
          </span>
        }
        title={t('label.enabled')}
      />
    </Card>
  );
};

export default AlertEnabledSwitch;
