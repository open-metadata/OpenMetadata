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
  Box,
  Button,
  MultiSelect,
  Select,
  Typography,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Collection,
  ListBoxLoadMoreItem,
  useListData,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { AssetType } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { Include } from '../../../../generated/type/include';
import { useDebouncedValue } from '../../../../hooks/common/useDebouncedValue';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { searchTableColumnsById } from '../../../../rest/tableAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { suggestColumnForProperty } from '../../../../utils/governance/ontology/OntologyBindingSuggestion.utils';
import {
  getOntologyBindingWriteMessage,
  getOntologyColumnOptions,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { ONTOLOGY_COLUMN_PAGE_SIZE } from './OntologyConceptInspector.constants';
import { ConceptFormCard } from './OntologyConceptSection';

// Same id and label getOntologyColumnOptions builds, so a bound column matches its option.
const columnItem = (path: string[]): SelectItemType => ({
  id: JSON.stringify(path),
  label: path.join(' › '),
});

interface OntologyColumnBindingEditorProps {
  conceptId: string;
  propertyId: string;
  propertyLabel?: string;
  isIdentifier?: boolean;
  onClose: () => void;
}

const OntologyColumnBindingEditor = ({
  conceptId,
  propertyId,
  propertyLabel,
  isIdentifier,
  onClose,
}: OntologyColumnBindingEditorProps) => {
  const { t } = useTranslation();
  const bindings = useOntologyConceptBindings(conceptId);
  const tables =
    bindings.data?.assets.filter(
      (asset) => asset.assetType === AssetType.Table
    ) ?? [];
  const [tableId, setTableId] = useState(tables[0]?.assetId ?? '');
  const boundOn = (assetId: string) =>
    (tables.find((asset) => asset.assetId === assetId)?.columns ?? [])
      .filter((column) => column.propertyId === propertyId)
      .map((column) => columnItem(column.columnPath));
  const lifecycle = useRef<AbortController>();
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;

    return () => controller.abort();
  }, [conceptId, propertyId]);
  const [search, setSearch] = useState('');
  const selected = useListData<SelectItemType>({
    initialItems: boundOn(tableId),
  });
  // The suggestion fills an empty picker once; after any edit the person's choice stands.
  const isTouched = useRef(false);
  const query = useDebouncedValue(search, 250);
  const table = tables.find((asset) => asset.assetId === tableId);
  const columns = useInfiniteQuery({
    queryKey: ['ontology-binding-columns', tableId, query],
    enabled: Boolean(table),
    retry: false,
    gcTime: 30_000,
    initialPageParam: 0,
    // Keeps the list, and the input enabled, while the next search loads.
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      searchTableColumnsById(tableId, {
        q: query,
        limit: ONTOLOGY_COLUMN_PAGE_SIZE,
        offset: pageParam,
        include: Include.NonDeleted,
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.length * ONTOLOGY_COLUMN_PAGE_SIZE;

      return loaded < last.paging.total ? loaded : undefined;
    },
  });
  const options = useMemo(
    () =>
      table?.asset.fullyQualifiedName
        ? getOntologyColumnOptions(
            columns.data?.pages.flatMap((page) => page.data) ?? [],
            table.asset.fullyQualifiedName
          )
        : [],
    [columns.data, table?.asset.fullyQualifiedName]
  );
  const suggested = useMemo(
    () =>
      propertyLabel
        ? suggestColumnForProperty(
            { label: propertyLabel, isIdentifier },
            options
          )
        : undefined,
    [isIdentifier, options, propertyLabel]
  );
  useEffect(() => {
    if (!isTouched.current && selected.items.length === 0 && suggested) {
      isTouched.current = true;
      selected.append(columnItem(suggested.path));
    }
  }, [selected, suggested]);
  const selectedIds = new Set(selected.items.map(({ id }) => id));
  const hasChange = selected.items.length > 0 || boundOn(tableId).length > 0;
  const save = async () => {
    const signal = lifecycle.current?.signal;
    if (!signal || signal.aborted) {
      return;
    }
    const snapshot = bindings.editableSnapshot;
    const editableTable = snapshot?.assets.find(
      (asset) => asset.assetId === tableId
    );
    if (!editableTable || !snapshot) {
      return;
    }
    const result = await bindings.replaceAsset({
      expectedRevision: snapshot.revision,
      asset: {
        assetId: editableTable.assetId,
        assetType: AssetType.Table,
        // The picker holds every column this property binds on the table.
        columns: [
          ...editableTable.columns
            .filter((column) => column.propertyId !== propertyId)
            .map(({ propertyId, columnPath }) => ({
              propertyId,
              columnPath,
            })),
          ...selected.items.map(({ id }) => ({
            propertyId,
            columnPath: JSON.parse(id) as string[],
          })),
        ],
      },
    });
    if (!signal.aborted) {
      const notify =
        result.kind === 'confirmed' ? showSuccessToast : showErrorToast;
      notify(t(getOntologyBindingWriteMessage(result)));
      if (result.kind === 'confirmed') {
        onClose();
      }
    }
  };

  const renderColumns = () =>
    columns.isError ? (
      <Alert
        rightContent={
          <Button
            color="link-color"
            size="xs"
            onPress={() => void columns.refetch()}>
            {t('label.retry')}
          </Button>
        }
        variant="error">
        {t('message.temporary-error-try-reloading')}
      </Alert>
    ) : (
      <MultiSelect
        data-testid="ontology-binding-column-select"
        isDisabled={columns.isPending}
        items={options}
        key={tableId}
        label={t('label.column-plural')}
        placeholder={t('label.search-entity', {
          entity: t('label.column-plural'),
        })}
        selectedItems={selected}
        showTagAvatars={false}
        size="sm"
        onInputChange={setSearch}
        onItemCleared={() => {
          isTouched.current = true;
        }}
        onItemInserted={() => {
          isTouched.current = true;
        }}>
        <Collection items={options.filter(({ id }) => !selectedIds.has(id))}>
          {(item) => (
            <MultiSelect.Item
              id={item.id}
              label={item.label}
              supportingText={[
                item.id === suggested?.id
                  ? t('label.ontology-suggested-column')
                  : undefined,
                item.datatype,
              ]
                .filter(Boolean)
                .join(' · ')}
              textValue={item.label}
            />
          )}
        </Collection>
        <ListBoxLoadMoreItem
          isLoading={columns.isFetchingNextPage}
          onLoadMore={() => {
            if (columns.hasNextPage && !columns.isFetchingNextPage) {
              void columns.fetchNextPage();
            }
          }}
        />
      </MultiSelect>
    );

  const renderTableFields = () => (
    <Select
      items={tables.map((item) => ({
        id: item.assetId,
        label: getEntityName(item.asset),
      }))}
      label={t('label.table')}
      size="sm"
      value={tableId}
      onChange={(id) => {
        const next = String(id);
        setTableId(next);
        setSearch('');
        selected.remove(...selected.items.map((item) => item.id));
        selected.append(...boundOn(next));
        isTouched.current = false;
      }}>
      {(item) => <Select.Item id={item.id} key={item.id} label={item.label} />}
    </Select>
  );

  const renderAiEditor = () => (
    <ConceptFormCard testId="ontology-column-binding-editor">
      {tables.length === 0 ? (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.ontology-link-table-before-binding')}
        </Typography>
      ) : (
        <>
          {renderTableFields()}
          {renderColumns()}
        </>
      )}
      <Box gap={2} justify="end">
        <Button color="secondary" size="sm" onPress={onClose}>
          {t('label.cancel')}
        </Button>
        {tables.length > 0 ? (
          <Button
            color="primary"
            data-testid="ontology-binding-save"
            isDisabled={!hasChange || !table || !bindings.editableSnapshot}
            isLoading={bindings.isWriting}
            size="sm"
            onPress={save}>
            {t('label.save')}
          </Button>
        ) : null}
      </Box>
    </ConceptFormCard>
  );

  return renderAiEditor();
};

export default OntologyColumnBindingEditor;
