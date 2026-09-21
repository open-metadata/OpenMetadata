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
  TreeSelect,
  TreeSelectDataResponse,
  TreeSelectNode,
} from '@openmetadata/ui-core-components';
import { Domain as DomainIcon } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import {
  getDomainChildrenPaginated,
  searchDomains,
} from '../../../rest/domainAPI';
import {
  buildDomainSearchQuery,
  domainsToTreeNodes,
  entityReferencesToTreeNodes,
  treeNodesToEntityReferences,
} from './DomainSelect.utils';
import { DomainSelectProps } from './DomainSelect.types';

const DomainSelect: FC<DomainSelectProps> = ({
  selectedDomain,
  multiple = false,
  disabled = false,
  hasPermission = true,
  isClearable = true,
  restrictedDomains,
  onUpdate,
  triggerVariant = 'input',
  bordered,
  commitMode,
  renderTrigger,
  isOpen,
  onOpenChange,
  label,
  placeholder,
  onCreate,
  createLabel,
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();

  const resolvedCommitMode =
    commitMode ?? (triggerVariant === 'input' ? 'immediate' : 'staged');

  const restrictedFqns = useMemo(
    () =>
      new Set(
        (restrictedDomains ?? [])
          .map((domain) => domain.fullyQualifiedName)
          .filter(Boolean) as string[]
      ),
    [restrictedDomains]
  );

  const dropRestricted = useCallback(
    (nodes: TreeSelectNode<EntityReference>[]) =>
      restrictedFqns.size === 0
        ? nodes
        : nodes.filter((node) => !restrictedFqns.has(node.value)),
    [restrictedFqns]
  );

  // The pure mappers cannot build JSX, so the domain glyph is attached here
  // (recursively, so search-nested subdomains get it too).
  const withDomainIcon = useCallback(
    (
      nodes: TreeSelectNode<EntityReference>[]
    ): TreeSelectNode<EntityReference>[] =>
      nodes.map((node) => ({
        ...node,
        icon: <DomainIcon height={16} width={16} />,
        children: node.children ? withDomainIcon(node.children) : node.children,
      })),
    []
  );

  const fetchData = useCallback(
    async ({
      searchTerm,
      parentId,
      signal,
    }: {
      searchTerm?: string;
      parentId?: string;
      signal?: AbortSignal;
    }): Promise<TreeSelectDataResponse<EntityReference>> => {
      if (searchTerm) {
        const results = (await searchDomains(
          buildDomainSearchQuery(searchTerm),
          1,
          undefined,
          signal
        )) as unknown as Domain[];

        return {
          nodes: withDomainIcon(
            dropRestricted(domainsToTreeNodes(results ?? []))
          ),
        };
      }

      const { data } = await getDomainChildrenPaginated(
        parentId,
        PAGE_SIZE_LARGE
      );

      return {
        nodes: withDomainIcon(dropRestricted(domainsToTreeNodes(data ?? []))),
      };
    },
    [dropRestricted, withDomainIcon]
  );

  const value = useMemo(() => {
    if (!selectedDomain) {
      return [];
    }
    const domains = Array.isArray(selectedDomain)
      ? selectedDomain
      : [selectedDomain];

    return entityReferencesToTreeNodes(domains);
  }, [selectedDomain]);

  const handleChange = useCallback(
    (
      selected:
        | TreeSelectNode<EntityReference>
        | TreeSelectNode<EntityReference>[]
        | null
    ) => {
      const domains = treeNodesToEntityReferences(selected);

      if (multiple) {
        onUpdate(domains);

        return;
      }

      // Single mode: keep the current value when a clear is not allowed.
      if (isEmpty(domains) && !isClearable) {
        return;
      }

      onUpdate(domains[0]);
    },
    [multiple, isClearable, onUpdate]
  );

  // Server already scoped the results, so skip the client-side label filter
  // (it would hide parents whose matching descendants are nested under them).
  const skipClientFilter = useCallback(() => true, []);

  return (
    <TreeSelect<EntityReference>
      lazyLoad
      searchable
      bordered={bordered}
      commitMode={resolvedCommitMode}
      createLabel={createLabel}
      data-testid={dataTestId}
      disabled={disabled || !hasPermission}
      fetchData={fetchData}
      filterNode={skipClientFilter}
      isOpen={isOpen}
      label={label}
      multiple={multiple}
      placeholder={
        placeholder ??
        t('label.select-field', { field: t('label.domain-plural') })
      }
      renderTrigger={renderTrigger}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.domain-plural'),
      })}
      triggerVariant={triggerVariant}
      value={value}
      onChange={handleChange}
      onCreate={onCreate}
      onOpenChange={onOpenChange}
    />
  );
};

export default DomainSelect;
