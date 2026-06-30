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

const StatusPill: FC<StatusPillProps> = ({ status }) => {
  const { t } = useTranslation();
  const meta = STATUS_PILL_META[status];

  return (
    <span
      className="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:px-2.5 tw:py-0.5 tw:text-[11.5px] tw:font-semibold"
      style={{ background: meta.bg, borderColor: meta.bd, color: meta.fg }}>
      <span
        className={`tw:h-1.5 tw:w-1.5 tw:rounded-full${
          meta.pulse ? ' tw:animate-pulse' : ''
        }`}
        style={{ background: meta.dot }}
      />
      {t(STATUS_LABEL_KEY[status])}
    </span>
  );
};

export default StatusPill;
