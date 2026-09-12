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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import {
    AuditLogs as AuditLogsIcon,
    PermissionDebugger as PermissionDebuggerIcon,
    Policy as PolicyIcon,
    Role as RoleIcon
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccessControlView } from './AccessControlPanel';

interface LandingCard {
  id: string;
  icon: FC<{ className?: string }>;
  titleKey: string;
  descriptionKey: string;
  view: AccessControlView;
}

const LANDING_CARDS: LandingCard[] = [
  {
    id: 'roles',
    icon: RoleIcon,
    titleKey: 'label.role-plural',
    descriptionKey: 'message.page-sub-header-for-roles',
    view: { type: 'roles' },
  },
  {
    id: 'policies',
    icon: PolicyIcon,
    titleKey: 'label.policy-plural',
    descriptionKey: 'message.page-sub-header-for-policies',
    view: { type: 'policies' },
  },
  {
    id: 'permission-debugger',
    icon: PermissionDebuggerIcon,
    titleKey: 'label.permission-debugger',
    descriptionKey: 'message.page-sub-header-for-permission-debugger',
    view: { type: 'permission-debugger' },
  },
  {
    id: 'audit-logs',
    icon: AuditLogsIcon,
    titleKey: 'label.audit-log-plural',
    descriptionKey: 'message.page-sub-header-for-audit-logs',
    view: { type: 'audit-logs' },
  },
];

interface AccessControlLandingProps {
  onNavigate: (view: AccessControlView) => void;
}

const AccessControlLanding: FC<AccessControlLandingProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:pt-2"
      data-testid="access-control-landing">
      {LANDING_CARDS.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            isClickable
            key={card.id}
            size="md"
            onClick={() => onNavigate(card.view)}>
            <Card.Content>
              <Box
                align="start"
                direction="row" gap={4}
                data-testid={`access-control-card-${card.id}`}
                direction="row">
                <Box className="tw:shrink-0 tw:rounded-lg tw:bg-secondary tw:h-10 tw:w-10" align="center" justify="center">
                  <Icon className="tw:size-6 tw:text-secondary" />
                </Box>
                <Box className="tw:min-w-0" direction="col" gap={1}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {t(card.titleKey)}
                  </Typography>
                  <Typography
                    className="tw:text-tertiary tw:line-clamp-2"
                    size="text-sm"
                    weight="regular">
                    {t(card.descriptionKey)}
                  </Typography>
                </Box>
              </Box>
            </Card.Content>
          </Card>
        );
      })}
    </Box>
  );
};

export default AccessControlLanding;
