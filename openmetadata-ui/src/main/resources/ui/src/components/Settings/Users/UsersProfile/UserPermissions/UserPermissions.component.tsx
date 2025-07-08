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

import {
  Card,
  Col,
  Collapse,
  Divider,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../../enums/entity.enum';
import {
  DirectRolePermission,
  getMyPermissionDebugInfo,
  getPermissionDebugInfo,
  InheritedPermission,
  PermissionDebugInfo,
  PolicyInfo,
  RolePermission,
  RuleInfo,
  TeamPermission,
} from '../../../../../rest/permissionAPI';
import { getEntityName } from '../../../../../utils/EntityUtils';
import {
  getEntityDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getTeamsWithFqnPath,
} from '../../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import './UserPermissions.style.less';

const { Panel } = Collapse;
const { Title, Text } = Typography;

interface UserPermissionsProps {
  username: string;
  isLoggedInUser: boolean;
}

const UserPermissions: React.FC<UserPermissionsProps> = ({
  username,
  isLoggedInUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [permissionInfo, setPermissionInfo] = useState<PermissionDebugInfo>();

  const getEntityLink = (entityType: string, fqn: string) => {
    switch (entityType) {
      case EntityType.POLICY:
        return getPolicyWithFqnPath(fqn);
      case EntityType.ROLE:
        return getRoleWithFqnPath(fqn);
      case EntityType.TEAM:
        return getTeamsWithFqnPath(fqn);
      default:
        return getEntityDetailsPath(entityType as EntityType, fqn);
    }
  };

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const response = isLoggedInUser
        ? await getMyPermissionDebugInfo()
        : await getPermissionDebugInfo(username);
      setPermissionInfo(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [username, isLoggedInUser]);

  const renderRule = (rule: RuleInfo, index: number) => (
    <div className="rule-item m-b-sm" key={index}>
      <Space className="w-full" direction="vertical">
        <Space>
          <Text strong>{rule.name}</Text>
          <Tag color={rule.effect === 'ALLOW' ? 'success' : 'error'}>
            {rule.effect}
          </Tag>
        </Space>
        {!isEmpty(rule.operations) && (
          <div>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text type="secondary">{t('label.operation-plural')}: </Text>
            {rule.operations.map((op, idx) => (
              <Tag className="m-r-xs" key={idx}>
                {op}
              </Tag>
            ))}
          </div>
        )}
        {!isEmpty(rule.resources) && (
          <div>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text type="secondary">{t('label.resource-plural')}: </Text>
            {rule.resources.map((res, idx) => (
              <Tag className="m-r-xs" key={idx}>
                {res}
              </Tag>
            ))}
          </div>
        )}
        {rule.condition && (
          <div>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text type="secondary">{t('label.condition')}: </Text>
            <Text code>{rule.condition}</Text>
          </div>
        )}
      </Space>
    </div>
  );

  const renderPolicy = (policy: PolicyInfo, index: number) => (
    <Collapse ghost className="policy-collapse" key={index}>
      <Panel
        header={
          <Space>
            <Link
              to={getEntityLink(
                'policy',
                policy.policy.fullyQualifiedName || ''
              )}>
              {getEntityName(policy.policy)}
            </Link>
            <Tag
              color={
                policy.effect === 'ALLOW'
                  ? 'success'
                  : policy.effect === 'DENY'
                  ? 'error'
                  : 'warning'
              }>
              {policy.effect}
            </Tag>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text type="secondary">
              <span>{policy.rules.length}</span>
              {t('label.rule-lowercase-plural')}
            </Text>
          </Space>
        }
        key={index}>
        <div className="rules-container">
          {policy.rules.map((rule, ruleIndex) => renderRule(rule, ruleIndex))}
        </div>
      </Panel>
    </Collapse>
  );

  const renderDirectRoles = () => {
    if (isEmpty(permissionInfo?.directRoles)) {
      return null;
    }

    return (
      <Card className="m-b-md" title={t('label.direct-role-plural')}>
        {permissionInfo?.directRoles.map(
          (rolePermission: DirectRolePermission, index: number) => (
            <div className="m-b-md" key={index}>
              <Space className="m-b-sm">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <Text strong>{t('label.role')}: </Text>
                <Link
                  to={getEntityLink(
                    'role',
                    rolePermission.role.fullyQualifiedName || ''
                  )}>
                  {getEntityName(rolePermission.role)}
                </Link>
              </Space>
              {rolePermission.policies.map((policy, policyIndex) =>
                renderPolicy(policy, policyIndex)
              )}
            </div>
          )
        )}
      </Card>
    );
  };

  const renderRolePermission = (
    rolePermission: RolePermission,
    index: number
  ) => (
    <div className="m-b-md" key={index}>
      <Space className="w-full" direction="vertical">
        <Space>
          <Text strong>{t('label.role') + ': '}</Text>
          <Link
            to={getEntityLink(
              'role',
              rolePermission.role.fullyQualifiedName || ''
            )}>
            {getEntityName(rolePermission.role)}
          </Link>
          {rolePermission.isDefaultRole && (
            <Tag color="blue">{t('label.default-role')}</Tag>
          )}
        </Space>
        <Text type="secondary">
          {t('label.inherited-from')}:{' '}
          <span>{rolePermission.inheritedFrom}</span>
        </Text>
        {rolePermission.policies.map((policy, policyIndex) =>
          renderPolicy(policy, policyIndex)
        )}
      </Space>
    </div>
  );

  const renderTeamPermissions = () => {
    if (isEmpty(permissionInfo?.teamPermissions)) {
      return null;
    }

    return (
      <Card className="m-b-md" title={t('label.team-permission-plural')}>
        {permissionInfo?.teamPermissions.map(
          (teamPermission: TeamPermission, index: number) => (
            <div className="team-permission m-b-lg" key={index}>
              <Space className="w-full" direction="vertical">
                <Space>
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <Text strong>{t('label.team')}: </Text>
                  <Link
                    to={getEntityLink(
                      'team',
                      teamPermission.team.fullyQualifiedName || ''
                    )}>
                    {getEntityName(teamPermission.team)}
                  </Link>
                  <Tag>{teamPermission.teamType}</Tag>
                  {teamPermission.hierarchyLevel > 0 && (
                    <>
                      <Tag color="orange">
                        {t('label.level')}{' '}
                        <span>{teamPermission.hierarchyLevel}</span>
                        {t('label.inherited')}
                      </Tag>
                    </>
                  )}
                </Space>

                {!isEmpty(teamPermission.teamHierarchy) &&
                  teamPermission.teamHierarchy.length > 1 && (
                    <div>
                      <Text type="secondary">
                        {t('label.hierarchy') + ': '}
                      </Text>
                      {teamPermission.teamHierarchy.map((team, idx) => (
                        <React.Fragment key={idx}>
                          <Link
                            to={getEntityLink(
                              'team',
                              team.fullyQualifiedName || ''
                            )}>
                            {getEntityName(team)}
                          </Link>
                          {idx < teamPermission.teamHierarchy.length - 1 &&
                            ' → '}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                {!isEmpty(teamPermission.rolePermissions) && (
                  <div className="m-t-sm">
                    <Text strong className="m-b-sm">
                      {t('label.team-role-plural')}:{' '}
                    </Text>
                    {teamPermission.rolePermissions.map(
                      (rolePermission, roleIndex) =>
                        renderRolePermission(rolePermission, roleIndex)
                    )}
                  </div>
                )}

                {!isEmpty(teamPermission.directPolicies) && (
                  <div className="m-t-sm">
                    <Text strong className="m-b-sm">
                      {t('label.direct-team-policy-plural')}:{' '}
                    </Text>
                    {teamPermission.directPolicies.map((policy, policyIndex) =>
                      renderPolicy(policy, policyIndex)
                    )}
                  </div>
                )}
              </Space>
              <Divider />
            </div>
          )
        )}
      </Card>
    );
  };

  const renderInheritedPermissions = () => {
    if (isEmpty(permissionInfo?.inheritedPermissions)) {
      return null;
    }

    return (
      <Card
        className="m-b-md"
        title={t('label.other-inherited-permission-plural')}>
        {permissionInfo?.inheritedPermissions.map(
          (inherited: InheritedPermission, index: number) => (
            <div className="m-b-md" key={index}>
              <Space className="w-full" direction="vertical">
                <Space>
                  <Text strong>{t('label.type') + ': '}</Text>
                  <Tag color="purple">
                    {t(`label.${inherited.permissionType.toLowerCase()}`) ||
                      inherited.permissionType}
                  </Tag>
                </Space>
                <Text>{inherited.description}</Text>
                {inherited.source && (
                  <div>
                    <Text type="secondary">{t('label.source') + ': '}</Text>
                    <Link
                      to={getEntityLink(
                        inherited.source.type || '',
                        inherited.source.fullyQualifiedName || ''
                      )}>
                      {getEntityName(inherited.source)}
                    </Link>
                  </div>
                )}
                {inherited.policies.map((policy, policyIndex) =>
                  renderPolicy(policy, policyIndex)
                )}
              </Space>
            </div>
          )
        )}
      </Card>
    );
  };

  const renderSummary = () => {
    if (!permissionInfo?.summary) {
      return null;
    }

    const { summary } = permissionInfo;

    return (
      <Card className="m-b-md" title={t('label.permission-summary')}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Space direction="vertical">
              <Text type="secondary">{t('label.total-role-plural')}</Text>
              <Title level={4}>{summary.totalRoles}</Title>
              <Text type="secondary">
                <span>{summary.directRoles}</span> {t('label.direct-lowercase')}
                {', '}
                <span>{summary.inheritedRoles}</span> {t('label.inherited')}
              </Text>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical">
              <Text type="secondary">{t('label.policy-plural')}</Text>
              <Title level={4}>{summary.totalPolicies}</Title>
              <Text type="secondary">
                {summary.totalRules} {t('label.rule-lowercase-plural')}
              </Text>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical">
              <Text type="secondary">{t('label.team-plural')}</Text>
              <Title level={4}>{summary.teamCount}</Title>
              <Text type="secondary">
                {t('label.max-hierarchy-depth')}:{' '}
                <span>{summary.maxHierarchyDepth}</span>
              </Text>
            </Space>
          </Col>
        </Row>

        {!isEmpty(summary.effectiveOperations) && (
          <div className="m-t-md">
            <Text strong>{t('label.allowed-operation-plural') + ': '}</Text>
            <div className="m-t-xs">
              {summary.effectiveOperations.map((op, idx) => (
                <Tag className="m-r-xs m-b-xs" color="success" key={idx}>
                  {op}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {!isEmpty(summary.deniedOperations) && (
          <div className="m-t-md">
            <Text strong>{t('label.denied-operation-plural') + ': '}</Text>
            <div className="m-t-xs">
              {summary.deniedOperations.map((op, idx) => (
                <Tag className="m-r-xs m-b-xs" color="error" key={idx}>
                  {op}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="user-permissions-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="user-permissions-container">
      {renderSummary()}
      {renderDirectRoles()}
      {renderTeamPermissions()}
      {renderInheritedPermissions()}
    </div>
  );
};

export default UserPermissions;
