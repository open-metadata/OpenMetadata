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
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Collection, ListBoxLoadMoreItem } from 'react-aria-components';
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

type ColumnOption = ReturnType<typeof getOntologyColumnOptions>[number];

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
  const lifecycle = useRef<AbortController>();
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;

    return () => controller.abort();
  }, [conceptId, propertyId]);
  const [search, setSearch] = useState('');
  // Until the person chooses, the editor holds the suggested column.
  const [chosen, setChosen] = useState<ColumnOption>();
  const [activeLabel, setActiveLabel] = useState<string>();
  // Selecting fills the input with the column's label; that text is not a search.
  const query = useDebouncedValue(search === activeLabel ? '' : search, 250);
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
  const selected = chosen ?? suggested;
  useEffect(() => setActiveLabel(selected?.label), [selected?.label]);
  const save = async () => {
    const signal = lifecycle.current?.signal;
    if (!signal || signal.aborted) {
      return;
    }
    const snapshot = bindings.editableSnapshot;
    const editableTable = snapshot?.assets.find(
      (asset) => asset.assetId === tableId
    );
    if (!editableTable || !selected || !snapshot) {
      return;
    }
    const result = await bindings.replaceAsset({
      expectedRevision: snapshot.revision,
      asset: {
        assetId: editableTable.assetId,
        assetType: AssetType.Table,
        columns: [
          ...editableTable.columns
            .filter(
              (column) =>
                column.propertyId !== propertyId ||
                JSON.stringify(column.columnPath) !== selected.id
            )
            .map(({ propertyId, columnPath }) => ({
              propertyId,
              columnPath,
            })),
          { propertyId, columnPath: selected.path },
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
      <Select.ComboBox
        allowsEmptyCollection
        data-testid="ontology-binding-column-select"
        emptyState={t('label.no-data-found')}
        fontSize="sm"
        isDisabled={columns.isPending}
        items={options}
        key={tableId}
        label={t('label.column')}
        placeholder={t('label.search-entity', {
          entity: t('label.column-plural'),
        })}
        shortcut={false}
        size="sm"
        value={selected?.id ?? null}
        onChange={(id) => {
          const option = options.find((item) => item.id === id);
          if (option) {
            setChosen(option);
          }
        }}
        onInputChange={setSearch}>
        <Collection items={options}>
          {(item) => (
            <Select.Item
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
      </Select.ComboBox>
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
        setTableId(String(id));
        setSearch('');
        setChosen(undefined);
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
            isDisabled={!selected || !table || !bindings.editableSnapshot}
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
