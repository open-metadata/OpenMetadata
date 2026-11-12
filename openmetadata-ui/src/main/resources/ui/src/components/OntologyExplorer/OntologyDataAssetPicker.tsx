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
  Alert,
  Badge,
  Box,
  Button,
  ButtonUtility,
  Card,
  Checkbox,
  Dialog,
  Input,
  Select,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Activity,
  Database01,
  InfoCircle,
  Link01,
  Search,
  Table,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import { useIsAiMode } from '../../hooks/useAppMode';
import { NativeBindingBatchOutcome } from '../../interface/governance/ontology/ontologyConceptBindings.types';
import { addAssetsToGlossaryTerm } from '../../rest/glossaryAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityReferenceFromEntity } from '../../utils/EntityReferenceUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import Fqn from '../../utils/Fqn';
import { getQueryFilterToExcludeTerm } from '../../utils/GlossaryPureUtils';
import {
  getSuggestionReason,
  getSuggestionTerms,
  SuggestionReason,
} from '../../utils/governance/ontology/OntologyAssetSuggestion.utils';
import { getTierTags } from '../../utils/TablePureUtils';
import { showErrorToast } from '../../utils/ToastUtils';

type AssetScope = 'all' | 'tables' | 'columns';

// "All" is every data asset a glossary term can tag, columns included, as the
// Add Assets modal offers.
const SCOPE_INDEXES: Record<
  AssetScope,
  SearchIndex.DATA_ASSET | SearchIndex.TABLE | SearchIndex.COLUMN
> = {
  all: SearchIndex.DATA_ASSET,
  columns: SearchIndex.COLUMN,
  tables: SearchIndex.TABLE,
};
const ANY = 'any';
const PAGE_SIZE = 25;
const SUGGESTION_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 250;

type OntologyDataAssetPickerProps = {
  readonly onCancel: () => void;
  /** Every selected asset was added; a native picker names the ones it newly linked. */
  readonly onSave: (linked: EntityReference[]) => void;
} & (
  | {
      readonly term: GlossaryTerm;
      readonly native?: never;
      readonly onPartialSave: () => void;
    }
  | {
      readonly term?: never;
      readonly onPartialSave?: never;
      readonly native: {
        readonly assetTypes: string[];
        readonly linkedIds: string[];
        readonly isDisabled: boolean;
        /** Rendered as the body of a Link data dialog rather than an inline card. */
        readonly isDialog?: boolean;
        /** The concept being linked, to suggest assets by name. */
        readonly concept?: {
          readonly name: string;
          readonly synonyms?: string[];
        };
        readonly saveAssets: (
          assets: EntityReference[]
        ) => Promise<NativeBindingBatchOutcome>;
      };
    }
);

const SearchIcon = ({ className }: { className?: string }) => (
  <Search aria-hidden className={className} />
);

interface AssetHitDetails {
  service?: string;
  tier?: string;
}

type FilterOptions = ReadonlyMap<string, string>;

const TYPE_ICONS: Record<string, FC<{ className?: string }>> = {
  [EntityType.TABLE]: Table,
  [EntityType.TOPIC]: Activity,
};
const TYPE_BADGE_COLORS: Record<string, 'blue' | 'orange'> = {
  [EntityType.TABLE]: 'blue',
  [EntityType.TOPIC]: 'orange',
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

const referenceList = (value: unknown) =>
  (Array.isArray(value) ? value : []).flatMap((item) => {
    const reference = asRecord(item);

    return reference ? [reference] : [];
  });

// A search hit carries more than the reference the picker keeps: its source, tier, domains and owners.
const readHitDetails = (source: unknown): AssetHitDetails => {
  const hit = asRecord(source) ?? {};
  const tierFqn =
    asText(asRecord(hit.tier)?.tagFQN) ??
    getTierTags(Array.isArray(hit.tags) ? hit.tags : [])?.tagFQN;

  return {
    service:
      asText(hit.serviceType) ??
      asText(asRecord(hit.service)?.displayName) ??
      asText(asRecord(hit.service)?.name),
    tier: tierFqn ? Fqn.split(tierFqn).pop() : undefined,
  };
};

const readFilterOptions = (
  sources: unknown[],
  field: 'domains' | 'owners',
  idKey: 'fullyQualifiedName' | 'id'
): Array<[string, string]> =>
  sources.flatMap((source) =>
    referenceList(asRecord(source)?.[field]).flatMap(
      (reference): Array<[string, string]> => {
        const id = asText(reference[idKey]);

        return id
          ? [
              [
                id,
                asText(reference.displayName) ?? asText(reference.name) ?? id,
              ],
            ]
          : [];
      }
    )
  );

const mergeOptions = (
  current: FilterOptions,
  entries: Array<[string, string]>
): FilterOptions =>
  entries.every(([id]) => current.has(id))
    ? current
    : new Map([...current, ...entries]);

// Each filter left at "any" adds no clause.
const buildNativeQueryFilter = (
  assetTypes: string[] | undefined,
  filters: { domain: string; owner: string; service: string; type: string }
) => {
  const clauses: Array<[string, Record<string, unknown>]> = [
    [filters.service, { term: { 'service.name.keyword': filters.service } }],
    [
      filters.domain,
      { term: { 'domains.fullyQualifiedName': filters.domain } },
    ],
    // Owners are a nested field in the search index.
    [
      filters.owner,
      {
        nested: {
          path: 'owners',
          query: { term: { 'owners.id': filters.owner } },
          ignore_unmapped: true,
        },
      },
    ],
  ];

  return {
    query: {
      bool: {
        must: [
          {
            terms: {
              entityType: filters.type === ANY ? assetTypes : [filters.type],
            },
          },
          ...clauses.flatMap(([value, clause]) =>
            value === ANY ? [] : [clause]
          ),
        ],
      },
    },
  };
};

const getOptionClassName = (isDialog: boolean, isAiMode: boolean) => {
  if (isDialog) {
    return 'tw:flex tw:items-start tw:gap-3 tw:px-3.5 tw:py-3';
  }

  return isAiMode ? 'tw:px-3.5 tw:py-3' : 'tw:px-3 tw:py-2.5';
};

// The containers above the asset, e.g. "service / database / schema".
const getAssetPath = (asset: EntityReference): string =>
  asset.fullyQualifiedName
    ? Fqn.split(asset.fullyQualifiedName).slice(0, -1).join(' / ')
    : '';

/** Tables and columns to tag with the concept, picked from one inline search. */
const OntologyDataAssetPicker = ({
  term,
  native,
  onCancel,
  onSave,
  onPartialSave,
}: OntologyDataAssetPickerProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<AssetScope>('all');
  const [results, setResults] = useState<EntityReference[]>([]);
  // `attempt` re-runs a request for the same page after it failed.
  const [request, setRequest] = useState({ attempt: 0, page: 1 });
  const [loadedPage, setLoadedPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [total, setTotal] = useState(0);
  // Why the server refused an asset, keyed by asset id.
  const [failures, setFailures] = useState<Map<string, string>>(
    () => new Map()
  );
  const [selected, setSelected] = useState<Map<string, EntityReference>>(
    () => new Map()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [nativeResult, setNativeResult] = useState<NativeBindingBatchOutcome>();
  const [typeFilter, setTypeFilter] = useState(ANY);
  const [serviceFilter, setServiceFilter] = useState(ANY);
  const [domainFilter, setDomainFilter] = useState(ANY);
  const [ownerFilter, setOwnerFilter] = useState(ANY);
  const [domains, setDomains] = useState<FilterOptions>(() => new Map());
  const [owners, setOwners] = useState<FilterOptions>(() => new Map());
  const [details, setDetails] = useState<ReadonlyMap<string, AssetHitDetails>>(
    () => new Map()
  );
  // Services seen in any result so far, so narrowing to one keeps the others to switch to.
  const [services, setServices] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [suggestions, setSuggestions] = useState<
    { asset: EntityReference; reason: SuggestionReason }[]
  >([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);
  const termFqn = term?.fullyQualifiedName ?? term?.name;
  // Setters only, so the search effects can call it without depending on it.
  const rememberHits = (sources: unknown[]) => {
    setDetails((current) => {
      const next = new Map(current);
      sources.forEach((source) => {
        const id = asText(asRecord(source)?.id);
        if (id) {
          next.set(id, readHitDetails(source));
        }
      });

      return next;
    });
    setDomains((current) =>
      mergeOptions(
        current,
        readFilterOptions(sources, 'domains', 'fullyQualifiedName')
      )
    );
    setOwners((current) =>
      mergeOptions(current, readFilterOptions(sources, 'owners', 'id'))
    );
  };
  const nativeAssetTypes = native?.assetTypes;

  // A new search drops the old rows at once, so nothing on screen belongs to it.
  useEffect(() => {
    setRequest({ attempt: 0, page: 1 });
    setLoadedPage(0);
    setResults([]);
    setTotal(0);
  }, [
    query,
    scope,
    termFqn,
    typeFilter,
    serviceFilter,
    domainFilter,
    ownerFilter,
  ]);

  useEffect(() => {
    const { page } = request;
    let isCurrent = true;
    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchQuery({
          pageNumber: page,
          pageSize: PAGE_SIZE,
          includeDeleted: false,
          query: query.trim() ? `*${query.trim()}*` : '',
          queryFilter: termFqn
            ? getQueryFilterToExcludeTerm(termFqn)
            : buildNativeQueryFilter(nativeAssetTypes, {
                domain: domainFilter,
                owner: ownerFilter,
                service: serviceFilter,
                type: typeFilter,
              }),
          searchIndex: SCOPE_INDEXES[scope],
        });
        if (isCurrent) {
          // The same reference the Add Assets modal builds from a search hit.
          const hits = response.hits.hits.map(({ _source }) =>
            getEntityReferenceFromEntity(
              _source as Omit<EntityReference, 'type'>,
              _source.entityType as EntityType
            )
          );
          const serviceNames = response.hits.hits.flatMap(({ _source }) =>
            typeof _source.service?.name === 'string'
              ? [_source.service.name]
              : []
          );
          if (serviceNames.length > 0) {
            setServices((current) => new Set([...current, ...serviceNames]));
          }
          rememberHits(response.hits.hits.map(({ _source }) => _source));
          setResults((current) => (page === 1 ? hits : [...current, ...hits]));
          setLoadedPage(page);
          setHasFailed(false);
          setTotal(response.hits.total.value ?? 0);
        }
      } catch (error) {
        if (isCurrent) {
          setHasFailed(true);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [
    request,
    query,
    scope,
    termFqn,
    nativeAssetTypes,
    typeFilter,
    serviceFilter,
    domainFilter,
    ownerFilter,
  ]);

  const conceptName = native?.concept?.name;
  const isDialog = Boolean(native?.isDialog);
  const conceptSynonyms = native?.concept?.synonyms;
  const isFiltered =
    Boolean(query.trim()) ||
    [typeFilter, serviceFilter, domainFilter, ownerFilter].some(
      (filter) => filter !== ANY
    );

  useEffect(() => {
    const terms = conceptName
      ? getSuggestionTerms(conceptName, conceptSynonyms)
      : [];
    if (terms.length === 0 || isFiltered || scope === 'columns') {
      setSuggestions([]);

      return;
    }
    let isCurrent = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchQuery({
          pageNumber: 1,
          pageSize: SUGGESTION_PAGE_SIZE,
          includeDeleted: false,
          query: terms.map(({ text }) => `*${text}*`).join(' OR '),
          queryFilter: {
            query: {
              bool: { must: [{ terms: { entityType: nativeAssetTypes } }] },
            },
          },
          searchIndex: SCOPE_INDEXES[scope],
        });
        if (isCurrent) {
          // A suggested asset's service must be filterable even when the first page of the plain list omits it.
          const serviceNames = response.hits.hits.flatMap(({ _source }) =>
            typeof _source.service?.name === 'string'
              ? [_source.service.name]
              : []
          );
          if (serviceNames.length > 0) {
            setServices((current) => new Set([...current, ...serviceNames]));
          }
          rememberHits(response.hits.hits.map(({ _source }) => _source));
          setSuggestions(
            response.hits.hits.flatMap(({ _source }) => {
              const reason = getSuggestionReason(_source, terms);

              return reason
                ? [
                    {
                      asset: getEntityReferenceFromEntity(
                        _source as Omit<EntityReference, 'type'>,
                        _source.entityType as EntityType
                      ),
                      reason,
                    },
                  ]
                : [];
            })
          );
        }
      } catch {
        // Suggestions are a shortcut; the plain list below still works.
        if (isCurrent) {
          setSuggestions([]);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [conceptName, conceptSynonyms, isFiltered, nativeAssetTypes, scope]);

  // The next page follows the last one that loaded, so a failed page is asked
  // for again rather than skipped.
  const loadMore = () =>
    setRequest(({ attempt }) => ({
      attempt: attempt + 1,
      page: loadedPage + 1,
    }));

  const toggle = (asset: EntityReference, isSelected: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      if (isSelected) {
        next.set(asset.id, asset);
      } else {
        next.delete(asset.id);
      }

      return next;
    });

  const suggestedIds = new Set(suggestions.map(({ asset }) => asset.id));
  const listed = results.filter((asset) => !suggestedIds.has(asset.id));
  const selectable = [
    ...suggestions.map(({ asset }) => asset),
    ...listed,
  ].filter((asset) => !native?.linkedIds.includes(asset.id));
  const isAllSelected =
    selectable.length > 0 &&
    selectable.every((asset) => selected.has(asset.id));

  const toggleAll = (isSelected: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      selectable.forEach((asset) =>
        isSelected ? next.set(asset.id, asset) : next.delete(asset.id)
      );

      return next;
    });

  const saveNativeAssets = async (
    config: NonNullable<OntologyDataAssetPickerProps['native']>
  ) => {
    const toLink = [...selected.values()].filter(
      (asset) => !config.linkedIds.includes(asset.id)
    );
    const result = await config.saveAssets(toLink);
    if (!mounted.current) {
      return;
    }
    setNativeResult(result);
    setSelected(new Map(result.remaining.map((asset) => [asset.id, asset])));
    if (result.stop === 'none') {
      onSave(toLink);
    }
  };

  const saveGlossaryAssets = async (
    termToSave: GlossaryTerm,
    notifyPartialSave: () => void
  ) => {
    const result = await addAssetsToGlossaryTerm(termToSave, [
      ...selected.values(),
    ]);
    const refused = result.failedRequest ?? [];
    if (refused.length === 0) {
      onSave([]);

      return;
    }
    const failed = new Map(
      refused.flatMap(({ message, request }) => {
        const id = (request as EntityReference | undefined)?.id;

        return id ? [[id, message ?? ''] as const] : [];
      })
    );
    setFailures(failed);
    if (failed.size === refused.length) {
      setSelected(
        (current) => new Map([...current].filter(([id]) => failed.has(id)))
      );
    }
    const visibleIds = new Set(results.map(({ id }) => id));
    const hidden = refused.find(
      ({ request }) =>
        !visibleIds.has((request as EntityReference | undefined)?.id ?? '')
    );
    if (hidden) {
      showErrorToast(hidden.message ?? t('server.unexpected-error'));
    }
    if (refused.length < selected.size) {
      notifyPartialSave();
    }
  };

  const handleSave = async () => {
    if (isSaving || native?.isDisabled) {
      return;
    }
    setIsSaving(true);
    try {
      if (native) {
        await saveNativeAssets(native);
      } else {
        await saveGlossaryAssets(term, onPartialSave);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      if (mounted.current) {
        setIsSaving(false);
      }
    }
  };

  const renderDialogLabel = (asset: EntityReference) => {
    const TypeIcon = TYPE_ICONS[asset.type] ?? Database01;
    const { service } = details.get(asset.id) ?? {};

    return (
      <span className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3">
        <span className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:bg-utility-blue-50 tw:text-utility-blue-600">
          <TypeIcon aria-hidden="true" className="tw:size-4" />
        </span>
        <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          <span className="tw:flex tw:min-w-0 tw:items-baseline tw:gap-2">
            <Typography ellipsis as="span" size="text-sm" weight="semibold">
              {asset.displayName ?? asset.name}
            </Typography>
            {service ? (
              <Typography
                as="span"
                className="tw:shrink-0 tw:text-tertiary"
                size="text-xs">
                {service}
              </Typography>
            ) : null}
          </span>
          <Typography
            ellipsis
            as="span"
            className="tw:text-tertiary"
            size="text-xs">
            {getAssetPath(asset).split(' / ').join(' › ')}
          </Typography>
        </span>
      </span>
    );
  };

  // Outside the checkbox label, which does not stretch, so they line up on the right.
  const renderDialogMeta = (asset: EntityReference) => {
    const { tier } = details.get(asset.id) ?? {};

    return (
      <Box align="center" className="tw:ml-auto tw:shrink-0" gap={3}>
        <Badge
          color={TYPE_BADGE_COLORS[asset.type] ?? 'gray'}
          size="sm"
          type="pill-color">
          {entityUtilClassBase.getFormattedEntityType(asset.type)}
        </Badge>
        <Typography
          className="tw:w-14 tw:text-right"
          color="secondary"
          data-testid={`ontology-data-asset-tier-${asset.id}`}
          size="text-xs">
          {tier}
        </Typography>
      </Box>
    );
  };

  const renderInlineLabel = (asset: EntityReference) => (
    <>
      <Typography
        ellipsis
        as="span"
        className="tw:text-tertiary"
        size="text-xs">
        {getAssetPath(asset)}
      </Typography>
      <span className="tw:flex tw:min-w-0 tw:items-baseline tw:gap-2">
        <Typography ellipsis as="span" size="text-sm" weight="medium">
          {asset.displayName ?? asset.name}
        </Typography>
        <Typography
          as="span"
          className="tw:shrink-0 tw:text-tertiary"
          size="text-xs">
          {entityUtilClassBase.getFormattedEntityType(asset.type)}
        </Typography>
      </span>
    </>
  );

  const optionClassName = getOptionClassName(isDialog, isAiMode);

  const renderOption = (asset: EntityReference, reason?: SuggestionReason) => {
    const isLinked = Boolean(native?.linkedIds.includes(asset.id));

    return (
      <li className={optionClassName} key={asset.id}>
        <Checkbox
          aria-label={asset.displayName ?? asset.name}
          data-testid={`ontology-data-asset-option-${asset.id}`}
          isDisabled={isLinked}
          isSelected={selected.has(asset.id)}
          label={
            <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
              {isDialog ? renderDialogLabel(asset) : renderInlineLabel(asset)}
              {isLinked ? (
                <Typography
                  as="span"
                  className="tw:text-tertiary"
                  data-testid={`ontology-data-asset-linked-${asset.id}`}
                  size="text-xs">
                  {t('message.ontology-asset-already-linked', {
                    concept: native?.concept?.name,
                  })}
                </Typography>
              ) : null}
              {reason ? (
                <Typography
                  as="span"
                  className="tw:text-brand-secondary"
                  data-testid={`ontology-data-asset-reason-${asset.id}`}
                  size="text-xs">
                  {t(`message.ontology-suggest-${reason.kind}`, {
                    column:
                      reason.kind === 'column' ? reason.column : undefined,
                    term: reason.term,
                  })}
                </Typography>
              ) : null}
              {failures.has(asset.id) ? (
                <Typography
                  as="span"
                  className="tw:text-error-primary"
                  data-testid={`ontology-data-asset-error-${asset.id}`}
                  size="text-xs">
                  {failures.get(asset.id)}
                </Typography>
              ) : null}
            </span>
          }
          onChange={(isSelected) => toggle(asset, isSelected)}
        />
        {isDialog ? renderDialogMeta(asset) : null}
      </li>
    );
  };

  const renderListFooter = () => {
    if (hasFailed || results.length < total) {
      return (
        <Box
          className="tw:border-t tw:border-secondary tw:p-2"
          justify="center">
          <Button
            color="link-gray"
            data-testid="ontology-data-asset-load-more"
            isDisabled={isLoading}
            isLoading={isLoading}
            size="sm"
            onPress={loadMore}>
            {hasFailed ? t('label.retry') : t('label.load-more-lowercase')}
          </Button>
        </Box>
      );
    }

    return isLoading || results.length > 0 ? null : (
      <Typography
        as="p"
        className="tw:px-3 tw:py-6 tw:text-center tw:text-tertiary"
        data-testid="ontology-data-asset-empty"
        size="text-sm">
        {t('label.no-data-found')}
      </Typography>
    );
  };

  const renderSelectedCount = () =>
    selected.size > 0 ? (
      <Typography
        as="span"
        className="tw:mr-auto tw:text-tertiary"
        data-testid="ontology-data-asset-selected-count"
        size="text-xs">
        {t('label.n-selected-lowercase', { count: selected.size })}
      </Typography>
    ) : null;

  const renderBatchStatus = () =>
    nativeResult && nativeResult.stop !== 'none' ? (
      <Alert data-testid="ontology-native-batch-status" variant="warning">
        {t('message.ontology-binding-batch-stopped', {
          completed: nativeResult.completedIds.length,
          remaining: nativeResult.remaining.length,
        })}{' '}
        {t(`message.ontology-binding-${nativeResult.stop}`)}
      </Alert>
    ) : null;

  const renderList = () => (
    <ul
      className={classNames(
        'tw:m-0 tw:flex tw:list-none tw:flex-col tw:divide-y tw:divide-secondary tw:p-0',
        // In the dialog the content pane scrolls, so its footer divider marks the overflow.
        !isDialog && 'tw:max-h-80 tw:overflow-y-auto'
      )}>
      {suggestions.length > 0 ? (
        <li
          className="tw:bg-secondary tw:px-3 tw:py-1.5"
          data-testid="ontology-data-asset-suggested-heading">
          <Typography
            as="span"
            color="secondary"
            size="text-xs"
            weight="semibold">
            {t('label.suggested')}
          </Typography>
        </li>
      ) : null}
      {suggestions.map(({ asset, reason }) => renderOption(asset, reason))}
      {suggestions.length > 0 && listed.length > 0 ? (
        <li className="tw:bg-secondary tw:px-3 tw:py-1.5">
          <Typography
            as="span"
            color="secondary"
            size="text-xs"
            weight="semibold">
            {t('label.all-other-assets')}
          </Typography>
        </li>
      ) : null}
      {listed.map((asset) => renderOption(asset))}
    </ul>
  );

  const searchLabel = native
    ? t('label.search-entity', {
        entity: t('label.data-asset-lowercase-plural'),
      })
    : t('message.search-tables-and-columns');
  const renderSearch = () => (
    <Input
      aria-label={searchLabel}
      autoComplete="off"
      data-testid="ontology-data-asset-search"
      icon={SearchIcon}
      placeholder={
        isDialog ? t('message.ontology-link-data-search') : searchLabel
      }
      value={query}
      onChange={setQuery}
    />
  );

  const renderOptionFilter = (
    key: 'service' | 'type' | 'domain' | 'owner',
    options: FilterOptions,
    value: string,
    onChange: (value: string) => void
  ) => (
    <Select
      aria-label={t(`label.${key}`)}
      data-testid={`ontology-data-asset-${key}-filter`}
      items={[
        {
          id: ANY,
          label: t('label.any-entity', { entity: t(`label.${key}-lowercase`) }),
        },
        ...[...options]
          .map(([id, name]) => ({ id, label: name }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      ]}
      size="sm"
      value={value}
      onChange={(id) => onChange(String(id))}>
      {(item) => <Select.Item id={item.id} key={item.id} label={item.label} />}
    </Select>
  );

  const renderFilters = () =>
    native ? (
      <Box align="center" gap={2} wrap="wrap">
        {renderOptionFilter(
          'service',
          new Map([...services].map((name) => [name, name])),
          serviceFilter,
          setServiceFilter
        )}
        {renderOptionFilter(
          'type',
          new Map(
            native.assetTypes.map((type) => [
              type,
              entityUtilClassBase.getFormattedEntityType(type),
            ])
          ),
          typeFilter,
          setTypeFilter
        )}
        {isDialog ? (
          <>
            {renderOptionFilter(
              'domain',
              domains,
              domainFilter,
              setDomainFilter
            )}
            {renderOptionFilter('owner', owners, ownerFilter, setOwnerFilter)}
            <Typography
              className="tw:ml-auto tw:shrink-0"
              color="secondary"
              data-testid="ontology-data-asset-total"
              size="text-sm">
              {t('label.count-asset-in-catalog', { count: total })}
            </Typography>
          </>
        ) : null}
      </Box>
    ) : null;

  const isSaveDisabled = [
    selected.size === 0,
    isSaving,
    Boolean(native?.isDisabled),
  ].some(Boolean);

  const renderSelectAll = () => (
    <Checkbox
      data-testid="ontology-data-asset-select-all"
      isDisabled={selectable.length === 0}
      isSelected={isAllSelected}
      label={t('label.select-all-lowercase')}
      onChange={toggleAll}
    />
  );

  if (isDialog) {
    return (
      <div className="tw:contents" data-testid="ontology-data-asset-picker">
        <Dialog.Header className="tw:flex tw:flex-col tw:gap-4">
          <Box align="center" className="tw:pr-10" gap={3}>
            <span className="tw:flex tw:size-11 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-utility-blue-50 tw:text-utility-blue-600">
              <Link01 aria-hidden="true" className="tw:size-5" />
            </span>
            <Box direction="col">
              <Typography
                as="h2"
                className="not-prose tw:m-0"
                size="text-lg"
                weight="semibold">
                {t('label.link-data-to-entity', { entity: conceptName })}
              </Typography>
              <Typography color="secondary" size="text-sm">
                {t('message.ontology-link-data-subtitle')}
              </Typography>
            </Box>
          </Box>
          <ButtonUtility
            className="tw:absolute tw:top-4 tw:right-4"
            data-testid="ontology-data-asset-picker-close"
            icon={XClose}
            size="sm"
            tooltip={t('label.close')}
            onClick={onCancel}
          />
          {renderSearch()}
          {renderFilters()}
        </Dialog.Header>
        <Dialog.Content>
          <Box align="center" justify="between">
            <Typography size="text-sm" weight="semibold">
              {t('label.asset-plural')}
            </Typography>
            {renderSelectAll()}
          </Box>
          <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary">
            {renderList()}
            {renderListFooter()}
          </div>
          {renderBatchStatus()}
        </Dialog.Content>
        <Dialog.Footer>
          <Box align="center" className="tw:mr-auto" gap={2}>
            <InfoCircle
              aria-hidden="true"
              className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
            />
            <Typography color="secondary" size="text-sm">
              {t('message.ontology-link-applies-now')}
            </Typography>
          </Box>
          {renderSelectedCount()}
          <Button color="secondary" size="md" onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="ontology-data-asset-save"
            isDisabled={isSaveDisabled}
            isLoading={isSaving}
            size="md"
            onPress={() => void handleSave()}>
            {t('label.select-asset-plural')}
          </Button>
        </Dialog.Footer>
      </div>
    );
  }

  return (
    <Card
      className="tw:flex tw:flex-col tw:gap-3 tw:p-4"
      data-testid="ontology-data-asset-picker">
      <Box align="center" justify="between">
        <Typography as="span" size="text-sm" weight="semibold">
          {t('label.add-entity', {
            entity: t('label.data-asset-lowercase-plural'),
          })}
        </Typography>
        <ButtonUtility
          data-testid="ontology-data-asset-picker-close"
          icon={XClose}
          size="xs"
          tooltip={t('label.close')}
          onClick={onCancel}
        />
      </Box>
      {renderSearch()}
      {renderFilters()}
      <Card className="tw:flex tw:flex-col tw:overflow-hidden tw:p-0">
        <Box className="tw:border-b tw:border-secondary tw:p-3">
          <Tabs
            selectedKey={scope}
            onSelectionChange={(key) => setScope(key as AssetScope)}>
            <Tabs.List size="sm" type="button-minimal">
              <Tabs.Item id="all" label={t('label.all')} />
              <Tabs.Item id="tables" label={t('label.table-plural')} />
              {!native ? (
                <Tabs.Item id="columns" label={t('label.column-plural')} />
              ) : null}
            </Tabs.List>
            <Tabs.Panel className="tw:hidden" id="all" />
            <Tabs.Panel className="tw:hidden" id="tables" />
            <Tabs.Panel className="tw:hidden" id="columns" />
          </Tabs>
        </Box>
        <Box
          className={classNames(
            'tw:border-b tw:border-secondary',
            isAiMode
              ? 'tw:bg-secondary_alt tw:px-3.5 tw:py-3'
              : 'tw:bg-secondary tw:px-3 tw:py-2.5'
          )}>
          {renderSelectAll()}
        </Box>
        {renderList()}
        {renderListFooter()}
      </Card>
      {renderBatchStatus()}
      <Box align="center" gap={2} justify="end">
        {renderSelectedCount()}
        <Button color="secondary" size="sm" onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="ontology-data-asset-save"
          isDisabled={isSaveDisabled}
          isLoading={isSaving}
          size="sm"
          onPress={() => void handleSave()}>
          {t('label.save')}
        </Button>
      </Box>
    </Card>
  );
};

export default OntologyDataAssetPicker;
