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
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';

interface AlertDisabledBadgeProps {
  enabled?: boolean;
}

/** Says an alert is disabled, as a tag's page does; nothing for an enabled alert. */
const AlertDisabledBadge = ({ enabled }: AlertDisabledBadgeProps) => {
  const { t } = useTranslation();

  return enabled === false ? (
    <StatusBadge
      className="tw:shrink-0"
      dataTestId="alert-disabled-badge"
      label={t('label.disabled')}
      status={StatusType.Stopped}
    />
  ) : null;
};

export default AlertDisabledBadge;
