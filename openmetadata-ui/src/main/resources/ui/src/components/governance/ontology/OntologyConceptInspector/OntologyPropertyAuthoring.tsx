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
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  DataPropertyInput,
  humanizeName,
  StudioDatatype,
  STUDIO_DATATYPES,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import OntologyIriInput from '../OntologyIriInput/OntologyIriInput';
import { OntologyIriOption } from '../OntologyIriInput/OntologyIriInput.types';
import { ConceptFormCard, ConceptFormPreview } from './OntologyConceptSection';

type PropertyKind = NonNullable<DataPropertyInput['kind']>;

interface PropertyDraft {
  datatype: StudioDatatype;
  enumValues: string;
  isIdentifier: boolean;
  kind: PropertyKind;
  name: string;
  /** Empty string means "reuse" is chosen but nothing is picked yet. */
  reuseIri?: string;
}

const EMPTY_DRAFT: PropertyDraft = {
  datatype: 'string',
  enumValues: '',
  isIdentifier: false,
  kind: 'data',
  name: '',
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

const canSubmitDraft = (draft: PropertyDraft) =>
  draft.reuseIri === undefined
    ? Boolean(draft.name.trim()) && !needsEnumValues(draft)
    : Boolean(draft.reuseIri);

const draftToInput = (draft: PropertyDraft): DataPropertyInput => ({
  datatype: draft.datatype,
  enumValues:
    draft.datatype === 'enum' ? parseEnumValues(draft.enumValues) : undefined,
  isIdentifier: draft.isIdentifier,
  kind: draft.kind,
  name: draft.name,
  reusePropertyIri: draft.reuseIri || undefined,
});

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
  draft,
  isSaving,
  onChange,
}: {
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
  draft,
  isSaving,
  reusable,
  onChange,
}: {
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
  isAiMode,
  isSaving,
  onCancel,
  onSubmit,
}: {
  canSubmit: boolean;
  isAiMode: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) => {
  const { t } = useTranslation();
  const size = isAiMode ? 'sm' : 'xs';
  const cancel = (
    <Button
      color="secondary"
      isDisabled={isSaving}
      size={size}
      onPress={onCancel}>
      {t('label.cancel')}
    </Button>
  );

  return (
    <Box gap={2} justify={isAiMode ? 'end' : 'start'}>
      {isAiMode ? cancel : null}
      <Button
        color="primary"
        data-testid="ontology-property-submit"
        isDisabled={!canSubmit}
        isLoading={isSaving}
        size={size}
        onPress={onSubmit}>
        {isAiMode
          ? t('label.add-entity', { entity: t('label.property') })
          : t('label.add')}
      </Button>
      {isAiMode ? null : cancel}
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
      {draft.kind === 'data' ? draft.datatype : t('label.annotation')}
    </ConceptFormPreview>
  );
};

interface OntologyPropertyAuthoringProps {
  readonly isAvailable: boolean;
  readonly isOpen: boolean;
  readonly reusable: ReadonlyArray<OntologyIriOption>;
  readonly onClose: () => void;
  readonly onOpen: () => void;
  readonly onSave: (input: DataPropertyInput) => Promise<boolean>;
}

const OntologyPropertyAuthoring = ({
  isAvailable,
  isOpen,
  reusable,
  onClose,
  onOpen,
  onSave,
}: OntologyPropertyAuthoringProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
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

  if (!isAvailable || (isAiMode && !isOpen)) {
    return null;
  }
  if (!isOpen) {
    return (
      <Button
        color="secondary"
        data-testid="ontology-add-property"
        iconLeading={Plus}
        size="xs"
        onPress={onOpen}>
        {t('label.add-entity', { entity: t('label.property') })}
      </Button>
    );
  }
  const fields = (
    <PropertyFields
      draft={draft}
      isSaving={isSaving}
      reusable={reusable}
      onChange={change}
    />
  );
  const actions = (
    <PropertyActions
      canSubmit={canSubmitDraft(draft)}
      isAiMode={isAiMode}
      isSaving={isSaving}
      onCancel={onClose}
      onSubmit={() => void save()}
    />
  );

  return isAiMode ? (
    <ConceptFormCard testId="ontology-property-form">
      {fields}
      <PropertyPreview draft={draft} />
      {actions}
    </ConceptFormCard>
  ) : (
    <Box
      className="tw:rounded-lg tw:border tw:border-dashed tw:border-secondary tw:bg-secondary tw:p-3"
      direction="col"
      gap={3}>
      {fields}
      {actions}
    </Box>
  );
};

export default OntologyPropertyAuthoring;
