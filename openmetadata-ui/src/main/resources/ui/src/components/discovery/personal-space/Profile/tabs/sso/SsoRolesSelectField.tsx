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

import { FieldProps } from '@rjsf/utils';
import { useTranslation } from 'react-i18next';
import { getFormDisplayLabel } from '../../../../../common/FormBuilderV1/formBuilderV1LabelUtils';
import SsoRolesAutocomplete from './SsoRolesAutocomplete';

/** RJSF `RolesSelectField` (e.g. LDAP `authReassignRoles`): role names searched server-side. */
const SsoRolesSelectField = ({
  idSchema,
  name,
  formData,
  schema,
  uiSchema,
  required,
  disabled,
  readonly,
  rawErrors,
  formContext,
  onChange,
  onBlur,
}: FieldProps<string[]>) => {
  const { t } = useTranslation();
  const id = idSchema.$id;
  const value = formData ?? [];

  return (
    <div id={id}>
      <SsoRolesAutocomplete
        hint={rawErrors?.[0] ?? schema.description}
        isDisabled={disabled || readonly}
        isInvalid={Boolean(rawErrors?.length)}
        isRequired={required}
        label={schema.title ?? getFormDisplayLabel(name)}
        placeholder={
          (uiSchema?.['ui:placeholder'] as string | undefined) ??
          t('label.select-field', { field: t('label.role-plural') })
        }
        testId={`sso-roles-select-${name}`}
        value={value}
        onBlur={() => onBlur(id, value)}
        onChange={onChange}
        onFocus={() => formContext?.handleFocus?.(id)}
      />
    </div>
  );
};

export default SsoRolesSelectField;
