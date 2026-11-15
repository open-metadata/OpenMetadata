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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { isEmpty, omit } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTermProperty } from '../../../../generated/type/glossaryTermProperty';
import { useGlossaryTermPropertyPatch } from '../../../../hooks/governance/glossary/useGlossaryTermPropertyPatch';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  GlossaryTermPropertyDraft,
  GlossaryTermPropertyDraftErrors,
  GlossaryTermPropertyMode,
  GlossaryTermWithProperties,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import {
  buildAddPropertyPatch,
  buildEditPropertyPatch,
  buildOverridePatch,
  buildPropertyDefinition,
  EMPTY_PROPERTY_DRAFT,
  fromPropertyValues,
  getPropertyLabel,
  getTermPropertyNames,
  parseEnumValues,
  toPropertyValues,
  validatePropertyDraft,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.utils';
import GlossaryTermPropertyFields from './GlossaryTermPropertyFields';

interface GlossaryTermPropertyModalProps {
  term: GlossaryTermWithProperties;
  mode: GlossaryTermPropertyMode;
  /** Name of the property being edited or overridden. */
  propertyName?: string;
  onClose: () => void;
}

const getInitialDraft = (
  term: GlossaryTermWithProperties,
  mode: GlossaryTermPropertyMode,
  propertyName?: string
): GlossaryTermPropertyDraft => {
  if (mode === 'new') {
    return EMPTY_PROPERTY_DRAFT;
  }
  const entry = term.effectiveProperties?.find(
    (candidate) => candidate.property.name === propertyName
  );
  if (!entry) {
    return EMPTY_PROPERTY_DRAFT;
  }
  const { property } = entry;

  return {
    displayName: property.displayName ?? property.name,
    datatype: property.datatype,
    enumValuesText: (property.enumValues ?? []).join(', '),
    // An override starts from the value the term shows now, so a tweak is one edit away.
    value: fromPropertyValues(property, entry.values),
    description: property.description ?? '',
  };
};

const GlossaryTermPropertyModal = ({
  term,
  mode,
  propertyName,
  onClose,
}: GlossaryTermPropertyModalProps) => {
  const { t } = useTranslation();
  const { applyPatch, isSaving } = useGlossaryTermPropertyPatch(term);
  const [draft, setDraft] = useState(() =>
    getInitialDraft(term, mode, propertyName)
  );
  const [errors, setErrors] = useState<GlossaryTermPropertyDraftErrors>({});

  const entry = useMemo(
    () =>
      mode === 'new'
        ? undefined
        : term.effectiveProperties?.find(
            (candidate) => candidate.property.name === propertyName
          ),
    [mode, term.effectiveProperties, propertyName]
  );
  const existing: GlossaryTermProperty | undefined = entry?.property;
  const takenNames = useMemo(() => getTermPropertyNames(term), [term]);
  const isNew = mode === 'new';
  const isOverride = mode === 'override';
  const valueProperty = {
    datatype: existing?.datatype ?? draft.datatype,
    enumValues: isOverride
      ? existing?.enumValues
      : parseEnumValues(draft.enumValuesText),
    multiValued: existing?.multiValued,
  };
  const nameValue =
    isOverride && existing ? getPropertyLabel(existing) : draft.displayName;

  const updateDraft = (changes: Partial<GlossaryTermPropertyDraft>) =>
    setDraft((previous) => ({ ...previous, ...changes }));

  const title = {
    new: t('label.add-property'),
    edit: t('label.edit-property'),
    override: t('label.override-inherited-value'),
  }[mode];
  const termName = getEntityName(term);
  const subtitle = {
    new: t('message.glossary-term-property-add-subtitle', { term: termName }),
    edit: t('message.glossary-term-property-edit-subtitle'),
    override: t('message.glossary-term-property-override-subtitle', {
      term: entry ? getEntityName(entry.declaredBy) : '',
    }),
  }[mode];
  const note = isNew
    ? t('message.glossary-term-property-type-locked-note')
    : undefined;

  const handleSubmit = async () => {
    const nextErrors = validatePropertyDraft({
      draft,
      mode,
      takenNames,
      existing,
    });
    setErrors(nextErrors);
    if (!isEmpty(nextErrors)) {
      return;
    }

    const definition = buildPropertyDefinition({
      ...draft,
      datatype: existing?.datatype ?? draft.datatype,
    });
    const values = toPropertyValues(valueProperty, draft.value);
    const saved = await applyPatch((current) => {
      if (isNew) {
        return buildAddPropertyPatch(current, definition, values);
      }
      if (isOverride) {
        return buildOverridePatch(current, existing?.name ?? '', values);
      }

      // Fields the form can clear must not survive from the old definition.
      const kept = omit(existing as GlossaryTermProperty, [
        'description',
        'displayName',
        'enumValues',
      ]) as GlossaryTermProperty;

      return buildEditPropertyPatch(
        current,
        kept.name,
        { ...kept, ...definition, name: kept.name },
        values
      );
    });
    if (saved) {
      onClose();
    }
  };

  const valueLabel = {
    new: t('label.default-value'),
    edit: t('label.value'),
    override: t('label.value-for-this-term'),
  }[mode];

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isSaving}
      onOpenChange={(isOpen) => !isOpen && !isSaving && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          dividers="scroll"
          title={title}
          width={520}
          onClose={onClose}>
          <Dialog.Content>
            <GlossaryTermPropertyFields
              draft={draft}
              errors={errors}
              mode={mode}
              nameValue={nameValue}
              note={note}
              subtitle={subtitle}
              valueLabel={valueLabel}
              valueProperty={valueProperty}
              onChange={updateDraft}
            />
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="property-cancel"
              isDisabled={isSaving}
              onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="property-save"
              isLoading={isSaving}
              onPress={handleSubmit}>
              {isNew ? t('label.add-property') : t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default GlossaryTermPropertyModal;
