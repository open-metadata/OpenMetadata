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
  FieldTypes,
  FormField,
  getField,
  HookForm,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { isAxiosError } from 'axios';
import { Fragment, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import {
  createOntologyProperty,
  patchOntologyProperty,
} from '../../../../rest/ontologyAPI';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  OntologyPropertyFormValues,
  propertyFormFields,
  propertyFormValues,
  propertyPatch,
  propertyRequest,
} from './OntologyPropertyEditor.utils';

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
  const form = useForm<OntologyPropertyFormValues>({
    defaultValues: propertyFormValues(property),
  });
  const literals = useFieldArray({ control: form.control, name: 'enumValues' });
  const kind = form.watch('kind').id;
  const [isSaving, setIsSaving] = useState(false);
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
        {kind === Kind.Data && (
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
        )}
        <Button isDisabled={!canEdit} isLoading={isSaving} type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default OntologyPropertyEditor;
