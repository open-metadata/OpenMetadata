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
  Autocomplete,
  Box,
  Button,
  ButtonUtility,
  Card,
  Grid,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { WidgetProps } from '@rjsf/utils';
import { AxiosError } from 'axios';
import { debounce, uniqBy } from 'lodash';
import {
  FC,
  Key,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Role } from '../../../../../../generated/entity/teams/role';
import { searchRoles } from '../../../../../../rest/rolesAPIV1';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

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

const computeNextSearchResults = (
  prev: Map<string, RoleOption[]>,
  searchState: { availableRoles: RoleOption[]; mappings: RoleMappingEntry[] },
  mappingId: string,
  results: Role[]
): Map<string, RoleOption[]> => {
  const next = new Map(prev);
  const { availableRoles, mappings } = searchState;
  const currentMapping = mappings.find((mapping) => mapping.id === mappingId);
  const selectedRoles = new Set(currentMapping?.roles ?? []);
  const selectedRoleOptions = availableRoles.filter((role) =>
    selectedRoles.has(role.value)
  );
  next.set(
    mappingId,
    uniqBy(
      [
        ...selectedRoleOptions,
        ...results.map((role) => ({
          label: role.displayName || role.name,
          value: role.name,
        })),
      ],
      'value'
    )
  );

  return next;
};

const LdapRoleMappingWidget: FC<WidgetProps> = (props) => {
  const { t } = useTranslation();
  const { value, onChange, id, disabled, readonly } = props;

  const [mappings, setMappings] = useState<RoleMappingEntry[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [searchResults, setSearchResults] = useState<Map<string, RoleOption[]>>(
    new Map()
  );
  const [errors, setErrors] = useState<MappingError>({});

  const idCounterRef = useRef(0);
  const stableIdMapRef = useRef<Map<string, string>>(new Map());

  const getStableId = useCallback(
    (ldapGroup: string, index: number): string => {
      const key = `${index}-${ldapGroup}`;
      let stableId = stableIdMapRef.current.get(key);
      if (!stableId) {
        stableId = `mapping-${++idCounterRef.current}`;
        stableIdMapRef.current.set(key, stableId);
      }

      return stableId;
    },
    []
  );

  const isInitialMount = useRef(true);
  const searchStateRef = useRef({
    availableRoles: [] as RoleOption[],
    mappings: [] as RoleMappingEntry[],
  });

  searchStateRef.current = { availableRoles, mappings };

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
      try {
        const results = await searchRoles('');
        const roleOptions: RoleOption[] = results.map((role) => ({
          label: role.displayName || role.name,
          value: role.name,
        }));
        setAvailableRoles(roleOptions);
      } catch (error) {
        showErrorToast(error as AxiosError);
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
          if ((ldapGroupCounts.get(normalizedGroup) ?? 0) > 1) {
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

  const debouncedSearchRoles = useMemo(
    () =>
      debounce(async (mappingId: string, searchText: string) => {
        try {
          const results = await searchRoles(searchText);
          setSearchResults((prev) =>
            computeNextSearchResults(
              prev,
              searchStateRef.current,
              mappingId,
              results
            )
          );
        } catch (err) {
          showErrorToast(err as AxiosError);
        }
      }, 300),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearchRoles.cancel();
    };
  }, [debouncedSearchRoles]);

  const getRoleItems = (mappingId: string) =>
    (searchResults.get(mappingId) ?? availableRoles).map((role) => ({
      id: role.value,
      label: role.label,
    }));

  const getSelectedRoleItems = (mapping: RoleMappingEntry) => {
    const knownRoles = [
      ...availableRoles,
      ...(searchResults.get(mapping.id) ?? []),
    ];

    return mapping.roles.map((roleName) => ({
      id: roleName,
      label:
        knownRoles.find((role) => role.value === roleName)?.label ?? roleName,
    }));
  };

  return (
    <div className="ldap-role-mapping-widget" data-testid={id}>
      <Box
        inline
        align="stretch"
        className="layout-space"
        direction="col"
        gap={2}
        itemClassName="layout-space-item"
        style={{ width: '100%' }}>
        {mappings.length > 0 && (
          <Grid className="tw:mb-1" gap="2">
            <Grid.Item span={11}>
              <Typography className="tw:text-secondary" weight="medium">
                {t('label.ldap-group-dn')}
              </Typography>
            </Grid.Item>
            <Grid.Item span={12}>
              <Typography className="tw:text-secondary" weight="medium">
                {t('label.openmetadata-role-plural')}
              </Typography>
            </Grid.Item>
            <Grid.Item span={1} />
          </Grid>
        )}

        {mappings.map((mapping) => (
          <Card
            className="mapping-card"
            data-testid={`mapping-card-${mapping.id}`}
            key={mapping.id}
            size="sm"
            variant="ghost">
            <Grid gap="2">
              <Grid.Item span={11}>
                <Input
                  aria-label={t('label.ldap-group-dn')}
                  inputDataTestId={`ldap-group-input-${mapping.id}`}
                  isDisabled={disabled || readonly}
                  isInvalid={Boolean(errors[mapping.id])}
                  placeholder={t('message.ldap-group-dn-placeholder')}
                  value={mapping.ldapGroup}
                  onChange={(ldapGroup) =>
                    handleLdapGroupChange(mapping.id, ldapGroup)
                  }
                />
                {errors[mapping.id] && (
                  <Typography
                    className="text-xs m-t-xss"
                    color="danger"
                    data-testid={`ldap-group-error-${mapping.id}`}>
                    {errors[mapping.id]}
                  </Typography>
                )}
              </Grid.Item>

              <Grid.Item span={12}>
                <Autocomplete
                  aria-label={t('label.openmetadata-role-plural')}
                  data-testid={`roles-select-${mapping.id}`}
                  filterOption={() => true}
                  isDisabled={disabled || readonly}
                  items={getRoleItems(mapping.id)}
                  placeholder={t('label.select-field', {
                    field: t('label.role-plural'),
                  })}
                  selectedItems={getSelectedRoleItems(mapping)}
                  onItemCleared={(key: Key) =>
                    handleRolesChange(
                      mapping.id,
                      mapping.roles.filter((role) => role !== key)
                    )
                  }
                  onItemInserted={(key: Key) =>
                    handleRolesChange(mapping.id, [
                      ...mapping.roles,
                      String(key),
                    ])
                  }
                  onSearchChange={(val) =>
                    debouncedSearchRoles(mapping.id, val)
                  }>
                  {(item) => (
                    <Autocomplete.Item id={item.id} label={item.label} />
                  )}
                </Autocomplete>
              </Grid.Item>

              <Grid.Item className="tw:flex tw:items-center" span={1}>
                <ButtonUtility
                  data-testid={`remove-mapping-btn-${mapping.id}`}
                  icon={Trash01}
                  isDisabled={disabled || readonly}
                  size="lg"
                  tooltip={t('label.remove-entity', {
                    entity: t('label.mapping'),
                  })}
                  onClick={() => handleRemoveMapping(mapping.id)}
                />
              </Grid.Item>
            </Grid>
          </Card>
        ))}

        {!readonly && (
          <Button
            className="tw:w-full"
            color="secondary"
            data-testid="add-mapping-btn"
            iconLeading={Plus}
            isDisabled={disabled}
            onClick={handleAddMapping}>
            {t('label.add-entity', {
              entity: t('label.ldap-group-mapping'),
            })}
          </Button>
        )}

        {mappings.length === 0 && readonly && (
          <Typography color="secondary">
            {t('message.no-ldap-role-mappings')}
          </Typography>
        )}
      </Box>
    </div>
  );
};

export default LdapRoleMappingWidget;
