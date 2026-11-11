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

import { Alert, Button, HookForm } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, pick } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyAxiom } from '../../../../generated/entity/data/ontologyAxiom';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import {
  createOntologyAxiom,
  patchOntologyAxiom,
} from '../../../../rest/ontologyAPI';
import { generateUUID, getErrorText } from '../../../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyFormFooter from '../OntologyFormFooter/OntologyFormFooter';
import { OntologyReferenceOptions } from '../OntologyIriInput/OntologyIriInput.types';
import {
  AdvancedRuleFields,
  AxiomDetailFields,
  axiomFormValues,
  AxiomModeSwitch,
  AxiomOutcome,
  AxiomPreview,
  collectAxiomProblems,
  previewSentence,
  QuickRuleFields,
} from './OntologyAxiomEditor.parts';
import {
  buildOntologyAxiomRequest,
  isOntologyAxiomReady,
  OntologyAxiomFormState,
} from './OntologyAxiomEditor.utils';
import {
  isQuickRuleReady,
  ruleNameFromSentence,
} from './OntologyAxiomQuickRule.utils';
import { useOntologyAxiomRule } from './useOntologyAxiomRule';
import { useOntologyAxiomValidation } from './useOntologyAxiomValidation';

interface OntologyAxiomEditorProps {
  ontology: Ontology;
  references?: OntologyReferenceOptions;
  axiom?: OntologyAxiom;
  canEdit: boolean;
  onSaved?: (axiom: OntologyAxiom) => void;
}

/** The footer status: not run yet, passed, or failed. */
const validationStatusKey = (valid?: boolean) => {
  if (valid === undefined) {
    return 'label.not-validated';
  }

  return valid ? 'label.validation-passed' : 'label.validation-failed';
};

const OntologyAxiomEditor = ({
  ontology,
  references,
  axiom,
  canEdit,
  onSaved,
}: OntologyAxiomEditorProps) => {
  const { t } = useTranslation();
  const form = useForm<OntologyAxiomFormState>({
    defaultValues: axiomFormValues(),
  });
  const markSaved = useOntologyDirtyForm(form.formState.isDirty);
  const values = form.watch();
  const rule = useOntologyAxiomRule(form);
  const [created, setCreated] = useState<OntologyAxiom>();
  const nameSuffix = useRef(generateUUID().slice(0, 6));
  const ontologyFullyQualifiedName =
    ontology.fullyQualifiedName ?? ontology.name;
  const sentence = useMemo(
    () => previewSentence(values, t, references),
    [values, t, references]
  );
  const validation = useOntologyAxiomValidation(
    values,
    ontologyFullyQualifiedName,
    sentence
  );
  const { clear: clearValidation } = validation;
  const { load: loadRule, nameTouched } = rule;

  useEffect(() => {
    const next = axiomFormValues(axiom);
    form.reset(next);
    loadRule(next, Boolean(axiom));
    setCreated(undefined);
    clearValidation();
  }, [
    form,
    axiom,
    loadRule,
    clearValidation,
    ontology.description,
    ontology.displayName,
    ontology.id,
    ontology.name,
  ]);

  useEffect(() => {
    if (!axiom && !nameTouched.current) {
      form.setValue('name', ruleNameFromSentence(sentence, nameSuffix.current));
    }
  }, [axiom, form, nameTouched, sentence]);

  const save = async (submitted: OntologyAxiomFormState) => {
    const request = buildOntologyAxiomRequest(
      ontologyFullyQualifiedName,
      submitted,
      sentence
    );
    const fields = Object.keys(request).filter(
      (field) => !['ontology', 'name', 'provenance'].includes(field)
    );

    return axiom
      ? patchOntologyAxiom(axiom.id, [
          { op: 'test', path: '/version', value: axiom.version },
          ...compare(
            omitBy(pick(axiom, fields), isUndefined),
            omitBy(pick(request, fields), isUndefined)
          ),
        ])
      : createOntologyAxiom(request);
  };

  const submit = async (submitted: OntologyAxiomFormState) => {
    const report = canEdit ? await validation.validate(submitted) : undefined;
    if (!report?.valid) {
      return;
    }
    try {
      const saved = await save(submitted);
      form.reset(axiomFormValues(saved));
      markSaved();
      setCreated(saved);
      onSaved?.(saved);
      showSuccessToast(t('label.saved'));
    } catch (error) {
      showErrorToast(
        getErrorText(error as AxiosError, t('server.unexpected-error'))
      );
    }
  };

  const isQuick = rule.mode === 'quick';
  const problems = collectAxiomProblems(validation.current, isQuick);
  const isSavable =
    canEdit &&
    Boolean(validation.current?.report?.valid) &&
    (!isQuick || isQuickRuleReady(rule.quick));
  const cancel = () => {
    const next = axiomFormValues(axiom);
    form.reset(next);
    loadRule(next, Boolean(axiom));
    clearValidation();
  };

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(submit)}>
      <section
        className="tw:flex tw:flex-col tw:gap-4.5"
        data-testid="ontology-axiom-panel">
        <AxiomModeSwitch mode={rule.mode} onChange={rule.changeMode} />
        {rule.lossyReason ? (
          <Alert data-testid="ontology-axiom-quick-lossy" variant="warning">
            {t(rule.lossyReason)}
          </Alert>
        ) : null}
        {isQuick ? (
          <QuickRuleFields
            problems={problems.routed.byField}
            references={references}
            rule={rule.quick}
            onChange={rule.changeQuick}
          />
        ) : (
          <AdvancedRuleFields
            axiom={axiom}
            form={form}
            nameTouched={nameTouched}
            problems={problems.routed.byField}
            references={references}
            values={values}
          />
        )}
        <AxiomDetailFields />
        <AxiomPreview sentence={sentence} />
        <AxiomOutcome problems={problems} validation={validation.current} />
        {created ? (
          <Alert
            title={created.displayName ?? created.name}
            variant="success"
          />
        ) : null}
        <OntologyFormFooter
          canSubmit={isSavable}
          isDirty={form.formState.isDirty}
          isSaving={form.formState.isSubmitting}
          status={t(validationStatusKey(validation.current?.report?.valid))}
          submitLabel={t('label.save')}
          submitTestId="ontology-axiom-submit"
          testId="ontology-axiom-footer"
          onCancel={cancel}>
          <Button
            color="secondary"
            data-testid="ontology-axiom-validate"
            isDisabled={!isOntologyAxiomReady(values)}
            isLoading={validation.isValidating}
            size="sm"
            onClick={() => void validation.validate()}>
            {t('label.validate')}
          </Button>
        </OntologyFormFooter>
      </section>
    </HookForm>
  );
};

export default OntologyAxiomEditor;
