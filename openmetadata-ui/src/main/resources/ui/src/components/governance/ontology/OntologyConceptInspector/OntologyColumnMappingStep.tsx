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
  Card,
  Checkbox,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetType } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { EntityReference } from '../../../../generated/type/entityReference';
import { Include } from '../../../../generated/type/include';
import { State } from '../../../../generated/type/ontologyConceptBindingsResponse';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { BindingSnapshot } from '../../../../interface/governance/ontology/ontologyConceptBindings.types';
import { searchTableColumnsById } from '../../../../rest/tableAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  SuggestableProperty,
  suggestPropertyForColumn,
} from '../../../../utils/governance/ontology/OntologyBindingSuggestion.utils';
import {
  getOntologyBindingWriteMessage,
  getOntologyColumnOptions,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

export type ColumnMappingProperty = SuggestableProperty;

interface OntologyColumnMappingStepProps {
  conceptId: string;
  conceptName: string;
  /** The concept's bindable properties, own and inherited. */
  properties: readonly ColumnMappingProperty[];
  /** Tables to bind columns of; each is written once. */
  assets: readonly EntityReference[];
  /** Called when the step is skipped, cancelled or saved. */
  onClose: () => void;
}

interface RowState {
  checked: boolean;
  propertyId: string;
}

const NOT_MAPPED = 'not-mapped';
const PAGE_SIZE = 100;
// A table past this many columns is bound from its own page; the step stays one screen.
const MAX_COLUMNS = 1000;

const fetchAllColumns = async (assetId: string) => {
  const columns = [];
  while (columns.length < MAX_COLUMNS) {
    const page = await searchTableColumnsById(assetId, {
      limit: PAGE_SIZE,
      offset: columns.length,
      include: Include.NonDeleted,
    });
    columns.push(...page.data);
    if (page.data.length === 0 || columns.length >= page.paging.total) {
      break;
    }
  }

  return columns;
};

const OntologyColumnMappingStep = ({
  conceptId,
  conceptName,
  properties,
  assets,
  onClose,
}: OntologyColumnMappingStepProps) => {
  const { t } = useTranslation();
  const bindings = useOntologyConceptBindings(conceptId);
  const [edits, setEdits] = useState<Record<string, RowState>>({});
  const columnQueries = useQueries({
    queries: assets.map((asset) => ({
      queryKey: ['ontology-column-mapping', asset.id],
      queryFn: () => fetchAllColumns(asset.id),
      retry: false,
      gcTime: 30_000,
    })),
  });

  const tables = useMemo(
    () =>
      assets.map((asset, index) => {
        const bound = bindings.data?.assets.find(
          (binding) => binding.assetId === asset.id
        );
        const options = asset.fullyQualifiedName
          ? getOntologyColumnOptions(
              columnQueries[index]?.data ?? [],
              asset.fullyQualifiedName
            )
          : [];

        return {
          asset,
          bound,
          options: options.map((option) => {
            const existing = bound?.columns.find(
              (column) =>
                column.state === State.Resolved &&
                JSON.stringify(column.columnPath) === option.id
            );
            const suggestion = suggestPropertyForColumn(
              option.path[option.path.length - 1],
              properties
            );

            return {
              ...option,
              existingPropertyId: existing?.propertyId,
              suggestedPropertyId: suggestion?.id,
            };
          }),
          query: columnQueries[index],
        };
      }),
    [assets, bindings.data, columnQueries, properties]
  );

  const keyOf = (assetId: string, columnId: string) =>
    JSON.stringify([assetId, columnId]);
  const stateOf = (
    assetId: string,
    option: (typeof tables)[number]['options'][number]
  ): RowState => {
    const edited = edits[keyOf(assetId, option.id)];
    if (edited) {
      return edited;
    }
    const propertyId =
      option.existingPropertyId ?? option.suggestedPropertyId ?? '';

    return { checked: Boolean(propertyId), propertyId };
  };
  const setRow = (assetId: string, columnId: string, next: RowState) =>
    setEdits((current) => ({ ...current, [keyOf(assetId, columnId)]: next }));

  const [isSaving, setIsSaving] = useState(false);
  const isLoading = columnQueries.some((query) => query.isPending);
  const canSave = !isLoading && !isSaving && Boolean(bindings.editableSnapshot);

  const save = async () => {
    let snapshot: BindingSnapshot | undefined = bindings.editableSnapshot;
    if (!snapshot) {
      return;
    }
    setIsSaving(true);
    try {
      for (const { asset, bound, options } of tables) {
        const checked = options.flatMap((option) => {
          const row = stateOf(asset.id, option);

          return row.checked && row.propertyId
            ? [{ propertyId: row.propertyId, columnPath: option.path }]
            : [];
        });
        const unlisted = (bound?.columns ?? [])
          .filter((column) => column.state === State.Unresolved)
          .map(({ propertyId, columnPath }) => ({ propertyId, columnPath }));
        if (checked.length === 0 && !bound?.columns.length) {
          continue;
        }
        const result = await bindings.replaceAsset({
          expectedRevision: snapshot.revision,
          asset: {
            assetId: asset.id,
            assetType: AssetType.Table,
            columns: [...checked, ...unlisted],
          },
        });
        if (result.kind !== 'confirmed') {
          showErrorToast(t(getOntologyBindingWriteMessage(result)));

          return;
        }
        if (result.read.kind === 'unavailable') {
          showSuccessToast(t(getOntologyBindingWriteMessage(result)));
          onClose();

          return;
        }
        snapshot = result.read.snapshot;
      }
      showSuccessToast(t('label.saved'));
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const propertyItems = [
    { id: NOT_MAPPED, label: t('label.not-mapped') },
    ...properties.map(({ id, label }) => ({ id, label })),
  ];

  const renderTable = ({ asset, options, query }: (typeof tables)[number]) => {
    const boundCount = options.filter(
      (option) => stateOf(asset.id, option).checked
    ).length;

    return (
      <Card
        className="tw:flex tw:flex-col tw:overflow-hidden tw:p-0"
        data-testid={`ontology-column-mapping-table-${asset.id}`}
        key={asset.id}>
        <Box
          align="center"
          className="tw:border-b tw:border-secondary tw:px-4 tw:py-3"
          justify="between">
          <Typography as="span" size="text-sm" weight="semibold">
            {getEntityName(asset)}
          </Typography>
          <Typography as="span" color="secondary" size="text-xs">
            {t('label.columns-bound-count', {
              count: boundCount,
              total: options.length,
            })}
          </Typography>
        </Box>
        {query?.isError ? (
          <Alert variant="error">
            {t('message.temporary-error-try-reloading')}
            <Button
              color="link-color"
              size="xs"
              onPress={() => void query.refetch()}>
              {t('label.retry')}
            </Button>
          </Alert>
        ) : null}
        <ul className="tw:m-0 tw:flex tw:max-h-96 tw:list-none tw:flex-col tw:divide-y tw:divide-secondary tw:overflow-y-auto tw:p-0">
          {options.map((option) => {
            const row = stateOf(asset.id, option);
            const name = option.path.join('.');
            const isSuggested =
              Boolean(row.propertyId) &&
              row.propertyId === option.suggestedPropertyId;

            return (
              <li
                className="tw:flex tw:items-center tw:gap-3 tw:px-4 tw:py-2"
                data-testid={`ontology-column-mapping-row-${name}`}
                key={option.id}>
                <Checkbox
                  aria-label={`${t('label.ontology-bind-columns')}: ${name}`}
                  data-testid={`ontology-column-mapping-check-${name}`}
                  isDisabled={!row.propertyId}
                  isSelected={row.checked}
                  onChange={(checked) =>
                    setRow(asset.id, option.id, { ...row, checked })
                  }
                />
                <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                  <Typography
                    ellipsis
                    as="span"
                    className="tw:font-mono"
                    size="text-sm"
                    weight="medium">
                    {name}
                  </Typography>
                  <Typography as="span" color="secondary" size="text-xs">
                    {option.datatype}
                  </Typography>
                </span>
                <Select
                  aria-label={`${t('label.property')}: ${name}`}
                  className="tw:w-56"
                  items={propertyItems}
                  size="sm"
                  value={row.propertyId || NOT_MAPPED}
                  onChange={(id) => {
                    const propertyId = id === NOT_MAPPED ? '' : String(id);
                    setRow(asset.id, option.id, {
                      checked: Boolean(propertyId),
                      propertyId,
                    });
                  }}>
                  {(item) => (
                    <Select.Item
                      id={item.id}
                      key={item.id}
                      label={item.label}
                    />
                  )}
                </Select>
                {isSuggested ? (
                  <Badge color="brand" size="sm" type="pill-color">
                    {t('label.ontology-suggested-column')}
                  </Badge>
                ) : null}
              </li>
            );
          })}
          {!query?.isPending && !query?.isError && options.length === 0 ? (
            <li className="tw:px-4 tw:py-6 tw:text-center">
              <Typography color="secondary" size="text-sm">
                {t('label.no-data-found')}
              </Typography>
            </li>
          ) : null}
        </ul>
      </Card>
    );
  };

  return (
    <Card
      className="tw:flex tw:flex-col tw:gap-4 tw:p-4"
      data-testid="ontology-column-mapping-step">
      <Box align="start" gap={3} justify="between">
        <Box direction="col" gap={1}>
          <Typography as="h3" size="text-sm" weight="semibold">
            {t('message.ontology-bind-columns-title', {
              concept: conceptName,
            })}
          </Typography>
          <Typography color="secondary" size="text-xs">
            {t('message.ontology-bind-columns-description')}
          </Typography>
        </Box>
        <Button
          color="link-color"
          data-testid="ontology-column-mapping-skip"
          size="sm"
          onPress={onClose}>
          {t('label.ontology-skip-column-binding')}
        </Button>
      </Box>
      {tables.map(renderTable)}
      <Box gap={2} justify="end">
        <Button color="secondary" size="sm" onPress={onClose}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="ontology-column-mapping-save"
          isDisabled={!canSave}
          isLoading={isSaving || bindings.isWriting}
          size="sm"
          onPress={() => void save()}>
          {t('label.save')}
        </Button>
      </Box>
    </Card>
  );
};

export default OntologyColumnMappingStep;
