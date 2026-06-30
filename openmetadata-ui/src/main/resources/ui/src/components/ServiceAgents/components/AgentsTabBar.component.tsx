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

import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentTab } from '../AgentsPage.interface';
import { IcCode, IcSparkle } from '../AgentIcons';

interface AgentsTabBarProps {
  counts: { ai: number; metadata: number };
  onChange: (tab: AgentTab) => void;
  tab: AgentTab;
}

const AgentsTabBar: FC<AgentsTabBarProps> = ({ counts, onChange, tab }) => {
  const { t } = useTranslation();
  const tabs: { count: number; icon: ReactNode; id: AgentTab; label: string }[] =
    [
      {
        count: counts.metadata,
        icon: <IcCode />,
        id: 'metadata',
        label: t('label.metadata'),
      },
      {
        count: counts.ai,
        icon: <IcSparkle />,
        id: 'ai',
        label: t('label.collate-ai'),
      },
    ];

  return (
    <div className="tw:mb-[18px] tw:flex tw:gap-1 tw:border-b tw:border-[color:var(--border-subtle)]">
      {tabs.map(({ count, icon, id, label }) => {
        const on = tab === id;

        return (
          <button
            className="tw:-mb-px tw:inline-flex tw:items-center tw:gap-2 tw:border-0 tw:border-b-2 tw:bg-transparent tw:cursor-pointer tw:px-3.5 tw:py-2.5 tw:text-sm"
            key={id}
            style={{
              borderBottomColor: on ? 'var(--blue-600)' : 'transparent',
              color: on ? 'var(--blue-700)' : 'var(--fg-tertiary)',
              fontWeight: on ? 600 : 500,
            }}
            type="button"
            onClick={() => onChange(id)}>
            {icon}
            {label}
            <span
              className="tw:rounded-full tw:px-[7px] tw:text-[11px] tw:font-semibold"
              style={{
                background: on ? 'var(--blue-50)' : 'var(--gray-100)',
                color: on ? 'var(--blue-700)' : 'var(--fg-muted)',
              }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default AgentsTabBar;
