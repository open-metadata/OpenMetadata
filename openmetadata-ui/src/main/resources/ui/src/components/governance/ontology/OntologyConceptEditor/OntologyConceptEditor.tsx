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
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { Fragment, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  ConceptMappingType,
  OntologyConcept,
} from '../../../../generated/entity/data/ontologyConcept';
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
  const form = useForm<OntologyConceptFormValues>({
    defaultValues: conceptFormValues(concept),
  });
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
      onSaved(result);
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <HookForm
      data-testid="ontology-concept-editor"
      form={form}
      onSubmit={form.handleSubmit(save)}>
      <Box direction="col" gap={4}>
        {conceptFormFields(t, Boolean(concept), disabled).map((field) => (
          <Fragment key={field.name}>{getField(field)}</Fragment>
        ))}
        <Typography as="h3" weight="semibold">
          {t('label.mapping-plural')}
        </Typography>
        {mappings.fields.map((mapping, index) => (
          <fieldset data-testid="ontology-concept-mapping" key={mapping.id}>
            <legend>
              {t('label.mapping')} {index + 1}
            </legend>
            <Box direction="col" gap={3}>
              {mappingFormFields(t, index, disabled).map((field) => (
                <Fragment key={field.name}>{getField(field)}</Fragment>
              ))}
              <Button
                color="secondary"
                isDisabled={disabled}
                onPress={() => {
                  mappings.remove(index);
                  addMappingButton.current?.focus();
                }}>
                {t('label.remove')}
              </Button>
            </Box>
          </fieldset>
        ))}
        <Button
          color="secondary"
          isDisabled={disabled}
          ref={addMappingButton}
          onPress={() =>
            mappings.append({
              conceptIri: '',
              mappingType: {
                id: ConceptMappingType.ExactMatch,
                label: ConceptMappingType.ExactMatch,
              },
              schemeIri: '',
              source: '',
            })
          }>
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
