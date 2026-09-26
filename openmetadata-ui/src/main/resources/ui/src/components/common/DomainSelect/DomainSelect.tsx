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
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import {
  getDomainChildrenPaginated,
  searchDomains,
} from '../../../rest/domainAPI';
import { isDomainFqnAllowed } from '../../../utils/DomainRestrictionUtils';
import { getDomainsContentKey } from '../../../utils/DomainSyncUtils';
import { DomainSelectProps } from './DomainSelect.types';
import {
  buildDomainSearchQuery,
  domainsToTreeNodes,
  entityReferencesToTreeNodes,
  isSameDomainSelection,
  treeNodesToEntityReferences,
  fetchAllDomainChildren,
  withDomainIcon,
} from './DomainSelect.utils';

const DomainSelect: FC<DomainSelectProps> = ({
  selectedDomain,
  multiple = false,
  disabled = false,
  hasPermission = true,
  isClearable = true,
  restrictedDomains,
  showAllDomains = false,
  onUpdate,
  triggerVariant = 'input',
  bordered,
  commitMode,
  renderTrigger,
  isOpen,
  onOpenChange,
  label,
  placeholder,
  className,
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();

  // Staged (batch Apply/Cancel footer) only earns its keep for multi-select in
  // the popover/filter triggers. Single-select and the inline input field
  // commit immediately (pick one → apply + close), so no footer is shown.
  const resolvedCommitMode =
    commitMode ??
    (triggerVariant !== 'input' && multiple ? 'staged' : 'immediate');

  const allowedFqns = useMemo(
    () =>
      (restrictedDomains ?? [])
        .map((domain) => domain.fullyQualifiedName)
        .filter(Boolean) as string[],
    [restrictedDomains]
  );

  // `restrictedDomains` carries the domains a domain-restricted user is allowed
  // to use, so keep only those and their descendants. The prefix rule itself
  // lives in DomainRestrictionUtils so this cannot drift from the non-tree
  // callers. An empty list means "no restriction" here — show everything.
  const filterAllowedNodes = useCallback(
    (nodes: TreeSelectNode<EntityReference>[]) =>
      allowedFqns.length === 0
        ? nodes
        : nodes.filter((node) => isDomainFqnAllowed(node.value, allowedFqns)),
    [allowedFqns]
  );

  // The pure mappers cannot build JSX, so the domain glyph is attached here.
  // Nested nodes are subdomains of the node above them, so they get the
  // subdomain glyph; `isSubDomain` is threaded through the recursion (and set
  // by the lazy-load path when fetching a parent's children).
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
            filterAllowedNodes(domainsToTreeNodes(results ?? []))
          ),
        };
      }

      const data = await fetchAllDomainChildren(
        (offset, pageSize) =>
          getDomainChildrenPaginated(parentId, pageSize, offset, signal),
        PAGE_SIZE_LARGE
      );

      const nodes = withDomainIcon(
        filterAllowedNodes(domainsToTreeNodes(data)),
        Boolean(parentId)
      );

      // Scope-switcher: a single "All Domains" root with every domain nested
      // beneath it (expanded by default via defaultExpandedKeys). It carries no
      // `data`, so selecting it maps to an empty selection → onUpdate(undefined)
      // → scope cleared, while its children set a specific scope.
      if (showAllDomains && !parentId) {
        return {
          nodes: [
            {
              id: DEFAULT_DOMAIN_VALUE,
              value: DEFAULT_DOMAIN_VALUE,
              label: t('label.all-domain-plural'),
              isLeaf: false,
              lazyLoad: false,
              icon: <DomainIcon height={16} width={16} />,
              children: nodes,
            },
          ],
        };
      }

      return { nodes };
    },
    [filterAllowedNodes, showAllDomains, t]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDomainList = useMemo(() => {
    if (!selectedDomain) {
      return [];
    }

    return Array.isArray(selectedDomain) ? selectedDomain : [selectedDomain];
  }, [selectedDomain]);

  // Keyed on the *content*, not the array reference. Consumers hand us a fresh
  // array on every render, and the core TreeSelect re-runs
  // `setSelection(toArray(value))` whenever `value` changes identity — which in
  // staged (multi) mode wipes choices the user has not applied yet. Doing the
  // comparison here covers every caller in OSS and Collate, instead of each one
  // needing its own guard.
  const selectedDomainKey = getDomainsContentKey(selectedDomainList);
  const value = useMemo(() => {
    // Scope switchers sit on "All Domains" when nothing is selected. Without a
    // value the synthetic root renders unselected, so the user cannot see which
    // scope is active — the legacy tree bolded that row.
    if (showAllDomains && selectedDomainList.length === 0) {
      return [
        {
          id: DEFAULT_DOMAIN_VALUE,
          value: DEFAULT_DOMAIN_VALUE,
          label: t('label.all-domain-plural'),
        } as TreeSelectNode<EntityReference>,
      ];
    }

    return entityReferencesToTreeNodes(selectedDomainList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomainKey, showAllDomains, t]);

  const handleChange = useCallback(
    async (
      selected:
        | TreeSelectNode<EntityReference>
        | TreeSelectNode<EntityReference>[]
        | null
    ) => {
      const domains = treeNodesToEntityReferences(selected);

      // Single mode: keep the current value when a clear is not allowed.
      if (!multiple && isEmpty(domains) && !isClearable) {
        return;
      }

      // The legacy tree compared FQNs and cancelled when nothing changed. Apply
      // always firing meant a no-change Apply still sent a GET + PATCH.
      if (isSameDomainSelection(selectedDomainList, domains)) {
        return;
      }

      // Await so a second Apply cannot land while the first PATCH is in flight.
      if (isSubmitting) {
        return;
      }

      try {
        setIsSubmitting(true);
        await onUpdate(multiple ? domains : domains[0]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [multiple, isClearable, onUpdate, selectedDomainList, isSubmitting]
  );

  // Server already scoped the results, so skip the client-side label filter
  // (it would hide parents whose matching descendants are nested under them).
  const skipClientFilter = useCallback(() => true, []);

  return (
    <TreeSelect<EntityReference>
      lazyLoad
      searchable
      bordered={bordered}
      className={className}
      commitMode={resolvedCommitMode}
      data-testid={dataTestId}
      defaultExpandedKeys={showAllDomains ? [DEFAULT_DOMAIN_VALUE] : undefined}
      disabled={disabled || !hasPermission}
      fetchData={fetchData}
      filterNode={skipClientFilter}
      isOpen={isOpen}
      label={label}
      maxIndentLevel={showAllDomains ? 3 : undefined}
      multiple={multiple}
      placeholder={
        placeholder ??
        t('label.select-field', { field: t('label.domain-plural') })
      }
      renderTrigger={renderTrigger}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.domain-plural'),
      })}
      triggerIcon={DomainIcon}
      triggerVariant={triggerVariant}
      value={value}
      onChange={handleChange}
      onOpenChange={onOpenChange}
    />
  );
};

export default DomainSelect;
