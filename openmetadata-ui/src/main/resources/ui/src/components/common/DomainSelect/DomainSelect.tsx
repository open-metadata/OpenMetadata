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
  DomainTag,
  TreeSelect,
  TreeSelectDataFetcherParams,
  TreeSelectDataResponse,
  TreeSelectNode,
} from '@openmetadata/ui-core-components';
import { Globe01 as DomainIcon } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
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
import {
  isDomainFqnAllowed,
  toAllowedFqns,
} from '../../../utils/DomainRestrictionUtils';
import { getDomainsContentKey } from '../../../utils/DomainSyncUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DomainSelectProps } from './DomainSelect.types';
import {
  buildDomainSearchQuery,
  decodeDomainCursor,
  domainsToTreeNodes,
  encodeDomainCursor,
  entityReferencesToTreeNodes,
  fetchAllDomainChildren,
  getSelectedAncestorKeys,
  isSameDomainSelection,
  treeNodesToEntityReferences,
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
  triggerClassName,
  fullWidthTrigger,
  placement,
  offset: dropdownOffset,
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
    () => toAllowedFqns(restrictedDomains ?? []),
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
  const toNodes = useCallback(
    (domains: Domain[], isSubDomain = false) =>
      withDomainIcon(
        filterAllowedNodes(domainsToTreeNodes(domains ?? [])),
        isSubDomain
      ),
    [filterAllowedNodes]
  );

  const fetchSearchHits = useCallback(
    async (searchTerm: string, signal?: AbortSignal) => {
      const results = (await searchDomains(
        buildDomainSearchQuery(searchTerm),
        1,
        undefined,
        signal
      )) as unknown as Domain[];

      return { nodes: toNodes(results) };
    },
    [toNodes]
  );

  // One level, one page. `parentId` is the parent's FQN, except for the
  // synthetic "All Domains" row, whose children are the root listing. That id
  // is only synthetic when we put it there, so the check is gated on
  // `showAllDomains` — a real domain named "All Domains" must list its own
  // children, not the roots.
  const fetchChildPage = useCallback(
    async (
      parentId: string,
      pageSize?: number,
      after?: string,
      signal?: AbortSignal
    ) => {
      const offset = decodeDomainCursor(after);
      const parentFqn =
        showAllDomains && parentId === DEFAULT_DOMAIN_VALUE
          ? undefined
          : parentId;

      const { data, paging } = await getDomainChildrenPaginated(
        parentFqn,
        pageSize ?? PAGE_SIZE_LARGE,
        offset,
        signal
      );

      // Advance by what the server returned, so the next page resumes at the
      // right row. An empty page also ends the branch: without that guard the
      // cursor would not move and "Show more" would refetch it forever — which
      // a concurrent delete can produce while `total` still exceeds `offset`.
      const received = data?.length ?? 0;
      const nextOffset = offset + received;
      const hasMore = received > 0 && nextOffset < (paging?.total ?? 0);

      return {
        nodes: toNodes(data, parentFqn !== undefined),
        hasMore,
        // Safe to report even for a domain-restricted user: `/domains/hierarchy`
        // applies the same restriction server-side (`applyDomainSelfRestriction`
        // → `id IN (allowed) OR fqnHash LIKE 'allowed.%'`), which is exactly the
        // rule `filterAllowedNodes` applies. The client filter is kept as
        // defence in depth, so in practice it prunes nothing and `total` matches
        // what the user can see.
        total: paging?.total,
        nextCursor: hasMore ? encodeDomainCursor(nextOffset) : undefined,
      };
    },
    [showAllDomains, toNodes]
  );

  // Scope-switcher: a single "All Domains" row that owns every root domain as a
  // real branch, so those roots page like any other level. It carries no `data`,
  // so selecting it maps to an empty selection → onUpdate(undefined) → scope
  // cleared, while its children set a specific scope.
  const allDomainsRoot = useCallback(
    (): TreeSelectNode<EntityReference> => ({
      id: DEFAULT_DOMAIN_VALUE,
      value: DEFAULT_DOMAIN_VALUE,
      label: t('label.all-domain-plural'),
      isLeaf: false,
      lazyLoad: true,
      icon: <DomainIcon height={16} width={16} />,
    }),
    [t]
  );

  // The root listing of a plain picker is the one level that cannot offer a
  // "Show N more" row, so it still drains — see MAX_DOMAIN_NODES.
  const fetchRoots = useCallback(
    async (signal?: AbortSignal) => {
      const data = await fetchAllDomainChildren(
        (offset, limit) =>
          getDomainChildrenPaginated(undefined, limit, offset, signal),
        PAGE_SIZE_LARGE
      );

      return { nodes: toNodes(data) };
    },
    [toNodes]
  );

  // Not wrapped in a try/catch: an empty page reads as the end of a branch, so a
  // swallowed failure would clear its cursor and strand every domain after it.
  // Rejecting leaves the branch untouched and still resumable, and `onFetchError`
  // below keeps the toast on the API's message.
  const fetchData = useCallback(
    async ({
      searchTerm,
      parentId,
      pageSize,
      after,
      signal,
    }: TreeSelectDataFetcherParams): Promise<
      TreeSelectDataResponse<EntityReference>
    > => {
      if (searchTerm) {
        return fetchSearchHits(searchTerm, signal);
      }

      if (parentId) {
        return fetchChildPage(parentId, pageSize, after, signal);
      }

      return showAllDomains
        ? { nodes: [allDomainsRoot()] }
        : fetchRoots(signal);
    },
    [
      allDomainsRoot,
      fetchChildPage,
      fetchRoots,
      fetchSearchHits,
      showAllDomains,
    ]
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

  // Open the synthetic root (scope switchers) plus the ancestors of anything
  // already selected, so a nested selection is visible when the tree opens.
  const defaultExpandedKeys = useMemo(() => {
    const keys = [
      ...(showAllDomains ? [DEFAULT_DOMAIN_VALUE] : []),
      ...getSelectedAncestorKeys(selectedDomainList),
    ];

    return keys.length > 0 ? keys : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllDomains, selectedDomainKey]);

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

  // The core toast would show a raw axios string; showErrorToast maps an API
  // error to its translated server message and falls back sensibly.
  const handleFetchError = useCallback(
    (error: unknown) => {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.domain-plural') })
      );
    },
    [t]
  );

  // The `input` trigger showed the selection as plain label text, which is the
  // one place a selected domain did not read as a DomainTag. Render the shared
  // chip so every surface shows the same thing.
  const renderSelectedItem = useCallback(
    (node: TreeSelectNode<EntityReference>) => {
      const domain = node.data;
      // The chip stops propagation on its own click, so the trigger's disabled
      // state never reaches it — it has to be locked explicitly, or a user
      // without edit permission could clear the domain from the chip.
      const isLocked = disabled || !hasPermission;

      return (
        <DomainTag
          data-testid={`domain-tag-${node.value}`}
          disabled={isLocked}
          href={
            isClearable || !node.value ? undefined : getDomainPath(node.value)
          }
          inherited={domain?.inherited}
          label={domain ? getEntityName(domain) : node.label}
          size="sm"
          onDelete={
            isClearable && !isLocked
              ? () => {
                  // Drop only the chip that was clicked — the built-in chip used
                  // `removeSelection(node.id)` — and route it through
                  // handleChange so the no-op and in-flight guards still apply.
                  const remaining = value.filter((item) => item.id !== node.id);
                  void handleChange(multiple ? remaining : null);
                }
              : undefined
          }
        />
      );
    },
    [isClearable, multiple, disabled, hasPermission, value, handleChange]
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
      defaultExpandedKeys={defaultExpandedKeys}
      disabled={disabled || !hasPermission}
      fetchData={fetchData}
      filterNode={skipClientFilter}
      fullWidthTrigger={fullWidthTrigger}
      isOpen={isOpen}
      label={label}
      maxIndentLevel={showAllDomains ? 3 : undefined}
      multiple={multiple}
      offset={dropdownOffset}
      // One page per branch; the rest arrives behind "Show N more".
      pageSize={PAGE_SIZE_LARGE}
      placeholder={
        placeholder ??
        t('label.select-field', { field: t('label.domain-plural') })
      }
      placement={placement}
      renderSelectedItem={renderSelectedItem}
      renderTrigger={renderTrigger}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.domain-plural'),
      })}
      triggerClassName={triggerClassName}
      triggerIcon={DomainIcon}
      triggerVariant={triggerVariant}
      value={value}
      onChange={handleChange}
      onFetchError={handleFetchError}
      onOpenChange={onOpenChange}
    />
  );
};

export default DomainSelect;
