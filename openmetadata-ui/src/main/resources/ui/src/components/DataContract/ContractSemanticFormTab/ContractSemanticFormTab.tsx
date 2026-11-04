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
  FieldTypes,
  FormField,
  FormItemLabel,
  getField,
  HintText,
  HookForm,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Edit01,
  Plus as PlusIcon,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { Actions, JsonTree } from '@react-awesome-query-builder/ui';
import classNames from 'classnames';
import { isEmpty, isNull } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import {
  getSematicRuleFields,
  semanticRuleValidator,
} from '../../../utils/DataContract/DataContractUtils';
import jsonLogicSearchClassBase from '../../../utils/JSONLogicSearchClassBase';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import QueryBuilder from '../../common/QueryBuilder/QueryBuilder';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { ContractFormStep } from '../ContractFormStep/ContractFormStep';
import './contract-semantic-form-tab.less';

interface ContractSemanticFormValues {
  semantics: SemanticsRule[];
}

const NEW_SEMANTIC = { enabled: true, rule: '' } as SemanticsRule;

const parseTree = (jsonTree?: string) =>
  jsonTree ? (JSON.parse(jsonTree) as JsonTree) : undefined;

const toNegatedRule = (rule: string) => {
  if (!rule) {
    return '';
  }
  try {
    return JSON.stringify(
      jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
        JSON.parse(rule)
      )
    );
  } catch {
    return '';
  }
};

export const ContractSemanticFormTab: React.FC<{
  onChange: (data: Partial<DataContract>) => void;
  onNext: () => void;
  onPrev: () => void;
  initialValues?: Partial<DataContract>;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({
  onChange,
  onNext,
  onPrev,
  initialValues,
  buttonProps: { nextLabel, prevLabel, isNextVisible = true },
}) => {
  const { t } = useTranslation();
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [queryBuilderActions, setQueryBuilderActions] = useState<Actions>();

  const form = useForm<ContractSemanticFormValues>({
    defaultValues: { semantics: [] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'semantics',
  });
  const semantics = useWatch({ control: form.control, name: 'semantics' });
  const { isDirty } = form.formState;

  const queryBuilderFields = useMemo(() => getSematicRuleFields(), []);

  useEffect(() => {
    form.reset({
      semantics: isEmpty(initialValues?.semantics)
        ? [{ enabled: true } as SemanticsRule]
        : initialValues?.semantics,
    });
    setEditingKey(0);
  }, [initialValues]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    onChange({ semantics });
  }, [semantics, isDirty]);

  const handleAddSemantic = () => {
    append(NEW_SEMANTIC);
    setEditingKey(fields.length);
  };

  const handleDeleteSemantic = useCallback(
    (index: number) => {
      remove(index);
      onChange({ semantics: form.getValues('semantics') });
    },
    [form, onChange, remove]
  );

  // handleSubmit, unlike trigger, marks the form submitted, so each later change
  // re-validates and clears or re-shows its error, as the antd form did.
  const handleSaveRule = form.handleSubmit(() => setEditingKey(null));

  const renderCardTitle = (index: number) => (
    <div className="semantic-form-item-title-container">
      <Box align="center" gap={6}>
        <FormField control={form.control} name={`semantics.${index}.enabled`}>
          {({ field }) => (
            <Toggle
              aria-label={t('label.enabled')}
              className="enable-form-item"
              isSelected={Boolean(field.value)}
              size="md"
              onChange={field.onChange}
            />
          )}
        </FormField>
        <Box className="tw:min-w-0" direction="col">
          <Typography className="semantic-form-item-title">
            {semantics?.[index]?.name || t('label.untitled')}
          </Typography>
          <Typography ellipsis className="semantic-form-item-description">
            {semantics?.[index]?.description || t('label.no-description')}
          </Typography>
        </Box>
      </Box>
      <Box align="center" gap={3}>
        <ButtonUtility
          className="edit-expand-button"
          color="secondary"
          data-testid={`edit-semantic-${index}`}
          icon={Edit01}
          size="sm"
          tooltip={t('label.edit')}
          onClick={() => setEditingKey(index)}
        />
        <ButtonUtility
          color="secondary-destructive"
          data-testid={`delete-semantic-${index}`}
          icon={Trash01}
          size="sm"
          tooltip={t('label.delete')}
          onClick={() => handleDeleteSemantic(index)}
        />
      </Box>
    </div>
  );

  const renderEditor = (index: number) => {
    const semantic = semantics?.[index];

    return (
      <>
        <div className="semantic-form-item-content tw:flex tw:flex-col tw:gap-5">
          {getField({
            // Keeps the antd-generated id the e2e suites target.
            id: `semantics_${index}_name`,
            label: t('label.name'),
            name: `semantics.${index}.name`,
            placeholder: t('label.please-enter-entity-name', {
              entity: t('label.semantic'),
            }),
            required: true,
            rules: {
              required: t('message.field-text-is-required', {
                fieldText: t('label.name'),
              }),
            },
            type: FieldTypes.TEXT,
          })}
          {getField({
            id: `semantics_${index}_description`,
            label: t('label.description'),
            name: `semantics.${index}.description`,
            placeholder: t('label.please-enter-value', {
              name: t('label.description'),
            }),
            required: true,
            rules: {
              required: t('message.field-text-is-required', {
                fieldText: t('label.description'),
              }),
            },
            type: FieldTypes.TEXTAREA,
          })}
          <FormField
            control={form.control}
            name={`semantics.${index}.rule`}
            rules={{ validate: semanticRuleValidator }}>
            {({ field, fieldState }) => (
              <Box className="tw:gap-1.5" direction="col">
                <FormItemLabel required label={t('label.rule')} />
                <QueryBuilder
                  entityType={EntityType.TABLE}
                  fields={queryBuilderFields}
                  groupMode="flat"
                  key={fields[index]?.id}
                  outputType={SearchOutputType.JSONLogic}
                  tree={parseTree(semantic?.jsonTree)}
                  value={semantic?.rule ?? ''}
                  onActionsReady={setQueryBuilderActions}
                  onChange={(rule: string, tree?: JsonTree) => {
                    field.onChange(toNegatedRule(rule));
                    form.setValue(
                      `semantics.${index}.jsonTree`,
                      tree && JSON.stringify(tree)
                    );
                  }}
                />
                {fieldState.error?.message && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>
        </div>

        <div className="semantic-form-item-actions">
          <Button
            color="link-color"
            data-testid="add-new-rule-btn"
            iconLeading={PlusIcon}
            isDisabled={!queryBuilderActions?.addRule}
            onPress={() => queryBuilderActions?.addRule([])}>
            {t('label.add-new-entity', { entity: t('label.rule') })}
          </Button>

          <div className="tw:flex tw:items-center tw:gap-3">
            <Button color="secondary" onPress={() => setEditingKey(null)}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="save-semantic-button"
              onPress={() => handleSaveRule()}>
              {t('label.save')}
            </Button>
          </div>
        </div>
      </>
    );
  };

  return (
    <ContractFormStep
      className="contract-semantic-form-container"
      description={t('message.semantics-description')}
      extra={
        <Button
          color="link-color"
          data-testid="add-semantic-button"
          iconLeading={PlusIcon}
          isDisabled={!isNull(editingKey)}
          onPress={handleAddSemantic}>
          {t('label.add-entity', { entity: t('label.semantic-plural') })}
        </Button>
      }
      isNextVisible={isNextVisible}
      nextLabel={nextLabel}
      prevLabel={prevLabel}
      title={t('label.semantic-plural')}
      onNext={onNext}
      onPrev={onPrev}>
      <HookForm form={form}>
        {fields.map((field, index) => (
          <ExpandableCard
            cardProps={{
              className: classNames('expandable-card m-t-md', {
                'expanded-active-card': editingKey === index,
              }),
              title: editingKey === index ? null : renderCardTitle(index),
            }}
            dataTestId={`contract-semantics-card-${index}`}
            defaultExpanded={editingKey === index}
            key={field.id}>
            {editingKey === index ? (
              renderEditor(index)
            ) : (
              <div className="semantic-rule-editor-view-only">
                <QueryBuilder
                  readonly
                  entityType={EntityType.TABLE}
                  fields={queryBuilderFields}
                  groupMode="flat"
                  key={field.id}
                  outputType={SearchOutputType.JSONLogic}
                  tree={parseTree(semantics?.[index]?.jsonTree)}
                  value={semantics?.[index]?.rule}
                />
              </div>
            )}
          </ExpandableCard>
        ))}
      </HookForm>
    </ContractFormStep>
  );
};
