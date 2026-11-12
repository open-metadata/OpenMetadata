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
  FormField,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import {
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  ConceptMappingType,
  OntologyConcept,
} from '../../../../generated/entity/data/ontologyConcept';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { patchOntologyConcept } from '../../../../rest/ontologyAPI';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyIriInput from '../OntologyIriInput/OntologyIriInput';
import { OntologyIriOption } from '../OntologyIriInput/OntologyIriInput.types';
import {
  conceptFormFields,
  conceptFormValues,
  conceptPatch,
  conceptRequest,
  mappingFormFields,
  OntologyConceptFormValues,
} from './OntologyConceptEditor.utils';
import { useMappingTargetOptions } from './useReadableConceptOptions';

interface OntologyConceptEditorProps {
  ontology: Ontology;
  concept: OntologyConcept;
  canEdit: boolean;
  concepts?: ReadonlyArray<OntologyIriOption>;
  onSaved: (concept: OntologyConcept) => void;
}

type ConceptFieldName = keyof Omit<
  OntologyConceptFormValues,
  'conceptMappings'
>;

/** The concept form's state, shared by the stand-alone editor and the concept panel. */
export const useOntologyConceptEditor = ({
  ontology,
  concept,
  canEdit,
  concepts,
  onSaved,
}: OntologyConceptEditorProps) => {
  const { t } = useTranslation();
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
  const { options: mappingTargets, isLoading: mappingTargetsLoading } =
    useMappingTargetOptions(concepts, canEdit && mappings.fields.length > 0);
  const disabled = !canEdit || isSaving;
  const isDirty = form.formState.isDirty;

  // A newer copy of the concept (its working draft, or the saved result) replaces
  // the form's values unless the user has unsaved edits.
  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset(conceptFormValues(concept));
    }
  }, [concept, form]);

  const save = async (values: OntologyConceptFormValues) => {
    if (!canEdit) {
      return;
    }
    setIsSaving(true);
    try {
      const request = conceptRequest(values, ontology.fullyQualifiedName);
      const result = await patchOntologyConcept(
        concept.id,
        conceptPatch(concept, request)
      );
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

  const reset = useCallback(
    () => form.reset(conceptFormValues(concept)),
    [concept, form]
  );

  return {
    addMappingButton,
    canEdit,
    disabled,
    form,
    isDirty,
    isSaving,
    mappingTargets,
    mappingTargetsLoading,
    mappings,
    saveStatus: t(
      isDirty ? 'label.unsaved-changes' : 'label.all-changes-saved'
    ),
    submit: form.handleSubmit(save),
    reset,
  };
};

export type OntologyConceptEditorState = ReturnType<
  typeof useOntologyConceptEditor
>;

const useEditorParts = (editor: OntologyConceptEditorState) => {
  const { t } = useTranslation();
  const { form, mappings, disabled, addMappingButton } = editor;

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

  const renderFields = (names?: ConceptFieldName[]) =>
    conceptFormFields(t, disabled)
      .filter(
        (field) => !names || names.includes(field.name as ConceptFieldName)
      )
      .map((field) => <Fragment key={field.name}>{getField(field)}</Fragment>);

  const renderMappingFields = (index: number) => (
    <>
      {mappingFormFields(t, index, disabled).map((field) => (
        <Fragment key={field.name}>
          {field.name.endsWith('.conceptIri') ? (
            <FormField
              control={form.control}
              name={field.name as `conceptMappings.${number}.conceptIri`}
              rules={{
                validate: (value: string) =>
                  isAbsoluteOntologyIri(value.trim()) ||
                  t('message.invalid-concept-iri'),
              }}>
              {({ field: control, fieldState }) => (
                <OntologyIriInput
                  isRequired
                  error={fieldState.error?.message}
                  isDisabled={disabled}
                  isLoading={editor.mappingTargetsLoading}
                  label={t('label.concept-iri')}
                  options={editor.mappingTargets}
                  testId="ontology-mapping-concept"
                  value={control.value}
                  onChange={control.onChange}
                />
              )}
            </FormField>
          ) : (
            getField(field)
          )}
        </Fragment>
      ))}
    </>
  );

  const removeMapping = (index: number) => {
    mappings.remove(index);
    addMappingButton.current?.focus();
  };

  return { appendMapping, renderFields, renderMappingFields, removeMapping };
};

/**
 * The concept panel's form. It is the package's HookForm, so the fields it renders read
 * the form from the same react-hook-form copy whatever the bundler resolves.
 */
export const ConceptEditorProvider = ({
  editor,
  children,
}: {
  editor: OntologyConceptEditorState;
  children: ReactNode;
}) => (
  <HookForm
    className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col"
    data-testid="ontology-concept-editor"
    form={editor.form}
    onSubmit={(event) => void editor.submit(event)}>
    {children}
  </HookForm>
);

/** Some of the concept fields; they sit inside ConceptEditorProvider's form. */
export const ConceptEditorFields = ({
  editor,
  names,
}: {
  editor: OntologyConceptEditorState;
  names: ConceptFieldName[];
}) => {
  const { renderFields } = useEditorParts(editor);

  return (
    <Box direction="col" gap={4}>
      {renderFields(names)}
    </Box>
  );
};

export const ConceptEditorMappings = ({
  editor,
}: {
  editor: OntologyConceptEditorState;
}) => {
  const { t } = useTranslation();
  const { appendMapping, renderMappingFields, removeMapping } =
    useEditorParts(editor);
  const { mappings, disabled } = editor;

  return (
    <Box direction="col" gap={3}>
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
          aria-label={t('label.add-mapping')}
          className="tw:ml-auto"
          color="link-color"
          data-testid="ontology-add-mapping"
          iconLeading={Plus}
          isDisabled={disabled}
          ref={editor.addMappingButton}
          size="sm"
          onPress={appendMapping}>
          {t('label.add')}
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
  );
};

/** The panel's sticky footer: save state on the left, Cancel and Save on the right. */
export const ConceptEditorFooter = ({
  editor,
}: {
  editor: OntologyConceptEditorState;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:shrink-0 tw:border-t tw:border-secondary tw:px-6 tw:py-3"
      gap={2}>
      <Typography
        className="tw:flex-1"
        color={editor.isDirty ? 'warning' : 'secondary'}
        data-testid="concept-save-status"
        role="status"
        size="text-xs">
        {editor.saveStatus}
      </Typography>
      <Button
        color="secondary"
        data-testid="concept-cancel"
        isDisabled={!editor.isDirty || editor.isSaving}
        size="sm"
        onPress={editor.reset}>
        {t('label.cancel')}
      </Button>
      <Button
        color="primary"
        data-testid="concept-save"
        isDisabled={!editor.canEdit || !editor.isDirty}
        isLoading={editor.isSaving}
        size="sm"
        onPress={() => void editor.submit()}>
        {t('label.save')}
      </Button>
    </Box>
  );
};

const OntologyConceptEditor = (props: OntologyConceptEditorProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const editor = useOntologyConceptEditor(props);
  const { form, mappings, disabled, isSaving, saveStatus } = editor;
  const canEdit = props.canEdit;
  const save = editor.submit;
  const { appendMapping, renderFields, renderMappingFields, removeMapping } =
    useEditorParts(editor);
  const addMappingButton = editor.addMappingButton;

  if (isAiMode) {
    return (
      <HookForm
        data-testid="ontology-concept-editor"
        form={form}
        onSubmit={save}>
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
            <Typography
              className="tw:flex-1 tw:text-tertiary"
              data-testid="concept-save-status"
              role="status"
              size="text-xs">
              {saveStatus}
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
    <HookForm data-testid="ontology-concept-editor" form={form} onSubmit={save}>
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
        <Typography
          data-testid="concept-save-status"
          role="status"
          size="text-xs">
          {saveStatus}
        </Typography>
        <Button isDisabled={!canEdit} isLoading={isSaving} type="submit">
          {t('label.save')}
        </Button>
      </Box>
    </HookForm>
  );
};

export default OntologyConceptEditor;
