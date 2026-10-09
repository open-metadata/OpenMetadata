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

import {
  Box,
  Button,
  HintText,
  Input,
  Label,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { WidgetProps } from '@rjsf/utils';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getWidgetHint,
  getWidgetLabel,
} from '../../../../../common/FormBuilderV1/widgets/coreWidgetUtils';
import {
  findDuplicateLdapGroups,
  LdapRoleMapping,
  parseLdapRoleMappings,
  serializeLdapRoleMappings,
} from './SsoLdapRoleMapping.utils';
import SsoRolesAutocomplete from './SsoRolesAutocomplete';

let nextMappingId = 0;
const createMappingId = () => `mapping-${++nextMappingId}`;

/**
 * Edits the LDAP `authRolesMapping` JSON string (`{ "<group DN>": ["Role"] }`)
 * as rows of group DN + roles. A duplicate group DN is flagged and the value is
 * not emitted until it is resolved, as two rows would collapse into one key.
 */
const SsoLdapRoleMappingWidget = ({
  id,
  value,
  label,
  hideLabel,
  schema,
  options,
  rawErrors,
  disabled,
  readonly,
  onChange,
}: WidgetProps) => {
  const { t } = useTranslation();
  const displayLabel = getWidgetLabel({ hideLabel, label });
  const hint = getWidgetHint({ rawErrors, schema, options });
  const isDisabled = disabled || readonly;
  const [mappings, setMappings] = useState<LdapRoleMapping[]>(() =>
    parseLdapRoleMappings(value, createMappingId)
  );
  const duplicates = findDuplicateLdapGroups(mappings);
  const lastEmitted = useRef<unknown>(value);

  // Rebuild the rows only when the value changes from outside (e.g. the form
  // discards its edits). Our own edits echo back unchanged, and rebuilding on
  // those would drop rows that have no group DN yet.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setMappings(parseLdapRoleMappings(value, createMappingId));
    }
  }, [value]);

  const update = (next: LdapRoleMapping[]) => {
    setMappings(next);
    if (findDuplicateLdapGroups(next).size === 0) {
      const serialized = serializeLdapRoleMappings(next);
      lastEmitted.current = serialized;
      onChange(serialized);
    }
  };

  const patchMapping = (mappingId: string, patch: Partial<LdapRoleMapping>) =>
    update(mappings.map((m) => (m.id === mappingId ? { ...m, ...patch } : m)));

  return (
    <Box data-testid={id} direction="col" gap={3}>
      {displayLabel && <Label>{displayLabel}</Label>}
      {mappings.map((mapping) => (
        <Box
          align="start"
          className="tw:rounded-lg tw:border tw:border-secondary tw:p-3"
          data-testid={`mapping-card-${mapping.id}`}
          direction="row"
          gap={3}
          key={mapping.id}>
          <div className="tw:flex-1">
            <Input
              data-testid={`ldap-group-input-${mapping.id}`}
              hint={
                duplicates.has(mapping.id)
                  ? t('message.ldap-group-duplicate-error')
                  : undefined
              }
              isDisabled={isDisabled}
              isInvalid={duplicates.has(mapping.id)}
              label={t('label.ldap-group-dn')}
              placeholder={t('message.ldap-group-dn-placeholder')}
              value={mapping.ldapGroup}
              onChange={(ldapGroup) => patchMapping(mapping.id, { ldapGroup })}
            />
          </div>
          <div className="tw:flex-1">
            <SsoRolesAutocomplete
              isDisabled={isDisabled}
              label={t('label.openmetadata-role-plural')}
              placeholder={t('label.select-field', {
                field: t('label.role-plural'),
              })}
              testId={`roles-select-${mapping.id}`}
              value={mapping.roles}
              onChange={(roles) => patchMapping(mapping.id, { roles })}
            />
          </div>
          {!readonly && (
            <Button
              aria-label={t('label.delete')}
              className="tw:mt-6"
              color="tertiary"
              data-testid={`remove-mapping-btn-${mapping.id}`}
              iconLeading={Trash01}
              isDisabled={isDisabled}
              size="sm"
              onPress={() =>
                update(mappings.filter((m) => m.id !== mapping.id))
              }
            />
          )}
        </Box>
      ))}

      {!readonly && (
        <Button
          color="secondary"
          data-testid="add-mapping-btn"
          iconLeading={Plus}
          isDisabled={disabled}
          size="sm"
          onPress={() =>
            setMappings([
              ...mappings,
              { id: createMappingId(), ldapGroup: '', roles: [] },
            ])
          }>
          {t('label.add-entity', { entity: t('label.ldap-group-mapping') })}
        </Button>
      )}

      {hint && <HintText isInvalid={!!rawErrors?.length}>{hint}</HintText>}

      {readonly && mappings.length === 0 && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.no-ldap-role-mappings')}
        </Typography>
      )}
    </Box>
  );
};

export default SsoLdapRoleMappingWidget;
