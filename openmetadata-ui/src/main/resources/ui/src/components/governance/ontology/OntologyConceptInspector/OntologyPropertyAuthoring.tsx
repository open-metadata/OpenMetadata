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
  humanizeName,
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

const ToggleGroup = <T extends string>({
  ariaLabel,
  isDisabled,
  items,
  selected,
  testIdPrefix,
  onSelect,
}: {
  ariaLabel: string;
  isDisabled: boolean;
  items: ReadonlyArray<{ id: T; label: string }>;
  selected: T;
  testIdPrefix: string;
  onSelect: (id: T) => void;
}) => (
  <div
    aria-label={ariaLabel}
    className="tw:flex tw:flex-wrap tw:gap-1.5"
    role="group">
    {items.map(({ id, label }) => (
      <Button
        aria-pressed={selected === id}
        color={selected === id ? 'primary' : 'secondary'}
        data-testid={`${testIdPrefix}-${id}`}
        isDisabled={isDisabled}
        key={id}
        size="xs"
        onPress={() => onSelect(id)}>
        {label}
      </Button>
    ))}
  </div>
);

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
      <ToggleGroup
        ariaLabel={t('label.type')}
        isDisabled={isSaving}
        items={[
          { id: 'object', label: t('label.object') },
          { id: 'data', label: t('label.data') },
          { id: 'annotation', label: t('label.annotation') },
        ]}
        selected={draft.kind}
        testIdPrefix="ontology-property-kind"
        onSelect={(kind) => onChange({ kind })}
      />
      <Input
        inputDataTestId="ontology-property-name"
        isDisabled={isSaving}
        label={t('label.name')}
        size="sm"
        value={draft.name}
        onChange={(name) => onChange({ name })}
      />
      {draft.kind === 'object' ? (
        <Select
          isDisabled={isSaving}
          items={concepts.map(({ iri, label }) => ({ id: iri, label }))}
          label={t('label.range')}
          placeholder={t('label.choose-concept')}
          size="sm"
          value={draft.rangeIri || null}
          onChange={(key) => onChange({ rangeIri: String(key ?? '') })}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
      ) : null}
      {isData ? (
        <>
          <Typography color="secondary" size="text-xs" weight="semibold">
            {t('label.data-type')}
          </Typography>
          <ToggleGroup
            ariaLabel={t('label.data-type')}
            isDisabled={isSaving}
            items={STUDIO_DATATYPES.map((id) => ({ id, label: id }))}
            selected={draft.datatype}
            testIdPrefix="ontology-property-type"
            onSelect={(datatype) => onChange({ datatype })}
          />
          {draft.datatype === 'enum' ? (
            <Input
              inputDataTestId="ontology-property-enum-values"
              isDisabled={isSaving}
              label={t('label.enum-value-plural')}
              size="sm"
              value={draft.enumValues}
              onChange={(enumValues) => onChange({ enumValues })}
            />
          ) : null}
          <Checkbox
            data-testid="ontology-property-identifier"
            isDisabled={isSaving}
            isSelected={draft.isIdentifier}
            label={t('label.identifier')}
            onChange={(isIdentifier) => onChange({ isIdentifier })}
          />
        </>
      ) : null}
    </>
  );
};

const PropertyFields = ({
  concepts,
  draft,
  isSaving,
  reusable,
  onChange,
}: {
  concepts: ReadonlyArray<OntologyIriOption>;
  draft: PropertyDraft;
  isSaving: boolean;
  reusable: ReadonlyArray<OntologyIriOption>;
  onChange: (patch: Partial<PropertyDraft>) => void;
}) => {
  const { t } = useTranslation();
  const isReusing = draft.reuseIri !== undefined;

  return (
    <>
      <ToggleGroup
        ariaLabel={t('label.property')}
        isDisabled={isSaving}
        items={[
          { id: 'new', label: t('label.new') },
          { id: 'existing', label: t('label.existing') },
        ]}
        selected={isReusing ? 'existing' : 'new'}
        testIdPrefix="ontology-property-source"
        onSelect={(source) =>
          onChange({ reuseIri: source === 'existing' ? '' : undefined })
        }
      />
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
        {t('label.add-entity', { entity: t('label.property') })}
      </Button>
    </Box>
  );
};

const PropertyPreview = ({ draft }: { draft: PropertyDraft }) => {
  const { t } = useTranslation();
  if (!draft.name.trim() || draft.reuseIri !== undefined) {
    return null;
  }

  return (
    <ConceptFormPreview>
      {humanizeName(draft.name)} ·{' '}
      {draft.kind === 'data' ? draft.datatype : t(`label.${draft.kind}`)}
    </ConceptFormPreview>
  );
};

interface OntologyPropertyAuthoringProps {
  readonly isAvailable: boolean;
  readonly isOpen: boolean;
  readonly reusable: ReadonlyArray<OntologyIriOption>;
  /** Concepts an object property can link to. */
  readonly concepts?: ReadonlyArray<OntologyIriOption>;
  readonly onClose: () => void;
  readonly onSave: (input: ConceptPropertyInput) => Promise<boolean>;
}

const OntologyPropertyAuthoring = ({
  isAvailable,
  isOpen,
  reusable,
  concepts = [],
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
      <PropertyPreview draft={draft} />
      {actions}
    </ConceptFormCard>
  );
};

export default OntologyPropertyAuthoring;
