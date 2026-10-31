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
  Badge,
  Box,
  Button,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { Fragment, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  ConceptMappingType,
  OntologyConcept,
} from '../../../../generated/entity/data/ontologyConcept';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  createOntologyConcept,
  patchOntologyConcept,
} from '../../../../rest/ontologyAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  conceptFormFields,
  conceptFormValues,
  conceptPatch,
  conceptRequest,
  mappingFormFields,
  OntologyConceptFormValues,
} from './OntologyConceptEditor.utils';

interface OntologyConceptEditorProps {
  ontology: Ontology;
  concept?: OntologyConcept;
  canEdit: boolean;
  onSaved: (concept: OntologyConcept) => void;
}

const OntologyConceptEditor = ({
  ontology,
  concept,
  canEdit,
  onSaved,
}: OntologyConceptEditorProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const form = useForm<OntologyConceptFormValues>({
    defaultValues: conceptFormValues(concept),
  });
  const markSaved = useOntologyDirtyForm(form.formState.isDirty);
  const [isSaving, setIsSaving] = useState(false);
  const mappings = useFieldArray({
    control: form.control,
    name: 'conceptMappings',
  });
  const addMappingButton = useRef<HTMLButtonElement>(null);
  const disabled = !canEdit || isSaving;

  const save = async (values: OntologyConceptFormValues) => {
    if (!canEdit) {
      return;
    }
    setIsSaving(true);
    try {
      const request = conceptRequest(values, ontology.fullyQualifiedName);
      const result = concept
        ? await patchOntologyConcept(concept.id, conceptPatch(concept, request))
        : await createOntologyConcept(request);
      form.reset(conceptFormValues(result));
      markSaved();
      onSaved(result);
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const appendMapping = () =>
    mappings.append({
      conceptIri: '',
      mappingType: {
        id: ConceptMappingType.ExactMatch,
        label: ConceptMappingType.ExactMatch,
      },
      schemeIri: '',
      source: '',
    });

  const renderFields = () =>
    conceptFormFields(t, Boolean(concept), disabled).map((field) => (
      <Fragment key={field.name}>{getField(field)}</Fragment>
    ));

  const renderMappingFields = (index: number) => (
    <>
      {mappingFormFields(t, index, disabled).map((field) => (
        <Fragment key={field.name}>{getField(field)}</Fragment>
      ))}
    </>
  );

  const removeMapping = (index: number) => {
    mappings.remove(index);
    addMappingButton.current?.focus();
  };

  if (isAiMode) {
    return (
      <HookForm
        data-testid="ontology-concept-editor"
        form={form}
        onSubmit={form.handleSubmit(save)}>
        <Box direction="col" gap={5}>
          {renderFields()}
          <Box
            className="tw:border-t tw:border-secondary tw:pt-5"
            direction="col"
            gap={3}>
            <Box align="center" gap={2}>
              <Typography
                as="h3"
                className="not-prose tw:m-0"
                size="text-sm"
                weight="semibold">
                {t('label.mapping-plural')}
              </Typography>
              <Badge color="gray" size="sm" type="pill-color">
                {mappings.fields.length}
              </Badge>
              <Button
                className="tw:ml-auto"
                color="link-color"
                iconLeading={Plus}
                isDisabled={disabled}
                ref={addMappingButton}
                size="sm"
                onPress={appendMapping}>
                {t('label.add-mapping')}
              </Button>
            </Box>
            {mappings.fields.map((mapping, index) => (
              <fieldset
                className="tw:m-0 tw:rounded-xl tw:border tw:border-secondary tw:p-4"
                data-testid="ontology-concept-mapping"
                key={mapping.id}>
                <legend className="tw:px-1 tw:text-xs tw:font-semibold tw:text-secondary">
                  {t('label.mapping')} {index + 1}
                </legend>
                <Box direction="col" gap={3}>
                  {renderMappingFields(index)}
                  <Box justify="end">
                    <Button
                      color="secondary"
                      isDisabled={disabled}
                      size="sm"
                      onPress={() => removeMapping(index)}>
                      {t('label.remove')}
                    </Button>
                  </Box>
                </Box>
              </fieldset>
            ))}
          </Box>
          <Box
            align="center"
            className="tw:sticky tw:bottom-0 tw:border-t tw:border-secondary tw:bg-surface tw:py-3"
            gap={2}>
            <Typography className="tw:flex-1 tw:text-tertiary" size="text-xs">
              {form.formState.isDirty ? t('label.unsaved-changes') : null}
            </Typography>
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
  }

  return (
    <HookForm
      data-testid="ontology-concept-editor"
      form={form}
      onSubmit={form.handleSubmit(save)}>
      <Box direction="col" gap={4}>
        {renderFields()}
        <Typography as="h3" weight="semibold">
          {t('label.mapping-plural')}
        </Typography>
        {mappings.fields.map((mapping, index) => (
          <fieldset data-testid="ontology-concept-mapping" key={mapping.id}>
            <legend>
              {t('label.mapping')} {index + 1}
            </legend>
            <Box direction="col" gap={3}>
              {renderMappingFields(index)}
              <Button
                color="secondary"
                isDisabled={disabled}
                onPress={() => removeMapping(index)}>
                {t('label.remove')}
              </Button>
            </Box>
          </fieldset>
        ))}
        <Button
          color="secondary"
          isDisabled={disabled}
          ref={addMappingButton}
          onPress={appendMapping}>
          {t('label.add-mapping')}
        </Button>
        <Button isDisabled={!canEdit} isLoading={isSaving} type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default OntologyConceptEditor;
