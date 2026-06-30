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
import { AgentStatus } from '../../AgentsPage.interface';

interface ProgressBarProps {
  pct: number;
  status: AgentStatus;
}

const ProgressBar: FC<ProgressBarProps> = ({ pct, status }) => {
  const color =
    status === 'failed'
      ? 'var(--error-500)'
      : status === 'success'
      ? 'var(--success-500)'
      : 'var(--blue-600)';

  return (
    <div className="tw:h-1.5 tw:overflow-hidden tw:rounded-full tw:bg-[color:var(--gray-100)]">
      <div
        className="tw:h-full tw:rounded-full tw:transition-[width] tw:duration-700"
        style={{
          background: color,
          width: `${Math.max(2, Math.min(100, pct))}%`,
        }}
      />
    </div>
  );
};

export default ProgressBar;
