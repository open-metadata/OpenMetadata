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
import { BadgeWithDot } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface AlertStatusBadgeProps {
  enabled?: boolean;
}

/** Whether an alert is running: Active, or Disabled when it is switched off. */
const AlertStatusBadge = ({ enabled }: AlertStatusBadgeProps) => {
  const { t } = useTranslation();
  const isDisabled = enabled === false;

  return (
    <span className="tw:shrink-0" data-testid="alert-status-badge">
      <BadgeWithDot
        color={isDisabled ? 'gray' : 'success'}
        size="sm"
        type="color">
        {isDisabled ? t('label.disabled') : t('label.active')}
      </BadgeWithDot>
    </span>
  );
};

export default AlertStatusBadge;
