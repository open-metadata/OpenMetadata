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

import { Dropdown } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Button as AriaButton } from 'react-aria-components';
import { AgentStatus } from '../AgentsPage.interface';
import { IcMore } from '../AgentIcons';

interface AgentOverflowMenuProps {
  status: AgentStatus;
  onAction: (action: string) => void;
}

interface MenuItem {
  danger?: boolean;
  id: string;
  label: string;
}

const AgentOverflowMenu: FC<AgentOverflowMenuProps> = ({
  onAction,
  status,
}) => {
  const { t } = useTranslation();
  const isActive = status === 'running' || status === 'queued';

  const items: MenuItem[] = isActive
    ? [
        { id: 'pause', label: t('label.pause') },
        { id: 'kill', label: t('label.kill-run') },
        { id: 'edit', label: t('label.edit-configuration') },
        { danger: true, id: 'delete', label: t('label.delete-agent') },
      ]
    : [
        { id: 'run', label: t('label.run-now') },
        { id: 'redeploy', label: t('label.re-deploy') },
        { id: 'edit', label: t('label.edit-configuration') },
        { danger: true, id: 'delete', label: t('label.delete-agent') },
      ];

  return (
    <Dropdown.Root>
      <AriaButton
        aria-label={t('label.more-action-plural')}
        className={
          'tw:grid tw:h-[34px] tw:w-[34px] tw:cursor-pointer tw:place-items-center' +
          ' tw:rounded-lg tw:border tw:border-[color:var(--border-default)]' +
          ' tw:bg-white tw:text-[color:var(--fg-tertiary)] tw:shadow-xs tw:outline-none'
        }>
        <IcMore />
      </AriaButton>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <Dropdown.Item
              id={item.id}
              key={item.id}
              textValue={item.label}>
              <span
                style={
                  item.danger ? { color: 'var(--error-600)' } : undefined
                }>
                {item.label}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default AgentOverflowMenu;
