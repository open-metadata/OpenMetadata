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
  ButtonUtility,
  Card,
  Checkbox,
  Input,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search, XClose } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import { addAssetsToGlossaryTerm } from '../../rest/glossaryAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityReferenceFromEntity } from '../../utils/EntityReferenceUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import Fqn from '../../utils/Fqn';
import { getQueryFilterToExcludeTerm } from '../../utils/GlossaryPureUtils';
import { showErrorToast } from '../../utils/ToastUtils';

type AssetScope = 'all' | 'tables' | 'columns';

const SCOPE_INDEXES: Record<
  AssetScope,
  Array<SearchIndex.TABLE | SearchIndex.COLUMN>
> = {
  all: [SearchIndex.TABLE, SearchIndex.COLUMN],
  columns: [SearchIndex.COLUMN],
  tables: [SearchIndex.TABLE],
};
const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 250;

interface OntologyDataAssetPickerProps {
  readonly term: GlossaryTerm;
  readonly onCancel: () => void;
  /** Every selected asset was added. */
  readonly onSave: () => void;
  /** Some assets were added and others were not; the picker stays open. */
  readonly onPartialSave: () => void;
}

const SearchIcon = ({ className }: { className?: string }) => (
  <Search aria-hidden className={className} />
);

// The containers above the asset, e.g. "service / database / schema".
const getAssetPath = (asset: EntityReference): string =>
  asset.fullyQualifiedName
    ? Fqn.split(asset.fullyQualifiedName).slice(0, -1).join(' / ')
    : '';

/** Tables and columns to tag with the concept, picked from one inline search. */
const OntologyDataAssetPicker = ({
  term,
  onCancel,
  onSave,
  onPartialSave,
}: OntologyDataAssetPickerProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<AssetScope>('all');
  const [results, setResults] = useState<EntityReference[]>([]);
  // `attempt` re-runs a request for the same page after it failed.
  const [request, setRequest] = useState({ attempt: 0, page: 1 });
  const [loadedPage, setLoadedPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  // Why the server refused an asset, keyed by asset id.
  const [failures, setFailures] = useState<Map<string, string>>(
    () => new Map()
  );
  const [selected, setSelected] = useState<Map<string, EntityReference>>(
    () => new Map()
  );
  const [isSaving, setIsSaving] = useState(false);
  const termFqn = term.fullyQualifiedName ?? term.name;

  useEffect(() => {
    setRequest({ attempt: 0, page: 1 });
    setLoadedPage(0);
  }, [query, scope, termFqn]);

  useEffect(() => {
    const { page } = request;
    let isCurrent = true;
    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchQuery({
          pageNumber: page,
          pageSize: PAGE_SIZE,
          query: query.trim() ? `*${query.trim()}*` : '',
          queryFilter: getQueryFilterToExcludeTerm(termFqn),
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
          setResults((current) => (page === 1 ? hits : [...current, ...hits]));
          setLoadedPage(page);
          setTotal(response.hits.total.value ?? 0);
        }
      } catch (error) {
        if (isCurrent) {
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
  }, [request, query, scope, termFqn]);

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

  const isAllSelected =
    results.length > 0 && results.every((asset) => selected.has(asset.id));

  const toggleAll = (isSelected: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      results.forEach((asset) =>
        isSelected ? next.set(asset.id, asset) : next.delete(asset.id)
      );

      return next;
    });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Full references: a column is resolved through its FQN.
      const result = await addAssetsToGlossaryTerm(term, [
        ...selected.values(),
      ]);
      const failed = new Map(
        (result.failedRequest ?? []).map(({ message, request }) => [
          (request as EntityReference | undefined)?.id ?? '',
          message ?? '',
        ])
      );
      if (failed.size === 0) {
        onSave();

        return;
      }
      setFailures(failed);
      setSelected(
        (current) => new Map([...current].filter(([id]) => failed.has(id)))
      );
      if (failed.size < selected.size) {
        onPartialSave();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      className="tw:flex tw:flex-col tw:gap-3 tw:p-4"
      data-testid="ontology-data-asset-picker">
      <Box align="center" justify="between">
        <Typography as="span" size="text-sm" weight="semibold">
          {t('label.add-entity', { entity: t('label.data-asset-plural') })}
        </Typography>
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-data-asset-picker-close"
          icon={XClose}
          size="xs"
          tooltip={t('label.close')}
          onClick={onCancel}
        />
      </Box>
      <Input
        aria-label={t('message.search-tables-and-columns')}
        data-testid="ontology-data-asset-search"
        icon={SearchIcon}
        placeholder={t('message.search-tables-and-columns')}
        value={query}
        onChange={setQuery}
      />
      <Card className="tw:flex tw:flex-col tw:overflow-hidden tw:p-0">
        <Box className="tw:border-b tw:border-secondary tw:p-3">
          <Tabs
            selectedKey={scope}
            onSelectionChange={(key) => setScope(key as AssetScope)}>
            <Tabs.List size="sm" type="button-border">
              <Tabs.Item id="all" label={t('label.all')} />
              <Tabs.Item id="tables" label={t('label.table-plural')} />
              <Tabs.Item id="columns" label={t('label.column-plural')} />
            </Tabs.List>
            <Tabs.Panel className="tw:hidden" id="all" />
            <Tabs.Panel className="tw:hidden" id="tables" />
            <Tabs.Panel className="tw:hidden" id="columns" />
          </Tabs>
        </Box>
        <Box className="tw:border-b tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2.5">
          <Checkbox
            data-testid="ontology-data-asset-select-all"
            isDisabled={results.length === 0}
            isSelected={isAllSelected}
            label={t('label.select-all')}
            onChange={toggleAll}
          />
        </Box>
        <ul className="tw:m-0 tw:flex tw:max-h-80 tw:list-none tw:flex-col tw:divide-y tw:divide-secondary tw:overflow-y-auto tw:p-0">
          {results.map((asset) => (
            <li className="tw:px-3 tw:py-2.5" key={asset.id}>
              <Checkbox
                aria-label={asset.displayName ?? asset.name}
                data-testid={`ontology-data-asset-option-${asset.id}`}
                isSelected={selected.has(asset.id)}
                label={
                  <span className="tw:flex tw:min-w-0 tw:flex-col">
                    <Typography
                      ellipsis
                      as="span"
                      className="tw:text-tertiary"
                      size="text-xs">
                      {getAssetPath(asset)}
                    </Typography>
                    <span className="tw:flex tw:min-w-0 tw:items-baseline tw:gap-2">
                      <Typography
                        ellipsis
                        as="span"
                        size="text-sm"
                        weight="medium">
                        {asset.displayName ?? asset.name}
                      </Typography>
                      <Typography
                        as="span"
                        className="tw:shrink-0 tw:text-tertiary"
                        size="text-xs">
                        {entityUtilClassBase.getFormattedEntityType(asset.type)}
                      </Typography>
                    </span>
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
            </li>
          ))}
        </ul>
        {results.length < total ? (
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
              {t('label.load-more')}
            </Button>
          </Box>
        ) : null}
      </Card>
      <Box gap={2} justify="end">
        <Button color="secondary" size="sm" onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="ontology-data-asset-save"
          isDisabled={selected.size === 0 || isSaving}
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
