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
import { DotsVertical } from '@untitledui/icons';
import { FC } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { AgentActionPermissions, AgentStatus } from '../AgentsPage.interface';
import { NO_AGENT_PERMISSIONS } from '../utils/agents.utils';

interface AgentOverflowMenuProps {
  allowedActions?: string[];
  permissions?: AgentActionPermissions;
  status: AgentStatus;
  enabled?: boolean;
  onAction: (action: string) => void;
}

interface MenuItem {
  danger?: boolean;
  id: string;
  label: string;
  testId: string;
}

const AgentOverflowMenu: FC<AgentOverflowMenuProps> = ({
  allowedActions,
  enabled,
  onAction,
  permissions = NO_AGENT_PERMISSIONS,
  status,
}) => {
  const { t } = useTranslation();
  const isActive = status === 'running' || status === 'queued';

  // `enabled` defaults to true in the IngestionPipeline schema, so an absent
  // flag means the agent is running and only an explicit false means paused.
  const pauseResumeOption: MenuItem =
    enabled === false
      ? { id: 'resume', label: t('label.resume'), testId: 'resume-button' }
      : { id: 'pause', label: t('label.pause'), testId: 'pause-button' };

  const allItems: MenuItem[] = [
    pauseResumeOption,
    ...(isActive
      ? [{ id: 'kill', label: t('label.kill-run'), testId: 'kill-button' }]
      : [
          {
            id: 'redeploy',
            label: t('label.re-deploy-sentence'),
            testId: 're-deploy-button',
          },
        ]),
    {
      id: 'edit',
      label: t('label.edit-configuration'),
      testId: 'edit-button',
    },
    {
      danger: true,
      id: 'delete',
      label: t('label.delete-agent'),
      testId: 'delete-button',
    },
  ];

  const PERMISSION_BY_ITEM: Record<string, boolean> = {
    run: permissions.trigger,
    redeploy: permissions.edit,
    edit: permissions.edit,
    kill: permissions.edit,
    pause: permissions.edit,
    resume: permissions.edit,
    delete: permissions.delete,
  };

  const items = allItems.filter(
    (item) =>
      (allowedActions?.includes(item.id) ?? true) && PERMISSION_BY_ITEM[item.id]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <Dropdown.Root>
      <AriaButton
        aria-label={t('label.more-action-plural')}
        className={
          'tw:grid tw:size-8.5 tw:cursor-pointer tw:place-items-center' +
          ' tw:rounded-lg tw:border tw:border-secondary' +
          ' tw:bg-primary tw:text-fg-tertiary tw:shadow-xs tw:outline-none'
        }
        data-testid="more-actions">
        <DotsVertical size={18} />
      </AriaButton>
      <Dropdown.Popover data-testid="actions-dropdown">
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <Dropdown.Item
              data-testid={item.testId}
              id={item.id}
              key={item.id}
              textValue={item.label}>
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
