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
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetType } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { Include } from '../../../../generated/type/include';
import { useDebouncedValue } from '../../../../hooks/common/useDebouncedValue';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { searchTableColumnsById } from '../../../../rest/tableAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getOntologyBindingWriteMessage,
  getOntologyColumnOptions,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

interface OntologyColumnBindingEditorProps {
  conceptId: string;
  propertyId: string;
  onClose: () => void;
}

const OntologyColumnBindingEditor = ({
  conceptId,
  propertyId,
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
  const query = useDebouncedValue(search, 250);
  const [page, setPage] = useState(0);
  const [columnId, setColumnId] = useState('');
  const table = tables.find((asset) => asset.assetId === tableId);
  const columns = useQuery({
    queryKey: ['ontology-binding-columns', tableId, query, page],
    enabled: Boolean(table),
    retry: false,
    gcTime: 30_000,
    queryFn: () =>
      searchTableColumnsById(tableId, {
        q: query,
        limit: 25,
        offset: page * 25,
        include: Include.NonDeleted,
      }),
  });
  const options = useMemo(
    () =>
      table?.asset.fullyQualifiedName
        ? getOntologyColumnOptions(
            columns.data?.data ?? [],
            table.asset.fullyQualifiedName
          )
        : [],
    [columns.data, table?.asset.fullyQualifiedName]
  );
  const selected = options.find((option) => option.id === columnId);
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

  const renderColumns = () => (
    <>
      {columns.isError ? (
        <Alert variant="error">
          {t('message.temporary-error-try-reloading')}
          <Button
            color="link-color"
            size="xs"
            onPress={() => void columns.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      ) : (
        <Select
          isDisabled={columns.isPending || columns.isFetching}
          items={options}
          label={t('label.column')}
          size="sm"
          value={columnId}
          onChange={(id) => setColumnId(String(id))}>
          {(item) => (
            <Select.Item
              id={item.id}
              key={item.id}
              label={item.label}
              supportingText={
                options.find((option) => option.id === item.id)?.datatype
              }
            />
          )}
        </Select>
      )}
      {columns.data && columns.data.paging.total > 25 ? (
        <Box gap={2}>
          <Button
            color="secondary"
            isDisabled={page === 0 || columns.isFetching}
            size="xs"
            onPress={() => {
              setPage((value) => value - 1);
              setColumnId('');
            }}>
            {t('label.previous')}
          </Button>
          <Button
            color="secondary"
            isDisabled={
              (page + 1) * 25 >= columns.data.paging.total || columns.isFetching
            }
            size="xs"
            onPress={() => {
              setPage((value) => value + 1);
              setColumnId('');
            }}>
            {t('label.next')}
          </Button>
        </Box>
      ) : null}
    </>
  );

  return (
    <Box data-testid="ontology-column-binding-editor" direction="col" gap={3}>
      {tables.length === 0 ? (
        <Typography size="text-xs">
          {t('message.ontology-link-table-before-binding')}
        </Typography>
      ) : (
        <>
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
              setPage(0);
              setColumnId('');
            }}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <Input
            aria-label={t('label.search-entity', {
              entity: t('label.column-plural'),
            })}
            icon={Search}
            inputDataTestId="ontology-binding-column-search"
            size="sm"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(0);
              setColumnId('');
            }}
          />
          {renderColumns()}
          <Button
            data-testid="ontology-binding-save"
            isDisabled={
              !selected ||
              !table ||
              columns.isFetching ||
              !bindings.editableSnapshot
            }
            isLoading={bindings.isWriting}
            size="xs"
            onPress={save}>
            {t('label.save')}
          </Button>
        </>
      )}
      <Button color="secondary" size="xs" onPress={onClose}>
        {t('label.cancel')}
      </Button>
    </Box>
  );
};

export default OntologyColumnBindingEditor;
