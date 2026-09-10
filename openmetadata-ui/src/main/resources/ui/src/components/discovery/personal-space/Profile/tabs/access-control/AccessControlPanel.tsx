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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import React, { FC, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionDebugger as AccessControlIcon, Policy as PoliciesIcon, Role as RolesIcon } from '@openmetadata/ui-core-components/icons';
import { ReactComponent as ManagementIcon } from '../../../../../../assets/svg/setting-management.svg';
import { ProfileHeaderOverride } from '../../profileNavConfig';
import AccessControlAddPolicyForm from './AccessControlAddPolicyForm';
import AccessControlAddRoleForm from './AccessControlAddRoleForm';
import AccessControlAuditLogsPanel from './AccessControlAuditLogsPanel';
import AccessControlDebuggerPanel from './AccessControlDebuggerPanel';
import AccessControlLanding from './AccessControlLanding';
import AccessControlPoliciesPanel from './AccessControlPoliciesPanel';
import AccessControlPolicyDetail from './AccessControlPolicyDetail';
import AccessControlRoleDetail from './AccessControlRoleDetail';
import AccessControlRolesPanel from './AccessControlRolesPanel';

export type AccessControlView =
  | { type: 'landing' }
  | { type: 'roles' }
  | { type: 'roles-add' }
  | { type: 'roles-detail'; fqn: string; name: string }
  | { type: 'policies' }
  | { type: 'policies-add' }
  | { type: 'policies-detail'; fqn: string; name: string }
  | { type: 'permission-debugger' }
  | { type: 'audit-logs' };

interface AccessControlPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const AccessControlPanel: FC<AccessControlPanelProps> = ({ onHeaderChange }) => {
  const { t } = useTranslation();
  const [view, setView] = React.useState<AccessControlView>({
    type: 'landing',
  });

  const onNavigate = useCallback((nextView: AccessControlView) => {
    setView(nextView);
  }, []);

  // Push header updates up to ProfilePage whenever the internal view changes.
  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    // Precompute labels to avoid duplicate string rule violations.
    const settingsLabel = t('label.setting-plural');
    const acLabel = t('label.access-control');
    const rolesLabel = t('label.role-plural');
    const policiesLabel = t('label.policy-plural');
    const debuggerLabel = t('label.permission-debugger');
    const auditLogsLabel = t('label.audit-log-plural');
    const addRole = t('label.add-entity', { entity: t('label.role') });
    const addPolicy = t('label.add-entity', { entity: t('label.policy') });

    const roleName = view.type === 'roles-detail' ? view.name : '';
    const policyName = view.type === 'policies-detail' ? view.name : '';

    const settingsItem: BreadcrumbItemType = {
      id: 'settings',
      label: settingsLabel,
    };
    const acItem: BreadcrumbItemType = { id: 'access-control', label: acLabel };
    const rolesItem: BreadcrumbItemType = { id: 'roles', label: rolesLabel };
    const policiesItem: BreadcrumbItemType = {
      id: 'policies',
      label: policiesLabel,
    };
    const base = [settingsItem, acItem];

    const crumbsByType: Record<string, BreadcrumbItemType[]> = {
      landing: [settingsItem, { id: 'current', label: acLabel }],
      roles: [...base, { id: 'current', label: rolesLabel }],
      'roles-add': [...base, rolesItem, { id: 'current', label: addRole }],
      'roles-detail': [
        ...base,
        rolesItem,
        { id: 'current', label: roleName },
      ],
      policies: [...base, { id: 'current', label: policiesLabel }],
      'policies-add': [
        ...base,
        policiesItem,
        { id: 'current', label: addPolicy },
      ],
      'policies-detail': [
        ...base,
        policiesItem,
        { id: 'current', label: policyName },
      ],
      'permission-debugger': [
        ...base,
        { id: 'current', label: debuggerLabel },
      ],
      'audit-logs': [...base, { id: 'current', label: auditLogsLabel }],
    };

    const iconByType: Record<string, FC<{ className?: string }>> = {
      landing: AccessControlIcon,
      roles: RolesIcon,
      'roles-add': RolesIcon,
      'roles-detail': RolesIcon,
      policies: PoliciesIcon,
      'policies-add': PoliciesIcon,
      'policies-detail': PoliciesIcon,
      'permission-debugger': AccessControlIcon,
      'audit-logs': ManagementIcon,
    };

    const titleByType: Record<string, string> = {
      landing: acLabel,
      roles: rolesLabel,
      'roles-add': addRole,
      'roles-detail': roleName,
      policies: policiesLabel,
      'policies-add': addPolicy,
      'policies-detail': policyName,
      'permission-debugger': debuggerLabel,
      'audit-logs': auditLogsLabel,
    };

    const descByType: Record<string, string> = {
      landing: t('message.access-control-description'),
      roles: t('message.page-sub-header-for-roles'),
      'roles-add': t('message.page-sub-header-for-roles'),
      'roles-detail': t('message.page-sub-header-for-roles'),
      policies: t('message.page-sub-header-for-policies'),
      'policies-add': t('message.page-sub-header-for-policies'),
      'policies-detail': t('message.page-sub-header-for-policies'),
      'permission-debugger': t(
        'message.page-sub-header-for-permission-debugger'
      ),
      'audit-logs': t('message.page-sub-header-for-audit-logs'),
    };

    const onBreadcrumbAction = (id: string | number) => {
      if (id === 'access-control') {
        setView({ type: 'landing' });
      } else if (id === 'roles') {
        setView({ type: 'roles' });
      } else if (id === 'policies') {
        setView({ type: 'policies' });
      }
    };

    onHeaderChange({
      breadcrumbs: crumbsByType[view.type] ?? base,
      title: titleByType[view.type] ?? acLabel,
      description: descByType[view.type] ?? '',
      icon: iconByType[view.type] ?? AccessControlIcon,
      onBreadcrumbAction,
    });
  }, [view, onHeaderChange, t]);

  // Audit logs manages its own height/scroll — render unwrapped.
  if (view.type === 'audit-logs') {
    return <AccessControlAuditLogsPanel />;
  }

  // All other views use the page-level padded scroll container.
  const content = (() => {
    if (view.type === 'landing') {
      return <AccessControlLanding onNavigate={onNavigate} />;
    }

    if (view.type === 'roles') {
      return <AccessControlRolesPanel onNavigate={onNavigate} />;
    }

    if (view.type === 'roles-add') {
      return <AccessControlAddRoleForm onNavigate={onNavigate} />;
    }

    if (view.type === 'roles-detail') {
      return <AccessControlRoleDetail fqn={view.fqn} onNavigate={onNavigate} />;
    }

    if (view.type === 'policies') {
      return <AccessControlPoliciesPanel onNavigate={onNavigate} />;
    }

    if (view.type === 'policies-add') {
      return <AccessControlAddPolicyForm onNavigate={onNavigate} />;
    }

    if (view.type === 'policies-detail') {
      return (
        <AccessControlPolicyDetail fqn={view.fqn} onNavigate={onNavigate} />
      );
    }

    if (view.type === 'permission-debugger') {
      return <AccessControlDebuggerPanel />;
    }

    return null;
  })();

  return (
    <div className="tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0">
      {content}
    </div>
  );
};

export default AccessControlPanel;
