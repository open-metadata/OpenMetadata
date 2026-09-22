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

import { ProgressBarBase } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { AgentStatus } from '../../AgentsPage.interface';

interface ProgressBarProps {
  pct: number;
  status: AgentStatus;
}

const FILL_CLASS: Record<string, string> = {
  failed: 'tw:bg-utility-error-500',
  success: 'tw:bg-utility-success-500',
};

const ProgressBar: FC<ProgressBarProps> = ({ pct, status }) => (
  <ProgressBarBase
    className="tw:h-1.5 tw:rounded-full tw:bg-tertiary"
    progressClassName={`tw:rounded-full tw:duration-700 ${
      FILL_CLASS[status] ?? 'tw:bg-brand-solid'
    }`}
    value={Math.max(2, Math.min(100, pct))}
  />
);

export default ProgressBar;
