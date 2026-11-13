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
  Divider,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  getField,
  HookForm,
  Input,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { keyBy } from 'lodash';
import { Fragment, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  Characteristic,
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import {
  createOntologyProperty,
  patchOntologyProperty,
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
  propertyRequest,
} from './OntologyPropertyEditor.utils';

const ADVANCED_FIELDS = [
  'superProperties',
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

// The design's order: the common ones first, the rarely needed reflexive pair last.
const CHARACTERISTIC_ORDER = [
  Characteristic.Functional,
  Characteristic.InverseFunctional,
  Characteristic.Symmetric,
  Characteristic.Asymmetric,
  Characteristic.Transitive,
  Characteristic.Reflexive,
  Characteristic.Irreflexive,
];
const CHARACTERISTIC_LABELS: Record<Characteristic, string> = {
  [Characteristic.Functional]: 'label.functional',
  [Characteristic.InverseFunctional]: 'label.inverse-functional',
  [Characteristic.Symmetric]: 'label.symmetric',
  [Characteristic.Asymmetric]: 'label.asymmetric',
  [Characteristic.Transitive]: 'label.transitive',
  [Characteristic.Reflexive]: 'label.reflexive',
  [Characteristic.Irreflexive]: 'label.irreflexive',
};
const CHARACTERISTIC_HINTS: Record<Characteristic, string> = {
  [Characteristic.Functional]:
    'message.ontology-characteristic-functional-hint',
  [Characteristic.InverseFunctional]:
    'message.ontology-characteristic-inverse-functional-hint',
  [Characteristic.Symmetric]: 'message.ontology-characteristic-symmetric-hint',
  [Characteristic.Asymmetric]:
    'message.ontology-characteristic-asymmetric-hint',
  [Characteristic.Transitive]:
    'message.ontology-characteristic-transitive-hint',
  [Characteristic.Reflexive]: 'message.ontology-characteristic-reflexive-hint',
  [Characteristic.Irreflexive]:
    'message.ontology-characteristic-irreflexive-hint',
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
  /** Closes the drawer; without one, Cancel puts the saved values back. */
  onCancel?: () => void;
}

type IriListField = 'domain' | 'range' | 'superProperties';

const IRI_LIST_LABEL_KEYS: Record<IriListField, string> = {
  domain: 'label.property-domain',
  range: 'label.range',
  superProperties: 'label.super-property-plural',
};
const IRI_LIST_HINT_KEYS: Record<IriListField, string> = {
  domain: 'message.ontology-property-domain-help',
  range: 'message.ontology-property-range-help',
  superProperties: 'message.ontology-property-super-help',
};

const OntologyPropertyEditor = ({
  ontology,
  property,
  canEdit,
  concepts,
  properties,
  onSaved,
  onCancel,
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
          hint={t(IRI_LIST_HINT_KEYS[name])}
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

  // The design's bordered list: each characteristic says what it means in one line.
  const renderCharacteristics = (field?: FieldProp) => {
    if (!field) {
      return null;
    }
    const offered = new Set(
      (field.props?.items ?? []).map((item: { id: string }) => item.id)
    );

    return (
      <FormField control={form.control} name="characteristics">
        {({ field: { value, onChange } }) => (
          <Box
            aria-label={t('label.characteristic-plural')}
            direction="col"
            gap={2}
            role="group">
            <Box direction="col">
              <Typography
                className="tw:text-secondary"
                size="text-sm"
                weight="medium">
                {t('label.characteristic-plural')}
              </Typography>
              <Typography color="secondary" size="text-sm">
                {t('message.ontology-property-characteristics-help')}
              </Typography>
            </Box>
            <Box
              className="tw:divide-y tw:divide-secondary tw:rounded-lg tw:border tw:border-secondary"
              direction="col">
              {CHARACTERISTIC_ORDER.filter((id) => offered.has(id)).map(
                (id) => (
                  <div className="tw:px-3.5 tw:py-3" key={id}>
                    <Checkbox
                      hint={t(CHARACTERISTIC_HINTS[id])}
                      isDisabled={disabled}
                      isSelected={isSelectedItem(value, { id })}
                      label={t(CHARACTERISTIC_LABELS[id])}
                      onChange={(checked) =>
                        onChange(
                          toggleSelection(
                            value,
                            { id, label: id } as { id: string },
                            checked
                          )
                        )
                      }
                    />
                  </div>
                )
              )}
            </Box>
          </Box>
        )}
      </FormField>
    );
  };

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

  const labelsOf = (iris: string, options?: ReadonlyArray<OntologyIriOption>) =>
    iris
      .split('\n')
      .filter(Boolean)
      .map((iri) => options?.find((option) => option.iri === iri)?.label ?? iri)
      .join(', ');
  // A sentence of what the property links, once it has a name and a range to read.
  const renderPreview = () => {
    const name = form.watch('name').trim();
    const range = labelsOf(form.watch('range'), iriListOptions('range'));
    const domain = labelsOf(form.watch('domain'), concepts);

    return (
      <Box
        align="center"
        className="tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2.5"
        data-testid="ontology-property-preview"
        gap={2}>
        <ArrowRight
          aria-hidden
          className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
        />
        <Typography color="secondary" size="text-sm">
          {name && range
            ? [domain, name, range].filter(Boolean).join(' → ')
            : t('message.ontology-property-preview-empty')}
        </Typography>
      </Box>
    );
  };

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
        <Divider />
        <Typography
          className="tw:uppercase tw:tracking-wide"
          color="secondary"
          size="text-xs"
          weight="semibold">
          {t('label.meaning')}
        </Typography>
        {renderIriList('domain')}
        {renderIriList('range')}
        {renderPreview()}
        {renderEnumValues()}
        {renderFields(['unit', 'isIdentifier'])}
        <Divider />
        {/* Same disclosure as the create and settings dialogs: chevron, "Advanced", what it holds. */}
        <button
          aria-controls="ontology-property-advanced"
          aria-expanded={isAdvancedOpen}
          className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:outline-focus-ring tw:focus-visible:outline-2"
          data-testid="ontology-property-advanced-toggle"
          type="button"
          onClick={() => setIsAdvancedOpen((open) => !open)}>
          {isAdvancedOpen ? (
            <ChevronDown
              aria-hidden
              className="tw:size-4 tw:shrink-0 tw:text-secondary"
            />
          ) : (
            <ChevronRight
              aria-hidden
              className="tw:size-4 tw:shrink-0 tw:text-secondary"
            />
          )}
          <Typography size="text-sm" weight="semibold">
            {t('label.advanced')}
          </Typography>
          <Typography color="quaternary" size="text-sm">
            {t('message.ontology-property-advanced-fields')}
          </Typography>
        </button>
        {/* Kept mounted while collapsed, as a closed <details> was, so its fields still validate. */}
        <Box
          className={isAdvancedOpen ? undefined : 'tw:hidden'}
          data-testid="ontology-property-advanced"
          direction="col"
          gap={4}
          id="ontology-property-advanced">
          {renderIriList('superProperties')}
          {renderCharacteristics(fields.characteristics)}
          {renderFields(ADVANCED_FIELDS.slice(2))}
        </Box>
        <OntologyFormFooter
          canSubmit={
            canEdit &&
            (property
              ? form.formState.isDirty
              : Boolean(form.watch('name').trim()))
          }
          isDirty={form.formState.isDirty}
          isSaving={isSaving}
          submitLabel={
            property
              ? t('label.save')
              : t('label.create-entity', { entity: t('label.property') })
          }
          testId="ontology-property-footer"
          onCancel={onCancel ?? (() => form.reset())}
        />
      </Box>
    </HookForm>
  );
};

export default OntologyPropertyEditor;
