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
import { Button } from '@openmetadata/ui-core-components';
import {
  AuditLogs as AuditLogsIcon,
  PermissionDebugger as AccessControlIcon,
  Policy as PoliciesIcon,
  Role as RolesIcon,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import type { Key } from 'react';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { checkPermission } from '../../../../../../utils/PermissionsUtils';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { AccessControlView } from './AccessControl.types';
import { hashSubPathToView, viewToSubPath } from './AccessControl.utils';
import AccessControlAddPolicyForm from './AccessControlAddPolicyForm';
import AccessControlAddRoleForm from './AccessControlAddRoleForm';
import AccessControlAuditLogsPanel from './AccessControlAuditLogsPanel';
import AccessControlDebuggerPanel from './AccessControlDebuggerPanel';
import AccessControlLanding from './AccessControlLanding';
import AccessControlPoliciesPanel from './AccessControlPoliciesPanel';
import AccessControlPolicyDetail from './AccessControlPolicyDetail';
import AccessControlRoleDetail from './AccessControlRoleDetail';
import AccessControlRolesPanel from './AccessControlRolesPanel';

export type { AccessControlView };

const HASH_TAB = 'access-control';
const ROLES_DETAIL = 'roles-detail' as const;
const POLICIES_DETAIL = 'policies-detail' as const;
const POLICIES_ADD = 'policies-add' as const;

interface AccessControlPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const AccessControlPanel: FC<AccessControlPanelProps> = ({
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { state: hashState, setHash } = useSettingsHash();

  const view = useMemo<AccessControlView>(
    () => hashSubPathToView(hashState.subPath),
    [hashState.subPath]
  );

  const onNavigate = useCallback(
    (nextView: AccessControlView) => {
      setHash(HASH_TAB, viewToSubPath(nextView));
    },
    [setHash]
  );

  const isAuditLogsView = view.type === 'audit-logs';

  // Extra actions injected by sub-panels (e.g. audit-logs export button).
  const [panelHeaderActions, setPanelHeaderActions] =
    useState<React.ReactNode>(undefined);

  // Actions and title input injected by detail panels (role/policy detail rename+delete).
  const [detailHeaderActions, setDetailHeaderActions] =
    useState<React.ReactNode>(undefined);
  const [detailHeaderTitleInput, setDetailHeaderTitleInput] =
    useState<React.ReactNode>(undefined);
  const [detailHeaderTitleSuffix, setDetailHeaderTitleSuffix] =
    useState<React.ReactNode>(undefined);
  const [resolvedDetailName, setResolvedDetailName] = useState('');

  const viewFqn =
    view.type === ROLES_DETAIL || view.type === POLICIES_DETAIL
      ? view.fqn
      : undefined;

  // Clear detail header state when navigating away.
  // panelHeaderActions is cleared by AccessControlAuditLogsPanel's own effect cleanup on unmount.
  useEffect(() => {
    setDetailHeaderActions(undefined);
    setDetailHeaderTitleInput(undefined);
    setDetailHeaderTitleSuffix(undefined);
    setResolvedDetailName('');
  }, [view.type, viewFqn]);

  const canAddRole = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.ROLE, permissions),
    [permissions]
  );

  const canAddPolicy = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.POLICY, permissions),
    [permissions]
  );

  const permissionsLoaded = !isEmpty(permissions);

  useEffect(() => {
    if (view.type === 'roles-add' && permissionsLoaded && !canAddRole) {
      onNavigate({ type: 'roles' });
    }
  }, [view.type, permissionsLoaded, canAddRole, onNavigate]);

  useEffect(() => {
    if (view.type === POLICIES_ADD && permissionsLoaded && !canAddPolicy) {
      onNavigate({ type: 'policies' });
    }
  }, [view.type, permissionsLoaded, canAddPolicy, onNavigate]);

  // Push header updates up to ProfilePage whenever the internal view changes.
  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const settingsLabel = t('label.setting-plural');
    const acLabel = t('label.access-control');
    const rolesLabel = t('label.role-plural');
    const policiesLabel = t('label.policy-plural');
    const debuggerLabel = t('label.permission-debugger');
    const auditLogsLabel = t('label.audit-log-plural');
    const addRole = t('label.add-entity', { entity: t('label.role') });
    const addPolicy = t('label.add-entity', { entity: t('label.policy') });

    let roleName = '';
    let policyName = '';
    let isDetailView = false;

    if (view.type === ROLES_DETAIL) {
      roleName = resolvedDetailName || view.name;
      isDetailView = true;
    } else if (view.type === POLICIES_DETAIL) {
      policyName = resolvedDetailName || view.name;
      isDetailView = true;
    }

    const settingsItem: BreadcrumbItemType = {
      id: 'settings',
      label: settingsLabel,
    };
    const acItem: BreadcrumbItemType = { id: HASH_TAB, label: acLabel };
    const rolesItem: BreadcrumbItemType = { id: 'roles', label: rolesLabel };
    const policiesItem: BreadcrumbItemType = {
      id: 'policies',
      label: policiesLabel,
    };
    const base = [settingsItem, acItem];

    const crumbsByType: Record<
      AccessControlView['type'],
      BreadcrumbItemType[]
    > = {
      landing: [settingsItem, { id: 'current', label: acLabel }],
      roles: [...base, { id: 'current', label: rolesLabel }],
      'roles-add': [...base, rolesItem, { id: 'current', label: addRole }],
      [ROLES_DETAIL]: [...base, rolesItem, { id: 'current', label: roleName }],
      policies: [...base, { id: 'current', label: policiesLabel }],
      [POLICIES_ADD]: [
        ...base,
        policiesItem,
        { id: 'current', label: addPolicy },
      ],
      [POLICIES_DETAIL]: [
        ...base,
        policiesItem,
        { id: 'current', label: policyName },
      ],
      'permission-debugger': [...base, { id: 'current', label: debuggerLabel }],
      'audit-logs': [...base, { id: 'current', label: auditLogsLabel }],
    };

    const iconByType: Record<
      AccessControlView['type'],
      FC<{ className?: string }>
    > = {
      landing: AccessControlIcon,
      roles: RolesIcon,
      'roles-add': RolesIcon,
      [ROLES_DETAIL]: RolesIcon,
      policies: PoliciesIcon,
      [POLICIES_ADD]: PoliciesIcon,
      [POLICIES_DETAIL]: PoliciesIcon,
      'permission-debugger': AccessControlIcon,
      'audit-logs': AuditLogsIcon,
    };

    const titleByType: Record<AccessControlView['type'], string> = {
      landing: acLabel,
      roles: rolesLabel,
      'roles-add': addRole,
      [ROLES_DETAIL]: roleName,
      policies: policiesLabel,
      [POLICIES_ADD]: addPolicy,
      [POLICIES_DETAIL]: policyName,
      'permission-debugger': debuggerLabel,
      'audit-logs': auditLogsLabel,
    };

    const descByType: Record<AccessControlView['type'], string> = {
      landing: t('message.access-control-description'),
      roles: t('message.page-sub-header-for-roles'),
      'roles-add': t('message.page-sub-header-for-roles'),
      [ROLES_DETAIL]: t('message.page-sub-header-for-roles'),
      policies: t('message.page-sub-header-for-policies'),
      [POLICIES_ADD]: t('message.page-sub-header-for-policies'),
      [POLICIES_DETAIL]: t('message.page-sub-header-for-policies'),
      'permission-debugger': t(
        'message.page-sub-header-for-permission-debugger'
      ),
      'audit-logs': t('message.page-sub-header-for-audit-logs'),
    };

    const onBreadcrumbAction = (id: Key) => {
      if (id === HASH_TAB) {
        onNavigate({ type: 'landing' });
      } else if (id === 'roles') {
        onNavigate({ type: 'roles' });
      } else if (id === 'policies') {
        onNavigate({ type: 'policies' });
      }
    };

    const actionsForView: React.ReactNode = (() => {
      if (view.type === 'roles' && canAddRole) {
        return (
          <Button
            color="primary"
            data-testid="add-role"
            size="sm"
            onPress={() => onNavigate({ type: 'roles-add' })}>
            {addRole}
          </Button>
        );
      }

      if (view.type === 'policies' && canAddPolicy) {
        return (
          <Button
            color="primary"
            data-testid="add-policy"
            size="sm"
            onPress={() => onNavigate({ type: POLICIES_ADD })}>
            {addPolicy}
          </Button>
        );
      }

      // For audit-logs the export button is injected by the panel via panelHeaderActions.
      if (isAuditLogsView) {
        return panelHeaderActions;
      }

      // For detail views, rename/delete buttons are injected by the detail panel.
      if (isDetailView) {
        return detailHeaderActions;
      }

      return undefined;
    })();

    const titleInputForView = isDetailView ? detailHeaderTitleInput : undefined;
    const titleSuffixForView = isDetailView
      ? detailHeaderTitleSuffix
      : undefined;

    onHeaderChange({
      breadcrumbs: crumbsByType[view.type],
      title: titleByType[view.type],
      description: descByType[view.type],
      icon: iconByType[view.type],
      onBreadcrumbAction,
      actions: actionsForView,
      titleInput: titleInputForView,
      titleSuffix: titleSuffixForView,
    });
  }, [
    view,
    onHeaderChange,
    t,
    canAddRole,
    canAddPolicy,
    isAuditLogsView,
    onNavigate,
    panelHeaderActions,
    detailHeaderActions,
    detailHeaderTitleInput,
    detailHeaderTitleSuffix,
    resolvedDetailName,
  ]);

  // Audit logs manages its own height/scroll and injects its own header actions.
  if (isAuditLogsView) {
    return (
      <AccessControlAuditLogsPanel onSetHeaderActions={setPanelHeaderActions} />
    );
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

    if (view.type === ROLES_DETAIL) {
      return (
        <AccessControlRoleDetail
          fqn={view.fqn}
          onNavigate={onNavigate}
          onRename={setResolvedDetailName}
          onSetHeaderActions={setDetailHeaderActions}
          onSetHeaderTitleInput={setDetailHeaderTitleInput}
          onSetHeaderTitleSuffix={setDetailHeaderTitleSuffix}
        />
      );
    }

    if (view.type === 'policies') {
      return <AccessControlPoliciesPanel onNavigate={onNavigate} />;
    }

    if (view.type === POLICIES_ADD) {
      return <AccessControlAddPolicyForm onNavigate={onNavigate} />;
    }

    if (view.type === POLICIES_DETAIL) {
      return (
        <AccessControlPolicyDetail
          fqn={view.fqn}
          onNavigate={onNavigate}
          onRename={setResolvedDetailName}
          onSetHeaderActions={setDetailHeaderActions}
          onSetHeaderTitleInput={setDetailHeaderTitleInput}
          onSetHeaderTitleSuffix={setDetailHeaderTitleSuffix}
        />
      );
    }

    if (view.type === 'permission-debugger') {
      return <AccessControlDebuggerPanel />;
    }

    return null;
  })();

  return <div className="tw:flex-1 tw:overflow-y-auto">{content}</div>;
};

export default AccessControlPanel;
