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

import { PlusOutlined } from '@ant-design/icons';
import { Grid } from '@mui/material';
import { WidgetProps } from '@rjsf/utils';
import { Button, Card, Input, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../../../../../assets/svg/ic-delete.svg';
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

interface MappingError {
  [mappingId: string]: string;
}

const LdapRoleMappingWidget: FC<WidgetProps> = (props) => {
  const { t } = useTranslation();
  const { value, onChange, id, disabled, readonly } = props;

  const [mappings, setMappings] = useState<RoleMappingEntry[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [errors, setErrors] = useState<MappingError>({});

  const idCounterRef = useRef(0);
  const stableIdMapRef = useRef<Map<string, string>>(new Map());

  const getStableId = useCallback(
    (ldapGroup: string, index: number): string => {
      const key = `${index}-${ldapGroup}`;
      if (!stableIdMapRef.current.has(key)) {
        const stableId = `mapping-${++idCounterRef.current}`;
        stableIdMapRef.current.set(key, stableId);
      }

      return stableIdMapRef.current.get(key)!;
    },
    []
  );

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      if (value && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value) as Record<string, string[]>;
          const entries: RoleMappingEntry[] = Object.entries(parsed).map(
            ([ldapGroup, roles], index) => ({
              id: getStableId(ldapGroup, index),
              ldapGroup,
              roles,
            })
          );
          setMappings(entries);
        } catch {
          setMappings([]);
        }
      } else {
        setMappings([]);
      }
      isInitialMount.current = false;
    }
  }, [value, getStableId]);

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
  }, []);

  const checkDuplicates = useCallback(
    (newMappings: RoleMappingEntry[]) => {
      const newErrors: MappingError = {};
      const ldapGroupCounts = new Map<string, number>();

      newMappings.forEach((mapping) => {
        if (mapping.ldapGroup.trim()) {
          const normalizedGroup = mapping.ldapGroup.trim().toLowerCase();
          ldapGroupCounts.set(
            normalizedGroup,
            (ldapGroupCounts.get(normalizedGroup) || 0) + 1
          );
        }
      });

      newMappings.forEach((mapping) => {
        if (mapping.ldapGroup.trim()) {
          const normalizedGroup = mapping.ldapGroup.trim().toLowerCase();
          if (ldapGroupCounts.get(normalizedGroup)! > 1) {
            newErrors[mapping.id] = t('message.ldap-group-duplicate-error');
          }
        }
      });

      setErrors(newErrors);

      return Object.keys(newErrors).length === 0;
    },
    [t]
  );

  const updateValue = useCallback(
    (newMappings: RoleMappingEntry[]) => {
      const isValid = checkDuplicates(newMappings);

      const result: Record<string, string[]> = {};
      newMappings.forEach((mapping) => {
        if (mapping.ldapGroup) {
          result[mapping.ldapGroup] = mapping.roles;
        }
      });

      if (isValid) {
        onChange(JSON.stringify(result));
      }
    },
    [onChange, checkDuplicates]
  );

  const handleAddMapping = useCallback(() => {
    const newMapping: RoleMappingEntry = {
      id: `new-${Date.now()}-${Math.random()}`,
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

      const newErrors = { ...errors };
      delete newErrors[mappingId];
      setErrors(newErrors);

      updateValue(newMappings);
    },
    [mappings, errors, updateValue]
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
              <Text>{t('label.ldap-group-dn')}</Text>
            </div>
            <div className="mapping-header-col">
              <Text>{t('label.openmetadata-role-plural')}</Text>
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
            <Grid container alignItems="center" spacing={2}>
              <Grid size="grow">
                <div>
                  <Input
                    className="form-control"
                    data-testid={`ldap-group-input-${mapping.id}`}
                    disabled={disabled || readonly}
                    placeholder={t('message.ldap-group-dn-placeholder')}
                    status={errors[mapping.id] ? 'error' : undefined}
                    value={mapping.ldapGroup}
                    onChange={(e) =>
                      handleLdapGroupChange(mapping.id, e.target.value)
                    }
                  />
                  {errors[mapping.id] && (
                    <Text
                      className="text-xs m-t-xss"
                      data-testid={`ldap-group-error-${mapping.id}`}
                      type="danger">
                      {errors[mapping.id]}
                    </Text>
                  )}
                </div>
              </Grid>

              <Grid size="grow">
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
              </Grid>

              <Grid size="auto">
                <Button
                  data-testid={`remove-mapping-btn-${mapping.id}`}
                  disabled={disabled || readonly}
                  icon={<DeleteIcon height={20} width={20} />}
                  size="large"
                  type="text"
                  onClick={() => handleRemoveMapping(mapping.id)}
                />
              </Grid>
            </Grid>
          </Card>
        ))}

        {!readonly && (
          <Button
            block
            className="add-mapping-btn"
            data-testid="add-mapping-btn"
            disabled={disabled}
            icon={<PlusOutlined />}
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
