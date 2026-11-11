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
    FormItemLabel,
    getField,
    HookForm,
    Input,
    RadioButton,
    RadioGroup,
    Typography
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { keyBy } from 'lodash';
import { Fragment, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
    Kind,
    OntologyProperty
} from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import {
    createOntologyProperty,
    patchOntologyProperty
} from '../../../../rest/ontologyAPI';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyFormFooter from '../OntologyFormFooter/OntologyFormFooter';
import { ONTOLOGY_DATATYPE_OPTIONS } from '../OntologyIriInput/OntologyIriInput.constants';
import { OntologyIriOption } from '../OntologyIriInput/OntologyIriInput.types';
import OntologyIriListInput from '../OntologyIriInput/OntologyIriListInput';
import {
    OntologyPropertyFormValues,
    propertyFormFields,
    propertyFormValues,
    propertyPatch,
    propertyRequest
} from './OntologyPropertyEditor.utils';

const ADVANCED_FIELDS = [
  'characteristics',
  'inverse',
  'disjointWith',
  'propertyChain',
  'iri',
];

const KIND_HINTS: Record<Kind, string> = {
  [Kind.Object]: 'message.ontology-property-kind-object-hint',
  [Kind.Data]: 'message.ontology-property-kind-data-hint',
  [Kind.Annotation]: 'message.ontology-property-kind-annotation-hint',
};
const KIND_ORDER = [Kind.Object, Kind.Data, Kind.Annotation];
const BASIC_FIELD_HELP: Record<string, string> = {
  name: 'message.ontology-property-name-help',
  displayName: 'message.ontology-property-display-name-help',
  description: 'message.ontology-property-description-help',
};

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
  concepts?: ReadonlyArray<OntologyIriOption>;
  properties?: ReadonlyArray<OntologyIriOption & { kind: Kind }>;
  onSaved: (property: OntologyProperty) => void;
}

type IriListField = 'domain' | 'range' | 'superProperties';

const IRI_LIST_LABEL_KEYS: Record<IriListField, string> = {
  domain: 'label.property-domain',
  range: 'label.range',
  superProperties: 'label.super-property-plural',
};

const OntologyPropertyEditor = ({
  ontology,
  property,
  canEdit,
  concepts,
  properties,
  onSaved,
}: OntologyPropertyEditorProps) => {
  const { t } = useTranslation();
  const form = useForm<OntologyPropertyFormValues>({
    defaultValues: propertyFormValues(property),
  });
  const markSaved = useOntologyDirtyForm(form.formState.isDirty);
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
      const saved = property
        ? await patchOntologyProperty(
            property.id,
            propertyPatch(property, request)
          )
        : await createOntologyProperty(request);
      form.reset(propertyFormValues(saved));
      markSaved();
      onSaved(saved);
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // A superproperty must share the property's kind, and a property cannot specialize itself.
  const iriListOptions = (name: IriListField) => {
    if (name === 'superProperties') {
      return properties?.filter(
        (option) => option.kind === kind && option.iri !== property?.iri
      );
    }

    return name === 'range' && kind === Kind.Data
      ? ONTOLOGY_DATATYPE_OPTIONS
      : concepts;
  };

  const renderIriList = (name: IriListField) => (
    <FormField control={form.control} name={name}>
      {({ field }) => (
        <OntologyIriListInput
          isDisabled={disabled}
          label={t(IRI_LIST_LABEL_KEYS[name])}
          options={iriListOptions(name)}
          testId={`ontology-property-${name}`}
          value={field.value.split('\n').filter(Boolean)}
          onChange={(iris) => field.onChange(iris.join('\n'))}
        />
      )}
    </FormField>
  );

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

  const renderKind = (field: FieldProp) => (
    <FormField control={form.control} name="kind">
      {({ field: { value, onChange } }) => (
        <Box direction="col" gap={1}>
          <FormItemLabel label={field.label} required={field.required} />
          <Typography color="secondary" size="text-sm">
            {t('message.ontology-property-kind-help')}
          </Typography>
          <RadioGroup
            aria-label={t('label.type')}
            className="tw:mt-1.5"
            data-testid="ontology-property-kind"
            isDisabled={field.props?.isDisabled}
            value={value.id}
            onChange={(id) => onChange({ id: id as Kind, label: id })}>
            {KIND_ORDER.map((option) => (
              <RadioButton
                hint={t(KIND_HINTS[option])}
                key={option}
                label={t(`label.${option.toLocaleLowerCase()}`)}
                value={option}
                variant="card"
              />
            ))}
          </RadioGroup>
        </Box>
      )}
    </FormField>
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

  const fields = keyBy(
    propertyFormFields(t, kind, Boolean(property), disabled),
    'name'
  );
  // Label, then a plain helper line, then the input: the field keeps its label as its name.
  const renderWithHelp = (field: FieldProp) => (
    <Box direction="col" gap={1} key={field.name}>
      <FormItemLabel label={field.label} required={field.required} />
      <Typography color="secondary" size="text-sm">
        {t(BASIC_FIELD_HELP[field.name])}
      </Typography>
      <div className="tw:mt-1">
        {getField({
          ...field,
          label: undefined,
          required: false,
          rules: field.rules,
          props: { ...field.props, 'aria-label': String(field.label) },
        })}
      </div>
    </Box>
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
        <Typography
          as="h3"
          className="not-prose tw:m-0"
          size="text-sm"
          weight="semibold">
          {t('label.basics')}
        </Typography>
        {['name', 'displayName', 'description'].map((name) =>
          renderWithHelp(fields[name])
        )}
        {renderKind(fields.kind)}
        {renderIriList('domain')}
        {renderIriList('range')}
        {renderIriList('superProperties')}
        {renderEnumValues()}
        {renderFields(['unit', 'isIdentifier'])}
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
        <OntologyFormFooter
          canSubmit={canEdit}
          isDirty={form.formState.isDirty}
          isSaving={isSaving}
          submitLabel={
            property
              ? t('label.save')
              : t('label.create-entity', { entity: t('label.property') })
          }
          testId="ontology-property-footer"
          onCancel={() => form.reset()}
        />
      </Box>
    </HookForm>
  );
};

export default OntologyPropertyEditor;
