/*
 *  Copyright 2025 Collate.
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

import { Badge } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentStatus } from '../../AgentsPage.interface';
import { STATUS_PILL_META } from '../../utils/agents.utils';

interface StatusPillProps {
  status: AgentStatus;
}

const STATUS_LABEL_KEY: Record<AgentStatus, string> = {
  failed: 'label.failed',
  queued: 'label.queued',
  running: 'label.running',
  success: 'label.success',
};

const DOT_CLASS: Record<AgentStatus, string> = {
  failed: 'tw:bg-utility-error-500',
  queued: 'tw:bg-utility-gray-400',
  running: 'tw:bg-utility-brand-500',
  success: 'tw:bg-utility-success-500',
};

const StatusPill: FC<StatusPillProps> = ({ status }) => {
  const { t } = useTranslation();
  const meta = STATUS_PILL_META[status];

  return (
    <Badge
      className="tw:gap-1.5 tw:font-semibold"
      color={meta.color}
      size="sm"
      type="pill-color">
      <span
        className={`tw:size-1.5 tw:rounded-full ${DOT_CLASS[status]}${
          meta.pulse ? ' tw:animate-pulse' : ''
        }`}
      />
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  );
};

export default StatusPill;
