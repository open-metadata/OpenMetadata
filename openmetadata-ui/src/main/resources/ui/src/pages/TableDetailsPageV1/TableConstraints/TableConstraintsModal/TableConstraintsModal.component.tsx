/*
 *  Copyright 2024 Collate.
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
  Autocomplete,
  Box,
  Button,
  FormField,
  FormItemLabel,
  HookForm,
  Select,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { debounce, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFilter } from 'react-aria';
import { useFieldArray, useForm, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE } from '../../../../constants/constants';
import {
  RELATIONSHIP_TYPE_OPTION,
  TABLE_CONSTRAINTS_TYPE_OPTIONS,
} from '../../../../constants/Table.constants';
import { SearchIndex } from '../../../../enums/search.enum';
import {
  ConstraintType,
  RelationshipType,
  Table,
} from '../../../../generated/entity/data/table';
import { searchQuery } from '../../../../rest/searchAPI';
import { translateWithNestedKeys } from '../../../../utils/i18next/LocalUtil';
import { getServiceNameQueryFilter } from '../../../../utils/ServicePureUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../utils/StringUtils';
import {
  createTableConstraintObject,
  getColumnOptionsFromTableColumn,
} from '../../../../utils/TablePureUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import './table-constraint.style.less';
import {
  ConstraintKeyField,
  TableConstraintFormValues,
  TableConstraintModalProps,
} from './TableConstraintsModal.interface';
import {
  EMPTY_FOREIGN_CONSTRAINT,
  toConstraintFormValues,
} from './TableConstraintsModal.utils';

type SelectItem = { id: string; label: string };

const KEY_FIELDS: Partial<Record<ConstraintType, ConstraintKeyField>> = {
  [ConstraintType.PrimaryKey]: 'primaryConstraints',
  [ConstraintType.Unique]: 'uniqueConstraints',
  [ConstraintType.SortKey]: 'sortConstraints',
  [ConstraintType.DistKey]: 'distConstraints',
  [ConstraintType.ClusterKey]: 'clusterConstraints',
};

const KEY_FIELD_TEST_IDS: Record<ConstraintKeyField, string> = {
  primaryConstraints: 'primary-constraint-type-select',
  uniqueConstraints: 'unique-constraint-type-select',
  sortConstraints: 'sort-constraint-type-select',
  distConstraints: 'dist-constraint-type-select',
  clusterConstraints: 'cluster-constraint-type-select',
};

interface KeyColumnsFieldProps {
  form: UseFormReturn<TableConstraintFormValues>;
  name: ConstraintKeyField;
  label: string;
  items: SelectItem[];
}

/** Multi-select of table columns for a primary/unique/sort/dist/cluster key. */
const KeyColumnsField = ({
  form,
  name,
  label,
  items,
}: KeyColumnsFieldProps) => {
  const { t } = useTranslation();
  const { contains } = useFilter({ sensitivity: 'base' });

  return (
    <div className="table-constraint-form-container">
      <FormField control={form.control} name={name}>
        {({ field }) => {
          const values = field.value ?? [];

          return (
            <Box direction="col" gap={1}>
              <FormItemLabel label={label} />
              <Autocomplete
                multiple
                aria-label={label}
                data-testid={KEY_FIELD_TEST_IDS[name]}
                filterOption={(item, text) => contains(item.label ?? '', text)}
                items={items}
                placeholder={t('label.select-entity', { entity: label })}
                selectedItems={values.map((id) => ({ id, label: id }))}
                onItemCleared={(key) =>
                  field.onChange(values.filter((id) => id !== String(key)))
                }
                onItemInserted={(key) =>
                  field.onChange([...values, String(key)])
                }>
                {(item) => (
                  <Autocomplete.Item id={item.id} label={item.label} />
                )}
              </Autocomplete>
            </Box>
          );
        }}
      </FormField>
    </div>
  );
};

interface ForeignKeyRowProps {
  form: UseFormReturn<TableConstraintFormValues>;
  index: number;
  columnItems: SelectItem[];
  relationshipItems: SelectItem[];
  relatedColumns: SelectItem[];
  onSearch: (text: string) => void;
  onRemove: (index: number) => void;
}

const ForeignKeyRow = ({
  form,
  index,
  columnItems,
  relationshipItems,
  relatedColumns,
  onSearch,
  onRemove,
}: ForeignKeyRowProps) => {
  const { t } = useTranslation();
  const columnLabel = t('label.entity-name', { entity: t('label.column') });
  const relationshipLabel = t('label.entity-type-plural', {
    entity: t('label.relationship'),
  });

  // A foreign key row only has to be complete while that section is shown;
  // rows left incomplete elsewhere are dropped on save.
  const requiredForForeignKey = (label: string) => ({
    validate: (value?: string) =>
      form.getValues('constraintType') !== ConstraintType.ForeignKey ||
      Boolean(value) ||
      t('label.field-required', { field: label }),
  });

  return (
    <div className="table-constraint-form-container tw:flex tw:flex-col tw:gap-4">
      <FormField
        control={form.control}
        name={`foreignConstraints.${index}.columns`}
        rules={requiredForForeignKey(columnLabel)}>
        {({ field, fieldState }) => (
          <Select
            data-testid={`${index}-column-type-select`}
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            items={columnItems}
            label={columnLabel}
            placeholder={t('label.select-entity', {
              entity: t('label.table-entity-text', {
                entityText: t('label.column'),
              }),
            })}
            selectedKey={field.value ?? null}
            onSelectionChange={(key) =>
              key !== null && field.onChange(String(key))
            }>
            {(option) => <Select.Item id={option.id} label={option.label} />}
          </Select>
        )}
      </FormField>
      <FormField
        control={form.control}
        name={`foreignConstraints.${index}.relationshipType`}
        rules={requiredForForeignKey(relationshipLabel)}>
        {({ field, fieldState }) => (
          <Select
            data-testid={`${index}-relationship-type-select`}
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            items={relationshipItems}
            label={relationshipLabel}
            placeholder={t('label.select-entity', {
              entity: t('label.relationship-type'),
            })}
            selectedKey={field.value ?? null}
            onSelectionChange={(key) =>
              key !== null && field.onChange(key as RelationshipType)
            }>
            {(option) => <Select.Item id={option.id} label={option.label} />}
          </Select>
        )}
      </FormField>
      <FormField
        control={form.control}
        name={`foreignConstraints.${index}.referredColumns`}
        rules={requiredForForeignKey(t('label.related-column'))}>
        {({ field, fieldState }) => (
          <Select.ComboBox
            // Results arrive after typing; keep the popup open meanwhile.
            allowsEmptyCollection
            data-testid={`${index}-related-column-select`}
            hint={fieldState.error?.message}
            isInvalid={fieldState.invalid}
            items={
              field.value &&
              !relatedColumns.some((column) => column.id === field.value)
                ? [{ id: field.value, label: field.value }, ...relatedColumns]
                : relatedColumns
            }
            label={t('label.related-column')}
            placeholder={t('label.select-entity', {
              entity: t('label.related-column'),
            })}
            selectedKey={field.value ?? null}
            shortcut={false}
            onInputChange={(text) => {
              if (text !== field.value) {
                onSearch(text);
              }
            }}
            onSelectionChange={(key) =>
              field.onChange(key === null ? undefined : String(key))
            }>
            {(option) => (
              <Select.Item
                data-testid={`option-label-${option.id}`}
                id={option.id}
                label={option.label}
              />
            )}
          </Select.ComboBox>
        )}
      </FormField>
      <Button
        aria-label={t('label.delete-entity', {
          entity: t('label.constraint'),
        })}
        className="tw:absolute tw:top-2.5 tw:right-3"
        color="tertiary"
        data-testid={`${index}-delete-constraint-button`}
        iconLeading={Trash01}
        size="xs"
        onPress={() => onRemove(index)}
      />
    </div>
  );
};

const TableConstraintsModal = ({
  tableDetails,
  constraint,
  onSave,
  onClose,
}: TableConstraintModalProps) => {
  const { t } = useTranslation();
  const form = useForm<TableConstraintFormValues>({
    defaultValues: toConstraintFormValues(constraint),
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'foreignConstraints',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [relatedColumns, setRelatedColumns] = useState<SelectItem[]>([]);
  const constraintType = form.watch('constraintType');

  const columnItems = useMemo(
    () =>
      getColumnOptionsFromTableColumn(tableDetails?.columns ?? []).map(
        ({ label, value }) => ({ id: value, label })
      ),
    [tableDetails?.columns]
  );

  const constraintTypeItems = useMemo(
    () =>
      TABLE_CONSTRAINTS_TYPE_OPTIONS.map((option) => ({
        id: option.value,
        label: translateWithNestedKeys(option.label, option.labelData),
      })),
    []
  );

  const relationshipItems = useMemo(
    () =>
      RELATIONSHIP_TYPE_OPTION.map((option) => ({
        id: option.value,
        label: t(option.label),
      })),
    [t]
  );

  const getSearchResults = useCallback(
    async (value: string) => {
      try {
        const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
        const data = await searchQuery({
          query:
            value &&
            `(columns.name.keyword:*${encodedValue}*) OR (columns.fullyQualifiedName:*${encodedValue}*)`,
          searchIndex: SearchIndex.TABLE,
          queryFilter: getServiceNameQueryFilter(
            tableDetails?.service?.name ?? ''
          ),
          pageNumber: 1,
          pageSize: PAGE_SIZE,
          includeDeleted: false,
        });

        setRelatedColumns(
          data.hits.hits.flatMap(({ _source }: { _source: Table }) =>
            _source.columns.map((column) => ({
              id: column.fullyQualifiedName ?? '',
              label: column.fullyQualifiedName ?? '',
            }))
          )
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.suggestion-lowercase-plural'),
          })
        );
      }
    },
    [tableDetails?.service?.name, t]
  );

  const debounceFetcher = useMemo(
    () => debounce(getSearchResults, 800),
    [getSearchResults]
  );

  useEffect(() => () => debounceFetcher.cancel(), [debounceFetcher]);

  useEffect(() => {
    form.reset(toConstraintFormValues(constraint));
  }, [constraint, form]);

  const handleSubmit = async (values: TableConstraintFormValues) => {
    const foreignConstraints = values.foreignConstraints
      .filter(
        (item) => item.columns && item.relationshipType && item.referredColumns
      )
      .map((item) => ({
        columns: [item.columns as string],
        relationshipType: item.relationshipType as RelationshipType,
        referredColumns: [item.referredColumns as string],
        constraintType: ConstraintType.ForeignKey,
      }));

    try {
      setIsLoading(true);
      await onSave([
        ...createTableConstraintObject(
          values.primaryConstraints,
          ConstraintType.PrimaryKey
        ),
        ...createTableConstraintObject(
          values.distConstraints,
          ConstraintType.DistKey
        ),
        ...createTableConstraintObject(
          values.clusterConstraints,
          ConstraintType.ClusterKey
        ),
        ...createTableConstraintObject(
          values.sortConstraints,
          ConstraintType.SortKey
        ),
        ...createTableConstraintObject(
          values.uniqueConstraints,
          ConstraintType.Unique
        ),
        ...foreignConstraints,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const keyFieldLabels: Record<ConstraintKeyField, string> = {
    primaryConstraints: t('label.entity-key-plural', {
      entity: t('label.primary'),
    }),
    uniqueConstraints: t('label.unique'),
    sortConstraints: t('label.entity-key-plural', { entity: t('label.sort') }),
    distConstraints: t('label.entity-key-plural', { entity: t('label.dist') }),
    clusterConstraints: t('label.entity-key-plural', {
      entity: t('label.cluster'),
    }),
  };
  const activeKeyField = constraintType && KEY_FIELDS[constraintType];

  const renderForeignKeys = () => (
    <>
      {fields.map((item, index) => (
        <ForeignKeyRow
          columnItems={columnItems}
          form={form}
          index={index}
          key={item.id}
          relatedColumns={relatedColumns}
          relationshipItems={relationshipItems}
          onRemove={remove}
          onSearch={debounceFetcher}
        />
      ))}
      <Button
        className="tw:mt-4 tw:self-start"
        color="secondary"
        data-testid="add-constraint-button"
        iconLeading={Plus}
        size="xs"
        onPress={() => append(EMPTY_FOREIGN_CONSTRAINT)}>
        {t('label.add-entity', { entity: t('label.constraint-plural') })}
      </Button>
    </>
  );

  return (
    <SimpleModal
      isOpen
      data-testid="table-constraint-modal"
      footer={[
        <Button
          color="secondary"
          isDisabled={isLoading}
          key="cancel-btn"
          onClick={onClose}>
          {t('label.cancel')}
        </Button>,
        <Button
          color="primary"
          data-testid="save-btn"
          isLoading={isLoading}
          key="save-btn"
          onClick={form.handleSubmit(handleSubmit)}>
          {t('label.save')}
        </Button>,
      ]}
      isDismissable={false}
      title={t(`label.${isEmpty(constraint) ? 'add' : 'update'}-entity`, {
        entity: t('label.table-constraint-plural'),
      })}
      onCancel={onClose}>
      <HookForm
        className="table-constraint-form tw:flex tw:flex-col tw:gap-4"
        form={form}
        onSubmit={form.handleSubmit(handleSubmit)}>
        <FormField control={form.control} name="constraintType">
          {({ field }) => (
            <Select
              data-testid="constraint-type-select"
              items={constraintTypeItems}
              label={t('label.constraint-type')}
              placeholder={t('label.select-entity', {
                entity: t('label.constraint-type'),
              })}
              selectedKey={field.value ?? null}
              onSelectionChange={(key) =>
                key !== null && field.onChange(key as ConstraintType)
              }>
              {(item) => <Select.Item id={item.id} label={item.label} />}
            </Select>
          )}
        </FormField>

        {activeKeyField && (
          <KeyColumnsField
            form={form}
            items={columnItems}
            key={activeKeyField}
            label={keyFieldLabels[activeKeyField]}
            name={activeKeyField}
          />
        )}
        {constraintType === ConstraintType.ForeignKey && renderForeignKeys()}
      </HookForm>
    </SimpleModal>
  );
};

export default TableConstraintsModal;
