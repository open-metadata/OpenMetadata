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
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MoreVerticalIcon } from '../../../assets/svg/agents/more-vertical.svg';
import { AgentStatus } from '../AgentsPage.interface';

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
        { id: 'redeploy', label: t('label.re-deploy-sentence') },
        { id: 'edit', label: t('label.edit-configuration') },
        { danger: true, id: 'delete', label: t('label.delete-agent') },
      ];

  return (
    <Dropdown.Root>
      <AriaButton
        aria-label={t('label.more-action-plural')}
        className={
          'tw:grid tw:size-8.5 tw:cursor-pointer tw:place-items-center' +
          ' tw:rounded-lg tw:border tw:border-secondary' +
          ' tw:bg-primary tw:text-fg-tertiary tw:shadow-xs tw:outline-none'
        }>
        <MoreVerticalIcon height={18} width={18} />
      </AriaButton>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <Dropdown.Item id={item.id} key={item.id} textValue={item.label}>
              <span className={item.danger ? 'tw:text-error-primary' : ''}>
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
