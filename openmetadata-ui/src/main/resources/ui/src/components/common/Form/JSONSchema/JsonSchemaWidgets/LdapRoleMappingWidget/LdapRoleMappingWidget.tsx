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

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { WidgetProps } from '@rjsf/utils';
import { Button, Card, Input, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRoles } from '../../../../../../rest/rolesAPIV1';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import './ldap-role-mapping-widget.less';

const { Text } = Typography;

interface RoleMappingEntry {
  id: string;
  ldapGroup: string;
  roles: string[];
}

interface RoleOption {
  label: string;
  value: string;
}

const LdapRoleMappingWidget: FC<WidgetProps> = (props) => {
  const { t } = useTranslation();
  const { value, onChange, id, disabled, readonly } = props;

  const [mappings, setMappings] = useState<RoleMappingEntry[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Parse JSON string value to mappings array
  useEffect(() => {
    if (value && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as Record<string, string[]>;
        const entries: RoleMappingEntry[] = Object.entries(parsed).map(
          ([ldapGroup, roles], index) => ({
            id: `${index}-${ldapGroup}`,
            ldapGroup,
            roles,
          })
        );
        setMappings(entries);
      } catch (e) {
        // Invalid JSON, start fresh
        setMappings([]);
      }
    } else {
      setMappings([]);
    }
  }, [value]);

  // Fetch available roles from backend
  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoadingRoles(true);
      try {
        const response = await getRoles('*', undefined, undefined, true, 1000);
        const roleOptions: RoleOption[] = (response.data || []).map((role) => ({
          label: role.displayName || role.name,
          value: role.name,
        }));
        setAvailableRoles(roleOptions);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoadingRoles(false);
      }
    };

    fetchRoles();
  }, [t]);

  // Convert mappings array back to JSON string
  const updateValue = useCallback(
    (newMappings: RoleMappingEntry[]) => {
      const result: Record<string, string[]> = {};
      newMappings.forEach((mapping) => {
        if (mapping.ldapGroup && mapping.roles.length > 0) {
          result[mapping.ldapGroup] = mapping.roles;
        }
      });
      onChange(JSON.stringify(result));
    },
    [onChange]
  );

  const handleAddMapping = useCallback(() => {
    const newMapping: RoleMappingEntry = {
      id: `new-${Date.now()}`,
      ldapGroup: '',
      roles: [],
    };
    const newMappings = [...mappings, newMapping];
    setMappings(newMappings);
  }, [mappings]);

  const handleRemoveMapping = useCallback(
    (mappingId: string) => {
      const newMappings = mappings.filter((m) => m.id !== mappingId);
      setMappings(newMappings);
      updateValue(newMappings);
    },
    [mappings, updateValue]
  );

  const handleLdapGroupChange = useCallback(
    (mappingId: string, ldapGroup: string) => {
      const newMappings = mappings.map((m) =>
        m.id === mappingId ? { ...m, ldapGroup } : m
      );
      setMappings(newMappings);
      updateValue(newMappings);
    },
    [mappings, updateValue]
  );

  const handleRolesChange = useCallback(
    (mappingId: string, roles: string[]) => {
      const newMappings = mappings.map((m) =>
        m.id === mappingId ? { ...m, roles } : m
      );
      setMappings(newMappings);
      updateValue(newMappings);
    },
    [mappings, updateValue]
  );

  return (
    <div className="ldap-role-mapping-widget" data-testid={id}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {mappings.length > 0 && (
          <div className="mapping-header">
            <div className="mapping-header-col">
              <Text strong>{t('label.ldap-group-dn')}</Text>
            </div>
            <div className="mapping-header-col">
              <Text strong>{t('label.openmetadata-role-plural')}</Text>
            </div>
            <div className="mapping-header-actions" />
          </div>
        )}

        {mappings.map((mapping) => (
          <Card
            className="mapping-card"
            data-testid={`mapping-card-${mapping.id}`}
            key={mapping.id}
            size="small">
            <div className="mapping-row">
              <div className="mapping-col ldap-group-col">
                <Input
                  data-testid={`ldap-group-input-${mapping.id}`}
                  disabled={disabled || readonly}
                  placeholder={t('message.ldap-group-dn-placeholder')}
                  value={mapping.ldapGroup}
                  onChange={(e) =>
                    handleLdapGroupChange(mapping.id, e.target.value)
                  }
                />
              </div>
              <div className="mapping-col roles-col">
                <Select
                  showSearch
                  className="w-full"
                  data-testid={`roles-select-${mapping.id}`}
                  disabled={disabled || readonly}
                  loading={isLoadingRoles}
                  mode="multiple"
                  options={availableRoles}
                  placeholder={t('label.select-field', {
                    field: t('label.role-plural'),
                  })}
                  value={mapping.roles}
                  onChange={(roles) => handleRolesChange(mapping.id, roles)}
                />
              </div>
              <div className="mapping-col actions-col">
                <Button
                  data-testid={`remove-mapping-btn-${mapping.id}`}
                  disabled={disabled || readonly}
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                  onClick={() => handleRemoveMapping(mapping.id)}
                />
              </div>
            </div>
          </Card>
        ))}

        {!readonly && (
          <Button
            block
            data-testid="add-mapping-btn"
            disabled={disabled}
            icon={<PlusOutlined />}
            type="dashed"
            onClick={handleAddMapping}>
            {t('label.add-entity', {
              entity: t('label.ldap-group-mapping'),
            })}
          </Button>
        )}

        {mappings.length === 0 && readonly && (
          <Text type="secondary">{t('message.no-ldap-role-mappings')}</Text>
        )}
      </Space>
    </div>
  );
};

export default LdapRoleMappingWidget;
