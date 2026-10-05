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
    TreeSelect,
    TreeSelectDataResponse,
    TreeSelectNode
} from '@openmetadata/ui-core-components';
import { Persona as PersonaIcon } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { EntityReference } from '../../../generated/entity/type';
import { getAllPersonas, searchPersonas } from '../../../rest/PersonaAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../utils/EntityReferenceUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { PersonaSelectProps } from './PersonaSelect.types';

// Map an EntityReference into a flat, leaf TreeSelect node that round-trips the
// reference in `data` (personas have no hierarchy).
const entityRefToTreeNode = (
  ref: EntityReference
): TreeSelectNode<EntityReference> => {
  const id = ref.fullyQualifiedName ?? ref.name ?? ref.id;

  return { id, value: id, label: getEntityName(ref), data: ref, isLeaf: true };
};

const personasToTreeNodes = (
  personas: Persona[]
): TreeSelectNode<EntityReference>[] =>
  personas.map((persona) =>
    entityRefToTreeNode(
      getEntityReferenceFromEntity<Persona>(persona, EntityType.PERSONA)
    )
  );

const withPersonaIcon = (
  nodes: TreeSelectNode<EntityReference>[]
): TreeSelectNode<EntityReference>[] =>
  nodes.map((node) => ({
    ...node,
    icon: <PersonaIcon height={16} width={16} />,
  }));

/**
 * Single-select persona picker built on the go-forward TreeSelect (the
 * FilterSelect family), mirroring DomainSelect. Flat list — personas have no
 * hierarchy — so the expand chevrons are suppressed and every node is a leaf.
 */
const PersonaSelect: FC<PersonaSelectProps> = ({
  selectedPersona,
  onUpdate,
  hasPermission = true,
  disabled = false,
  triggerVariant = 'input',
  triggerClassName,
  bordered,
  isOpen,
  onOpenChange,
  renderTrigger,
  label,
  placeholder,
  className,
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();

  const fetchData = useCallback(
    async ({
      searchTerm,
    }: {
      searchTerm?: string;
    }): Promise<TreeSelectDataResponse<EntityReference>> => {
      const personas = searchTerm
        ? await searchPersonas(searchTerm, PAGE_SIZE_LARGE)
        : (await getAllPersonas({ limit: PAGE_SIZE_LARGE })).data;

      return { nodes: withPersonaIcon(personasToTreeNodes(personas ?? [])) };
    },
    []
  );

  // Key on content, not the reference: the parent hands a fresh defaultPersona
  // object after each async PATCH, and keying on identity would re-run TreeSelect's
  // value→selection resync and visibly drop the pick. Mirrors DomainSelect.
  const selectedKey = JSON.stringify(
    selectedPersona
      ? [
          selectedPersona.id,
          selectedPersona.fullyQualifiedName,
          selectedPersona.name,
        ]
      : null
  );
  const value = useMemo(
    () => (selectedPersona ? [entityRefToTreeNode(selectedPersona)] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey]
  );

  const handleChange = useCallback(
    (
      selected:
        | TreeSelectNode<EntityReference>
        | TreeSelectNode<EntityReference>[]
        | null
    ) => {
      // Send only the schema-required ref fields: server read-only fields
      // (href, deleted, description) in a PATCH body are rejected.
      const data = Array.isArray(selected) ? selected[0]?.data : selected?.data;
      void onUpdate(data ? { id: data.id, type: data.type } : undefined);
    },
    [onUpdate]
  );

  const handleFetchError = useCallback(
    (error: unknown) => {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.persona') })
      );
    },
    [t]
  );

  return (
    <TreeSelect<EntityReference>
      lazyLoad
      searchable
      bordered={bordered}
      className={className}
      commitMode="immediate"
      data-testid={dataTestId}
      disabled={disabled || !hasPermission}
      fetchData={fetchData}
      isOpen={isOpen}
      label={label}
      multiple={false}
      placeholder={
        placeholder ?? t('label.select-field', { field: t('label.persona') })
      }
      renderTrigger={renderTrigger}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.persona'),
      })}
      showExpandIcon={false}
      triggerClassName={triggerClassName}
      triggerIcon={PersonaIcon}
      triggerVariant={triggerVariant}
      value={value}
      onChange={handleChange}
      onFetchError={handleFetchError}
      onOpenChange={onOpenChange}
    />
  );
};

export default PersonaSelect;
