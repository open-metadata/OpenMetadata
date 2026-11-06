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
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormSelectItem,
  getField,
  HookForm,
} from '@openmetadata/ui-core-components';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  EntityStatus,
} from '../../../generated/entity/data/dataContract';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { getEntityName } from '../../../utils/EntityNameUtils';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { EntityReferenceOption } from '../../Glossary/AddGlossary/AddGlossary.interface';
import {
  hasOwnerRuleViolation,
  toEntityReferenceOption,
  toEntityReferences,
} from '../../Glossary/AddGlossary/AddGlossary.utils';
import { useUserTeamOptions } from '../../Glossary/hooks/useEntityReferenceOptions';
import { ContractFormStep } from '../ContractFormStep/ContractFormStep';
import './contract-detail-form-tab.less';

interface ContractDetailFormValues {
  name: string;
  entityStatus: FormSelectItem | null;
  owners: EntityReferenceOption[];
  description: string;
}

const DATA_CONTRACT_STATUS_OPTION_KEYS = [
  { labelKey: 'label.draft', value: EntityStatus.Draft },
  { labelKey: 'label.in-review', value: EntityStatus.InReview },
  { labelKey: 'label.approved', value: EntityStatus.Approved },
];

export const ContractDetailFormTab: React.FC<{
  initialValues?: Partial<DataContract>;
  onNext: () => void;
  onChange: (formData: Partial<DataContract>) => void;
  buttonProps: {
    nextLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({
  initialValues,
  onNext,
  onChange,
  buttonProps: { nextLabel, isNextVisible = true },
}) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.TABLE);
  const ownersPicker = useUserTeamOptions();

  const statusOptions = useMemo<FormSelectItem[]>(
    () =>
      DATA_CONTRACT_STATUS_OPTION_KEYS.map(({ labelKey, value }) => ({
        id: value,
        label: t(labelKey),
      })),
    [t]
  );

  const toFormValues = (
    contract?: Partial<DataContract>
  ): ContractDetailFormValues => {
    const status = contract?.entityStatus ?? EntityStatus.Draft;

    return {
      name: contract ? getEntityName(contract) : '',
      entityStatus: statusOptions.find((item) => item.id === status) ?? null,
      owners: (contract?.owners ?? []).map(toEntityReferenceOption),
      description: contract?.description ?? '',
    };
  };

  const form = useForm<ContractDetailFormValues>({
    defaultValues: toFormValues(initialValues),
    mode: 'onChange',
  });

  useEffect(() => {
    form.reset(toFormValues(initialValues));
  }, [initialValues]);

  // Report only user edits: a reset must not mark untouched fields as changed.
  useEffect(() => {
    const { unsubscribe } = form.watch((values, { name, type }) => {
      if (type !== 'change' || !name) {
        return;
      }

      const changed: Partial<DataContract> = {
        name: { name: values.name },
        entityStatus: {
          entityStatus: values.entityStatus?.id as EntityStatus | undefined,
        },
        owners: {
          owners: toEntityReferences(
            (values.owners ?? []) as EntityReferenceOption[]
          ),
        },
        description: { description: values.description },
      }[name.split('.')[0] as keyof ContractDetailFormValues];

      onChange(changed);
    });

    return unsubscribe;
  }, [form, onChange]);

  const fields = useMemo<FieldProp[]>(
    () => [
      {
        id: 'name',
        label: t('label.contract-title'),
        name: 'name',
        placeholder: t('label.please-enter-entity-name', {
          entity: t('label.contract'),
        }),
        props: { 'data-testid': 'contract-name' },
        required: true,
        rules: {
          required: t('label.field-required', {
            field: t('label.contract-title'),
          }),
        },
        type: FieldTypes.TEXT,
      },
      {
        id: 'entityStatus',
        label: t('label.status'),
        name: 'entityStatus',
        placeholder: t('label.select-field', { field: t('label.status') }),
        props: {
          'data-testid': 'contract-status',
          options: statusOptions,
          size: 'md',
        },
        type: FieldTypes.SELECT,
      },
      {
        id: 'root/owner',
        label: t('label.owner-plural'),
        name: 'owners',
        placeholder: t('label.please-select-entity', {
          entity: t('label.owner-plural'),
        }),
        props: {
          'data-testid': 'contract-owners',
          // The server already filtered the options by the search text.
          filterOption: () => true,
          multiple: true,
          ...ownersPicker,
        },
        rules: {
          validate: (owners: EntityReferenceOption[]) =>
            hasOwnerRuleViolation(owners, entityRules)
              ? t('message.owner-multiple-users-or-single-team')
              : true,
        },
        type: FieldTypes.USER_TEAM_SELECT_INPUT,
      },
    ],
    [entityRules, ownersPicker, statusOptions, t]
  );

  return (
    <ContractFormStep
      description={t('message.contract-detail-plural-description')}
      isNextVisible={isNextVisible}
      nextLabel={nextLabel}
      title={t('label.contract-detail-plural')}
      onNext={onNext}>
      <div className="contract-form-content-container">
        <HookForm
          className="contract-detail-form tw:flex tw:flex-col tw:gap-5"
          form={form}>
          {fields.map((field) => (
            <div key={field.id}>{getField(field)}</div>
          ))}
          <FormField control={form.control} name="description">
            {({ field }) => (
              <Box className="tw:gap-1.5" direction="col">
                <FormItemLabel label={t('label.description')} />
                <RichTextEditor
                  className="contract-description new-form-style"
                  initialValue={initialValues?.description ?? ''}
                  onTextChange={field.onChange}
                />
              </Box>
            )}
          </FormField>
        </HookForm>
      </div>
    </ContractFormStep>
  );
};
