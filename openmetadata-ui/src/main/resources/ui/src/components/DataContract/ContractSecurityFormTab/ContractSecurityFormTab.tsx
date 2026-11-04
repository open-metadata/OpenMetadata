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
  Box,
  Button,
  ButtonUtility,
  Divider,
  FieldProp,
  FieldTypes,
  FormSelectItem,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Edit01,
  Plus as PlusIcon,
  Trash01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, isNull } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Control,
  DeepPartial,
  useFieldArray,
  useForm,
  UseFormReturn,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_ROW_FILTER_ENTITIES } from '../../../constants/DataContract.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  ContractSecurity,
  DataContract,
  Policy,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { getColumnOptionsFromTableColumn } from '../../../utils/TablePureUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { ContractFormStep } from '../ContractFormStep/ContractFormStep';
import './contract-security-form-tab.less';

interface RowFilterFormValues {
  columnName: FormSelectItem | null;
  values: FormSelectItem[];
}

interface PolicyFormValues {
  accessPolicy: string;
  identities: FormSelectItem[];
  rowFilters: RowFilterFormValues[];
}

interface ContractSecurityFormValues {
  dataClassification: string;
  policies: PolicyFormValues[];
}

const EMPTY_ROW_FILTER: RowFilterFormValues = { columnName: null, values: [] };

const EMPTY_POLICY: PolicyFormValues = {
  accessPolicy: '',
  identities: [],
  rowFilters: [EMPTY_ROW_FILTER],
};

const toTags = (values?: string[]) =>
  (values ?? []).map<FormSelectItem>((value) => ({ id: value, label: value }));

const fromTags = (items?: Array<DeepPartial<FormSelectItem> | undefined>) =>
  (items ?? []).map((item) => item?.id ?? '').filter(Boolean);

const toFormValues = (
  security: ContractSecurity | undefined,
  columnItems: FormSelectItem[]
): ContractSecurityFormValues => ({
  dataClassification: security?.dataClassification ?? '',
  policies: isEmpty(security)
    ? [EMPTY_POLICY]
    : (security?.policies ?? []).map((policy) => ({
        accessPolicy: policy.accessPolicy ?? '',
        identities: toTags(policy.identities),
        rowFilters: (policy.rowFilters ?? []).map((filter) => ({
          columnName:
            columnItems.find((item) => item.id === filter.columnName) ??
            (filter.columnName
              ? { id: filter.columnName, label: filter.columnName }
              : null),
          values: toTags(filter.values),
        })),
      })),
});

const toContractSecurity = (
  values: DeepPartial<ContractSecurityFormValues>
): ContractSecurity => ({
  dataClassification: values.dataClassification,
  policies: (values.policies ?? []).map<Policy>((policy) => ({
    accessPolicy: policy?.accessPolicy,
    identities: fromTags(policy?.identities),
    rowFilters: (policy?.rowFilters ?? []).map((filter) => ({
      columnName: filter?.columnName?.id,
      values: fromTags(filter?.values),
    })),
  })),
});

const tagField = (
  name: string,
  label: string,
  placeholder: string,
  testId: string,
  isDisabled = false
): FieldProp => ({
  id: testId,
  label,
  name,
  placeholder,
  props: {
    allowsCreation: true,
    'data-testid': testId,
    hideDropdown: true,
    isDisabled,
    multiple: true,
    options: [],
  },
  type: FieldTypes.AUTOCOMPLETE,
});

interface ContractPolicyCardProps {
  control: Control<ContractSecurityFormValues>;
  policyIndex: number;
  isEditing: boolean;
  hasRowFilters: boolean;
  columnItems: FormSelectItem[];
  onEdit: (index: number | null) => void;
  onDelete: (index: number) => void;
}

const ContractPolicyCard = ({
  control,
  policyIndex,
  isEditing,
  hasRowFilters,
  columnItems,
  onEdit,
  onDelete,
}: ContractPolicyCardProps) => {
  const { t } = useTranslation();
  const prefix = `policies.${policyIndex}` as const;
  const accessPolicy = useWatch({ control, name: `${prefix}.accessPolicy` });
  const {
    fields: rowFilterFields,
    append: addRowFilter,
    remove: removeRowFilter,
  } = useFieldArray({ control, name: `${prefix}.rowFilters` });

  const columnPlaceholder = t('label.please-enter-entity-name', {
    entity: t('label.column'),
  });
  const valuesPlaceholder = t('label.please-enter-value', {
    name: t('label.column-plural'),
  });

  const renderRowFilters = (isDisabled: boolean) => (
    <div className="contract-consumer-security-card-rule-container">
      {rowFilterFields.map((rowFilter, rowFilterIndex) => {
        const name = `${prefix}.rowFilters.${rowFilterIndex}`;

        return (
          <div
            className="tw:mb-4 tw:grid tw:grid-cols-[1fr_1fr_auto] tw:items-start tw:gap-4"
            key={rowFilter.id}>
            {getField({
              id: `columnName-input-${policyIndex}-${rowFilterIndex}`,
              label: t('label.column-name'),
              name: `${name}.columnName`,
              placeholder: columnPlaceholder,
              props: {
                'data-testid': `columnName-input-${policyIndex}-${rowFilterIndex}`,
                isDisabled,
                options: columnItems,
              },
              type: FieldTypes.AUTOCOMPLETE,
            })}
            {getField(
              tagField(
                `${name}.values`,
                t('label.value-plural'),
                valuesPlaceholder,
                `values-${policyIndex}-${rowFilterIndex}`,
                isDisabled
              )
            )}
            {isDisabled ? (
              <span />
            ) : (
              <Button
                aria-label={t('label.remove')}
                className="contract-consumer-security-card-rule-delete-button tw:mt-6.5"
                color="secondary"
                iconLeading={XClose}
                size="sm"
                onPress={() => removeRowFilter(rowFilterIndex)}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const actions = (
    <div className="contract-consumer-security-card-form-actions-items tw:gap-3">
      <Button
        color="secondary"
        data-testid="cancel-policy-button"
        onPress={() => onEdit(null)}>
        {t('label.cancel')}
      </Button>
      <Button data-testid="save-policy-button" onPress={() => onEdit(null)}>
        {t('label.save')}
      </Button>
    </div>
  );

  return (
    <ExpandableCard
      cardProps={{
        className: classNames(
          'contract-consumer-security-card expandable-card',
          { 'expanded-active-card': isEditing }
        ),
        title: isEditing ? null : (
          <div className="security-form-item-title-container">
            <Typography className="consumer-form-item-title">
              {accessPolicy || t('label.untitled')}
            </Typography>
            <Box align="center" gap={3}>
              <ButtonUtility
                className="edit-expand-button"
                color="secondary"
                data-testid={`edit-policy-${policyIndex}`}
                icon={Edit01}
                size="sm"
                tooltip={t('label.edit')}
                onClick={() => onEdit(policyIndex)}
              />
              <ButtonUtility
                color="secondary-destructive"
                data-testid={`delete-policy-${policyIndex}`}
                icon={Trash01}
                size="sm"
                tooltip={t('label.delete')}
                onClick={() => onDelete(policyIndex)}
              />
            </Box>
          </div>
        ),
      }}
      dataTestId={`contract-policy-card-${policyIndex}`}
      defaultExpanded={isEditing}>
      {isEditing ? (
        <div className="security-form-item-content">
          <div className="contract-consumer-security-card-row tw:flex tw:flex-col tw:gap-4">
            {getField({
              id: `access-policy-input-${policyIndex}`,
              label: t('label.access-policy'),
              name: `${prefix}.accessPolicy`,
              placeholder: t('label.please-enter-entity-name', {
                entity: t('label.access-policy'),
              }),
              props: { 'data-testid': `access-policy-input-${policyIndex}` },
              type: FieldTypes.TEXT,
            })}
            {getField(
              tagField(
                `${prefix}.identities`,
                t('label.identities'),
                t('label.please-enter-value', { name: t('label.identities') }),
                `identities-input-${policyIndex}`
              )
            )}
          </div>

          {hasRowFilters && (
            <>
              <Divider className="tw:my-6" />
              <div className="tw:flex tw:items-center tw:justify-between tw:pr-5">
                <Typography className="row-filter-title">
                  {t('label.row-filter-plural')}
                </Typography>
                <Button
                  color="link-color"
                  data-testid={`add-row-filter-button-${policyIndex}`}
                  iconLeading={PlusIcon}
                  onPress={() => addRowFilter(EMPTY_ROW_FILTER)}>
                  {t('label.add-entity', { entity: t('label.row-filter') })}
                </Button>
              </div>
              {renderRowFilters(false)}
            </>
          )}
          {actions}
        </div>
      ) : (
        hasRowFilters && renderRowFilters(true)
      )}
    </ExpandableCard>
  );
};

export const ContractSecurityFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onNext: () => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({ onChange, onNext, onPrev, buttonProps, initialValues }) => {
  const { t } = useTranslation();
  const { data: tableData } = useGenericContext();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const [editingKey, setEditingKey] = useState<number | null>(null);

  const columnItems = useMemo<FormSelectItem[]>(() => {
    const { columns } = tableData as Table;

    return isEmpty(columns)
      ? []
      : getColumnOptionsFromTableColumn(columns, true).map(
          ({ label, value }) => ({ id: value, label })
        );
  }, [tableData]);

  const form: UseFormReturn<ContractSecurityFormValues> =
    useForm<ContractSecurityFormValues>({
      defaultValues: toFormValues(initialValues?.security, columnItems),
    });
  const {
    fields: policyFields,
    append: addPolicy,
    remove: removePolicy,
  } = useFieldArray({ control: form.control, name: 'policies' });

  useEffect(() => {
    const security = initialValues?.security;
    form.reset(toFormValues(security, columnItems));
    setEditingKey(isEmpty(security) || !isEmpty(security?.policies) ? 0 : null);
  }, [initialValues?.security]);

  useEffect(() => {
    const { unsubscribe } = form.watch((values, { type }) => {
      if (type === 'change') {
        onChange({ security: toContractSecurity(values) });
      }
    });

    return unsubscribe;
  }, [form, onChange]);

  const handleAddPolicy = () => {
    addPolicy(EMPTY_POLICY);
    setEditingKey(policyFields.length);
  };

  const handleDeletePolicy = useCallback(
    (index: number) => {
      removePolicy(index);
      setEditingKey(null);
      onChange({ security: toContractSecurity(form.getValues()) });
    },
    [form, onChange, removePolicy]
  );

  return (
    <ContractFormStep
      className="contract-security-form-container"
      description={t('message.data-contract-security-description')}
      isNextVisible={buttonProps.isNextVisible}
      nextLabel={buttonProps.nextLabel}
      prevLabel={buttonProps.prevLabel}
      title={t('label.security')}
      onNext={onNext}
      onPrev={onPrev}>
      <HookForm
        className="contract-security-form tw:flex tw:flex-col tw:gap-5"
        form={form}>
        <div className="contract-form-content-container">
          {getField({
            id: 'dataClassification',
            label: t('label.data-classification'),
            name: 'dataClassification',
            placeholder: t('label.please-enter-entity-name', {
              entity: t('label.data-classification'),
            }),
            props: { 'data-testid': 'data-classification-input' },
            type: FieldTypes.TEXT,
          })}
        </div>

        <div className="contract-form-content-container">
          <div className="tw:flex tw:items-center tw:justify-between">
            <div className="consumer-title-container">
              <Typography className="consumer-title">
                {t('label.policy-plural')}
              </Typography>
              <Typography as="p" className="consumer-description">
                {t('message.contract-security-consume-description')}
              </Typography>
            </div>

            <Button
              color="link-color"
              data-testid="add-policy-button"
              iconLeading={PlusIcon}
              isDisabled={!isNull(editingKey)}
              onPress={handleAddPolicy}>
              {t('label.add-entity', { entity: t('label.policy') })}
            </Button>
          </div>

          {policyFields.map((policy, policyIndex) => (
            <ContractPolicyCard
              columnItems={columnItems}
              control={form.control}
              hasRowFilters={SUPPORTED_ROW_FILTER_ENTITIES.includes(entityType)}
              isEditing={editingKey === policyIndex}
              key={policy.id}
              policyIndex={policyIndex}
              onDelete={handleDeletePolicy}
              onEdit={setEditingKey}
            />
          ))}
        </div>
      </HookForm>
    </ContractFormStep>
  );
};
