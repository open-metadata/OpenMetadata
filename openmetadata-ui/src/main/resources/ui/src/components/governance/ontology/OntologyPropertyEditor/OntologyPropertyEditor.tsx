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
  Checkbox,
  FieldProp,
  FieldTypes,
  FormField,
  getField,
  HookForm,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { keyBy } from 'lodash';
import { Fragment, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  createOntologyProperty,
  patchOntologyProperty,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  OntologyPropertyFormValues,
  propertyFormFields,
  propertyFormValues,
  propertyPatch,
  propertyRequest,
} from './OntologyPropertyEditor.utils';

const ADVANCED_FIELDS = [
  'characteristics',
  'inverse',
  'disjointWith',
  'propertyChain',
  'iri',
];

const isSelectedItem = (value: { id: string }[], item: { id: string }) =>
  value.some((selected) => selected.id === item.id);

const toggleSelection = (
  value: { id: string }[],
  item: { id: string },
  checked: boolean
) =>
  checked
    ? [...value, item]
    : value.filter((selected) => selected.id !== item.id);

interface OntologyPropertyEditorProps {
  ontology: Ontology;
  property?: OntologyProperty;
  canEdit: boolean;
  onSaved: (property: OntologyProperty) => void;
}

const OntologyPropertyEditor = ({
  ontology,
  property,
  canEdit,
  onSaved,
}: OntologyPropertyEditorProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const form = useForm<OntologyPropertyFormValues>({
    defaultValues: propertyFormValues(property),
  });
  const literals = useFieldArray({ control: form.control, name: 'enumValues' });
  const kind = form.watch('kind').id;
  const [isSaving, setIsSaving] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const { errors, submitCount } = form.formState;
  // Reopen only on a new save attempt, so the user can still collapse it.
  useEffect(() => {
    if (ADVANCED_FIELDS.some((name) => name in errors)) {
      setIsAdvancedOpen(true);
    }
  }, [submitCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const disabled = !canEdit || isSaving;
  const save = async (values: OntologyPropertyFormValues) => {
    if (!canEdit) {
      return;
    }
    setIsSaving(true);
    try {
      const request = propertyRequest(values, ontology.fullyQualifiedName);
      onSaved(
        property
          ? await patchOntologyProperty(
              property.id,
              propertyPatch(property, request)
            )
          : await createOntologyProperty(request)
      );
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderEnumValues = () =>
    kind === Kind.Data && (
      <Box direction="col" gap={3}>
        <Typography as="h3" weight="semibold">
          {t('label.enum-value-plural')}
        </Typography>
        {literals.fields.map((literal, index) => (
          <Box direction="col" gap={2} key={literal.id}>
            <FormField
              control={form.control}
              name={`enumValues.${index}.value`}>
              {({ field }) => (
                <Input
                  hideRequiredIndicator
                  isDisabled={disabled}
                  label={t('label.value')}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              )}
            </FormField>
            {getField({
              name: `enumValues.${index}.datatypeIri`,
              label: t('label.data-type'),
              type: FieldTypes.TEXT,
              props: { isDisabled: disabled },
              rules: {
                validate: (value: string) =>
                  !value.trim() ||
                  isAbsoluteOntologyIri(value.trim()) ||
                  t('message.invalid-concept-iri'),
              },
            })}
            <Button
              color="secondary"
              isDisabled={disabled}
              onPress={() => literals.remove(index)}>
              {t('label.remove')}
            </Button>
          </Box>
        ))}
        <Button
          color="secondary"
          isDisabled={disabled || literals.fields.length >= 1000}
          onPress={() => literals.append({ value: '', datatypeIri: '' })}>
          {t('label.add-entity', { entity: t('label.value') })}
        </Button>
      </Box>
    );

  const renderCharacteristics = (field?: FieldProp) =>
    field ? (
      <FormField control={form.control} name="characteristics">
        {({ field: { value, onChange } }) => (
          <Box
            aria-label={t('label.characteristic-plural')}
            direction="col"
            gap={3}
            role="group">
            <Typography size="text-sm" weight="medium">
              {t('label.characteristic-plural')}
            </Typography>
            {(field.props?.items ?? []).map((item) => (
              <Checkbox
                isDisabled={disabled}
                isSelected={isSelectedItem(value, item)}
                key={item.id}
                label={item.label}
                onChange={(checked) =>
                  onChange(toggleSelection(value, item, checked))
                }
              />
            ))}
          </Box>
        )}
      </FormField>
    ) : null;

  const renderAiForm = () => {
    const fields = keyBy(
      propertyFormFields(t, kind, Boolean(property), disabled),
      'name'
    );
    const renderFields = (names: string[]) =>
      names.map((name) =>
        fields[name] ? (
          <Fragment key={name}>{getField(fields[name])}</Fragment>
        ) : null
      );

    return (
      <HookForm
        data-testid="ontology-property-editor"
        form={form}
        onSubmit={form.handleSubmit(save)}>
        <Box direction="col" gap={5}>
          <Box direction="col" gap={1}>
            <Typography color="secondary" size="text-sm">
              {t('label.in-lowercase')} {getEntityName(ontology)}
            </Typography>
            <Typography
              as="h3"
              className="not-prose tw:m-0"
              size="text-lg"
              weight="semibold">
              {property
                ? getEntityName(property)
                : t('label.new-entity', { entity: t('label.property') })}
            </Typography>
          </Box>
          {renderFields(['name', 'displayName', 'kind', 'domain', 'range'])}
          {renderEnumValues()}
          {renderFields(['unit', 'isIdentifier', 'description'])}
          <details
            className="tw:border-t tw:border-secondary tw:pt-4"
            open={isAdvancedOpen}
            onToggle={(event) => setIsAdvancedOpen(event.currentTarget.open)}>
            <summary className="tw:cursor-pointer">
              <Typography as="span" size="text-sm" weight="semibold">
                {t('label.advanced')}
              </Typography>
            </summary>
            <Box className="tw:mt-4" direction="col" gap={4}>
              {renderCharacteristics(fields.characteristics)}
              {renderFields(ADVANCED_FIELDS.slice(1))}
            </Box>
          </details>
          <Box
            className="tw:border-t tw:border-secondary tw:pt-4"
            justify="end">
            <Button
              color="primary"
              isDisabled={!canEdit}
              isLoading={isSaving}
              size="sm"
              type="submit">
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      </HookForm>
    );
  };

  if (isAiMode) {
    return renderAiForm();
  }

  return (
    <HookForm
      data-testid="ontology-property-editor"
      form={form}
      onSubmit={form.handleSubmit(save)}>
      <Box direction="col" gap={4}>
        {propertyFormFields(t, kind, Boolean(property), disabled).map(
          (field) => (
            <Fragment key={field.name}>{getField(field)}</Fragment>
          )
        )}
        {renderEnumValues()}
        <Button isDisabled={!canEdit} isLoading={isSaving} type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default OntologyPropertyEditor;
