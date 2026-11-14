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
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConceptPropertyInput,
  ObjectPropertyInput,
} from '../../../../utils/governance/ontology/OntologyNativeRelation.utils';
import {
  DataPropertyInput,
  StudioDatatype,
  STUDIO_DATATYPES,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import OntologyIriInput from '../OntologyIriInput/OntologyIriInput';
import { OntologyIriOption } from '../OntologyIriInput/OntologyIriInput.types';
import { ConceptFormCard, ConceptFormPreview } from './OntologyConceptSection';

type PropertyKind = NonNullable<DataPropertyInput['kind']> | 'object';

interface PropertyDraft {
  datatype: StudioDatatype;
  enumValues: string;
  isIdentifier: boolean;
  kind: PropertyKind;
  name: string;
  /** The target concept an object property links to. */
  rangeIri: string;
  /** Empty string means "reuse" is chosen but nothing is picked yet. */
  reuseIri?: string;
}

const EMPTY_DRAFT: PropertyDraft = {
  datatype: 'string',
  enumValues: '',
  isIdentifier: false,
  kind: 'data',
  name: '',
  rangeIri: '',
};

const parseEnumValues = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const needsEnumValues = (draft: PropertyDraft) =>
  draft.kind === 'data' &&
  draft.datatype === 'enum' &&
  parseEnumValues(draft.enumValues).length === 0;

const needsRange = (draft: PropertyDraft) =>
  draft.kind === 'object' && !draft.rangeIri;

const canSubmitDraft = (draft: PropertyDraft) =>
  draft.reuseIri === undefined
    ? Boolean(draft.name.trim()) &&
      !needsEnumValues(draft) &&
      !needsRange(draft)
    : Boolean(draft.reuseIri);

const objectInput = (draft: PropertyDraft): ObjectPropertyInput => ({
  kind: 'object',
  name: draft.name,
  rangeIri: draft.rangeIri,
});

const dataInput = (draft: PropertyDraft): DataPropertyInput => ({
  datatype: draft.datatype,
  enumValues:
    draft.datatype === 'enum' ? parseEnumValues(draft.enumValues) : undefined,
  isIdentifier: draft.isIdentifier,
  kind: draft.kind === 'annotation' ? 'annotation' : 'data',
  name: draft.name,
  reusePropertyIri: draft.reuseIri || undefined,
});

const draftToInput = (draft: PropertyDraft): ConceptPropertyInput =>
  draft.kind === 'object' && draft.reuseIri === undefined
    ? objectInput(draft)
    : dataInput(draft);

const PROPERTY_KINDS: ReadonlyArray<{ id: PropertyKind; label: string }> = [
  { id: 'object', label: 'label.object' },
  { id: 'data', label: 'label.data' },
  { id: 'annotation', label: 'label.annotation' },
];

const KindPicker = ({
  isDisabled,
  kind,
  onSelect,
}: {
  isDisabled: boolean;
  kind: PropertyKind;
  onSelect: (kind: PropertyKind) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Select
      data-testid="ontology-property-kind"
      isDisabled={isDisabled}
      items={PROPERTY_KINDS.map(({ id, label }) => ({ id, label: t(label) }))}
      label={t('label.type')}
      size="sm"
      value={kind}
      onChange={(key) => key && onSelect(key as PropertyKind)}>
      {(item) => (
        <Select.Item
          data-testid={`ontology-property-kind-${item.id}`}
          id={item.id}
          key={item.id}
          label={item.label}
        />
      )}
    </Select>
  );
};

const RangeField = ({
  concepts,
  draft,
  isSaving,
  onChange,
}: {
  concepts: ReadonlyArray<OntologyIriOption>;
  draft: PropertyDraft;
  isSaving: boolean;
  onChange: (patch: Partial<PropertyDraft>) => void;
}) => {
  const { t } = useTranslation();

  if (draft.kind === 'annotation') {
    return (
      <Box direction="col" gap={2}>
        <Typography color="secondary" size="text-sm" weight="medium">
          {t('label.range')}
        </Typography>
        <Typography className="tw:py-2 tw:text-tertiary" size="text-sm">
          {t('message.ontology-annotation-no-range')}
        </Typography>
      </Box>
    );
  }

  return draft.kind === 'object' ? (
    <Select
      isDisabled={isSaving}
      items={concepts.map(({ iri, label }) => ({ id: iri, label }))}
      label={t('label.range')}
      placeholder={t('label.choose-concept')}
      size="sm"
      value={draft.rangeIri || null}
      onChange={(key) => onChange({ rangeIri: String(key ?? '') })}>
      {(item) => <Select.Item id={item.id} key={item.id} label={item.label} />}
    </Select>
  ) : (
    <Select
      isDisabled={isSaving}
      items={STUDIO_DATATYPES.map((id) => ({ id, label: id }))}
      label={t('label.range')}
      size="sm"
      value={draft.datatype}
      onChange={(key) =>
        key && onChange({ datatype: String(key) as StudioDatatype })
      }>
      {(item) => (
        <Select.Item
          data-testid={`ontology-property-type-${item.id}`}
          id={item.id}
          key={item.id}
          label={item.label}
        />
      )}
    </Select>
  );
};

const NewPropertyFields = ({
  concepts,
  draft,
  isSaving,
  onChange,
}: {
  concepts: ReadonlyArray<OntologyIriOption>;
  draft: PropertyDraft;
  isSaving: boolean;
  onChange: (patch: Partial<PropertyDraft>) => void;
}) => {
  const { t } = useTranslation();
  const isData = draft.kind === 'data';

  return (
    <>
      <Input
        inputDataTestId="ontology-property-name"
        isDisabled={isSaving}
        label={`${t('label.name')} · ${t(
          'message.ontology-property-name-hint'
        )}`}
        placeholder={t('message.ontology-property-name-placeholder')}
        size="sm"
        value={draft.name}
        onChange={(name) => onChange({ name })}
      />
      <div className="tw:grid tw:grid-cols-2 tw:items-start tw:gap-3">
        <KindPicker
          isDisabled={isSaving}
          kind={draft.kind}
          onSelect={(kind) => onChange({ kind })}
        />
        <RangeField
          concepts={concepts}
          draft={draft}
          isSaving={isSaving}
          onChange={onChange}
        />
      </div>
      {isData && draft.datatype === 'enum' ? (
        <Input
          inputDataTestId="ontology-property-enum-values"
          isDisabled={isSaving}
          label={t('label.enum-value-plural')}
          size="sm"
          value={draft.enumValues}
          onChange={(enumValues) => onChange({ enumValues })}
        />
      ) : null}
      {isData ? (
        <Checkbox
          data-testid="ontology-property-identifier"
          isDisabled={isSaving}
          isSelected={draft.isIdentifier}
          label={t('label.identifier')}
          onChange={(isIdentifier) => onChange({ isIdentifier })}
        />
      ) : null}
    </>
  );
};

const PropertyFields = ({
  concepts,
  domainLabel,
  draft,
  isSaving,
  reusable,
  onChange,
}: {
  concepts: ReadonlyArray<OntologyIriOption>;
  domainLabel: string;
  draft: PropertyDraft;
  isSaving: boolean;
  reusable: ReadonlyArray<OntologyIriOption>;
  onChange: (patch: Partial<PropertyDraft>) => void;
}) => {
  const { t } = useTranslation();
  const isReusing = draft.reuseIri !== undefined;

  return (
    <>
      {isReusing ? (
        <OntologyIriInput
          label={t('label.property')}
          options={reusable}
          testId="ontology-property-reuse"
          value={draft.reuseIri ?? ''}
          onChange={(reuseIri) => onChange({ reuseIri })}
        />
      ) : (
        <NewPropertyFields
          concepts={concepts}
          draft={draft}
          isSaving={isSaving}
          onChange={onChange}
        />
      )}
      <Box align="center" gap={2} justify="between">
        <Typography color="secondary" size="text-sm">
          {t('label.ontology-domain-classes')}:{' '}
          <Typography as="span" size="text-sm" weight="semibold">
            {domainLabel}
          </Typography>
        </Typography>
        <Button
          color="link-color"
          data-testid={
            isReusing
              ? 'ontology-property-source-new'
              : 'ontology-property-source-existing'
          }
          isDisabled={isSaving}
          size="sm"
          onPress={() => onChange({ reuseIri: isReusing ? undefined : '' })}>
          {t(
            isReusing
              ? 'label.ontology-create-new-property'
              : 'label.ontology-use-existing-property'
          )}
        </Button>
      </Box>
    </>
  );
};

const PropertyActions = ({
  canSubmit,
  isSaving,
  onCancel,
  onSubmit,
}: {
  canSubmit: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box gap={2} justify="end">
      <Button
        color="secondary"
        isDisabled={isSaving}
        size="sm"
        onPress={onCancel}>
        {t('label.cancel')}
      </Button>
      <Button
        color="primary"
        data-testid="ontology-property-submit"
        isDisabled={!canSubmit}
        isLoading={isSaving}
        size="sm"
        onPress={onSubmit}>
        {t('label.ontology-add-property')}
      </Button>
    </Box>
  );
};

const PropertyPreview = ({
  concepts,
  domainLabel,
  draft,
}: {
  concepts: ReadonlyArray<OntologyIriOption>;
  domainLabel: string;
  draft: PropertyDraft;
}) => {
  const { t } = useTranslation();
  if (draft.reuseIri !== undefined) {
    return null;
  }
  const name = draft.name.trim();
  const target = concepts.find(({ iri }) => iri === draft.rangeIri)?.label;
  let sentence = t('message.ontology-property-preview-empty');
  if (name && draft.kind === 'annotation') {
    sentence = t('message.ontology-property-preview-annotation', { name });
  } else if (name && draft.kind === 'data') {
    sentence = t('message.ontology-property-preview-data', {
      concept: domainLabel,
      datatype: draft.datatype,
      name,
    });
  } else if (name && target) {
    sentence = t('message.ontology-property-preview-object', {
      concept: domainLabel,
      name,
      target,
    });
  }

  return <ConceptFormPreview>{sentence}</ConceptFormPreview>;
};

interface OntologyPropertyAuthoringProps {
  readonly isAvailable: boolean;
  readonly isOpen: boolean;
  readonly reusable: ReadonlyArray<OntologyIriOption>;
  /** Concepts an object property can link to. */
  readonly concepts?: ReadonlyArray<OntologyIriOption>;
  /** The concept the new property is declared on. */
  readonly domainLabel: string;
  readonly onClose: () => void;
  readonly onSave: (input: ConceptPropertyInput) => Promise<boolean>;
}

const OntologyPropertyAuthoring = ({
  isAvailable,
  isOpen,
  reusable,
  concepts = [],
  domainLabel,
  onClose,
  onSave,
}: OntologyPropertyAuthoringProps) => {
  const [draft, setDraft] = useState<PropertyDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const change = (patch: Partial<PropertyDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    setIsSaving(true);
    const saved = await onSave(draftToInput(draft));
    setIsSaving(false);
    if (saved) {
      setDraft(EMPTY_DRAFT);
      onClose();
    }
  };

  if (!isAvailable || !isOpen) {
    return null;
  }
  const fields = (
    <PropertyFields
      concepts={concepts}
      domainLabel={domainLabel}
      draft={draft}
      isSaving={isSaving}
      reusable={reusable}
      onChange={change}
    />
  );
  const actions = (
    <PropertyActions
      canSubmit={canSubmitDraft(draft)}
      isSaving={isSaving}
      onCancel={onClose}
      onSubmit={() => void save()}
    />
  );

  return (
    <ConceptFormCard testId="ontology-property-form">
      {fields}
      <PropertyPreview
        concepts={concepts}
        domainLabel={domainLabel}
        draft={draft}
      />
      {actions}
    </ConceptFormCard>
  );
};

export default OntologyPropertyAuthoring;
