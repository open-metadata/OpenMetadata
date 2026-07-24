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
  Alert,
  Button,
  Card,
  FieldProp,
  FieldTypes,
  getField,
  HookForm,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Key, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AxiomType,
  ExpressionKind,
} from '../../generated/api/data/createOntologyAxiom';
import { OntologyProfileReport } from '../../generated/api/data/ontologyProfileReport';
import { Glossary } from '../../generated/entity/data/glossary';
import { OntologyAxiom } from '../../generated/entity/data/ontologyAxiom';
import {
  createOntologyAxiom,
  validateOntologyAxiom,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import OntologyExpressionEditor, {
  defaultExpression,
} from './OntologyExpressionEditor';
import {
  buildOntologyAxiomRequest,
  EMPTY_AXIOM_FORM,
  isOntologyAxiomReady,
  OntologyAxiomFormState,
} from './OntologyModelingWorkbench.utils';

interface OntologyAxiomPanelProps {
  glossary: Glossary;
}

const LIVE_VALIDATION_DELAY_MILLIS = 450;

const OntologyAxiomPanel = ({ glossary }: OntologyAxiomPanelProps) => {
  const { t } = useTranslation();
  const form = useForm<OntologyAxiomFormState>({
    defaultValues: {
      ...EMPTY_AXIOM_FORM,
      expressions: [defaultExpression(ExpressionKind.NamedClass)],
    },
  });
  const values = form.watch();
  const validationSequence = useRef(0);
  const [profile, setProfile] = useState<OntologyProfileReport>();
  const [created, setCreated] = useState<OntologyAxiom>();
  const [isValidating, setIsValidating] = useState(false);
  const glossaryFullyQualifiedName =
    glossary.fullyQualifiedName ?? glossary.name;
  const validationKey = JSON.stringify(values);
  const validationValues = useRef(values);
  validationValues.current = values;

  useEffect(() => {
    form.reset({
      ...EMPTY_AXIOM_FORM,
      description: glossary.description,
      displayName: glossary.displayName ?? glossary.name,
      expressions: [defaultExpression(ExpressionKind.NamedClass)],
      name: `axiom-${glossary.name}`,
    });
    setCreated(undefined);
    setProfile(undefined);
  }, [
    form,
    glossary.description,
    glossary.displayName,
    glossary.id,
    glossary.name,
  ]);

  useEffect(() => {
    if (!isOntologyAxiomReady(validationValues.current)) {
      setProfile(undefined);

      return;
    }
    const sequence = ++validationSequence.current;
    const timeout = window.setTimeout(() => {
      validateOntologyAxiom(
        buildOntologyAxiomRequest(
          glossaryFullyQualifiedName,
          validationValues.current
        )
      )
        .then((report) => {
          if (sequence === validationSequence.current) {
            setProfile(report);
          }
        })
        .catch(() => {
          if (sequence === validationSequence.current) {
            setProfile(undefined);
          }
        });
    }, LIVE_VALIDATION_DELAY_MILLIS);

    return () => window.clearTimeout(timeout);
  }, [glossaryFullyQualifiedName, validationKey]);

  const validate = async (submitted = values) => {
    setIsValidating(true);
    let report: OntologyProfileReport | undefined;
    try {
      report = await validateOntologyAxiom(
        buildOntologyAxiomRequest(glossaryFullyQualifiedName, submitted)
      );
      setProfile(report);
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsValidating(false);
    }

    return report;
  };

  const submit = async (submitted: OntologyAxiomFormState) => {
    const report = await validate(submitted);
    if (report?.valid) {
      try {
        setCreated(
          await createOntologyAxiom(
            buildOntologyAxiomRequest(glossaryFullyQualifiedName, submitted)
          )
        );
        showSuccessToast(t('label.created'));
      } catch {
        showErrorToast(t('server.unexpected-error'));
      }
    }
  };

  const selectAxiomType = (key: Key | null) => {
    if (key) {
      const axiomType = String(key) as AxiomType;
      form.setValue('axiomType', axiomType, { shouldDirty: true });
      resetShape(form, axiomType);
      setCreated(undefined);
    }
  };

  const metadataFields: FieldProp[] = [
    requiredField('name', t('label.name'), t),
    requiredField('displayName', t('label.display-name'), t),
    requiredField(
      'description',
      t('label.description'),
      t,
      FieldTypes.TEXTAREA
    ),
    requiredField('subjectIri', t('label.subject'), t),
  ];
  const usesExpressions = isClassExpressionAxiom(values.axiomType);
  const usesProperty = [
    AxiomType.DataPropertyAssertion,
    AxiomType.ObjectPropertyAssertion,
  ].includes(values.axiomType);

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(submit)}>
      <Card
        className="tw:flex tw:flex-col tw:gap-5 tw:border tw:border-secondary tw:p-5"
        data-testid="ontology-axiom-panel">
        <Typography as="h3" size="text-lg" weight="semibold">
          {t('label.ontology')} {t('label.constraint-plural')}
        </Typography>
        <Select
          items={Object.values(AxiomType).map((axiomType) => ({
            id: axiomType,
            label: axiomTypeLabel(axiomType, t),
          }))}
          label={t('label.type')}
          value={values.axiomType}
          onChange={selectAxiomType}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          {metadataFields.slice(0, 2).map((field) => (
            <div key={field.name}>{getField(field)}</div>
          ))}
          <div className="tw:md:col-span-2">{getField(metadataFields[2])}</div>
          <div className="tw:md:col-span-2">{getField(metadataFields[3])}</div>
        </div>

        {usesProperty ? (
          <Input
            isRequired
            label={`${t('label.property')} ${t('label.concept-iri')}`}
            value={values.propertyIri}
            onChange={(propertyIri) =>
              form.setValue('propertyIri', propertyIri)
            }
          />
        ) : null}
        {values.axiomType === AxiomType.ObjectPropertyAssertion ? (
          <Input
            isRequired
            label={`${t('label.target')} ${t('label.concept-iri')}`}
            value={values.targetIri}
            onChange={(targetIri) => form.setValue('targetIri', targetIri)}
          />
        ) : null}
        {values.axiomType === AxiomType.DataPropertyAssertion ? (
          <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
            <Input
              isRequired
              label={t('label.value')}
              value={values.literalValue}
              onChange={(literalValue) =>
                form.setValue('literalValue', literalValue)
              }
            />
            <Input
              label={`${t('label.data-type')} ${t('label.concept-iri')}`}
              value={values.literalDatatypeIri}
              onChange={(literalDatatypeIri) =>
                form.setValue('literalDatatypeIri', literalDatatypeIri)
              }
            />
          </div>
        ) : null}

        {usesExpressions ? (
          <div className="tw:flex tw:flex-col tw:gap-3">
            {values.expressions.map((expression, index) => (
              <OntologyExpressionEditor
                expression={expression}
                key={`${expression.kind}-${index}`}
                onChange={(next) =>
                  form.setValue(
                    'expressions',
                    values.expressions.map((current, position) =>
                      position === index ? next : current
                    ),
                    { shouldDirty: true }
                  )
                }
                onRemove={() =>
                  form.setValue(
                    'expressions',
                    values.expressions.filter(
                      (_, position) => position !== index
                    ),
                    { shouldDirty: true }
                  )
                }
              />
            ))}
            <Button
              color="secondary"
              size="sm"
              onClick={() =>
                form.setValue(
                  'expressions',
                  [
                    ...values.expressions,
                    defaultExpression(ExpressionKind.NamedClass),
                  ],
                  { shouldDirty: true }
                )
              }>
              {t('label.add')} {t('label.constraint')}
            </Button>
          </div>
        ) : null}

        {profile ? <ProfileResult profile={profile} /> : null}
        <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
          <Button
            color="secondary"
            data-testid="ontology-axiom-validate"
            isDisabled={!isOntologyAxiomReady(values)}
            isLoading={isValidating}
            onClick={() => void validate()}>
            {t('label.validate')}
          </Button>
          <Button
            color="primary"
            data-testid="ontology-axiom-submit"
            isDisabled={!profile?.valid}
            isLoading={form.formState.isSubmitting}
            type="submit">
            {t('label.create')}
          </Button>
        </div>
        {created ? (
          <Alert
            title={created.displayName ?? created.name}
            variant="success"
          />
        ) : null}
      </Card>
    </HookForm>
  );
};

const ProfileResult = ({ profile }: { profile: OntologyProfileReport }) => {
  const { t } = useTranslation();

  return (
    <Alert
      title={
        profile.valid
          ? t('label.validation-passed')
          : t('label.validation-failed')
      }
      variant={profile.valid ? 'success' : 'error'}>
      {profile.violations.length ? (
        <ul className="tw:m-0 tw:list-disc tw:pl-5">
          {profile.violations.map((violation) => (
            <li key={`${violation.code}-${violation.path}`}>
              {violation.message}
            </li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
};

const resetShape = (
  form: ReturnType<typeof useForm<OntologyAxiomFormState>>,
  axiomType: AxiomType
) => {
  form.setValue(
    'expressions',
    isClassExpressionAxiom(axiomType)
      ? [defaultExpression(ExpressionKind.NamedClass)]
      : []
  );
  form.setValue('literalDatatypeIri', '');
  form.setValue('literalValue', '');
  form.setValue('propertyIri', '');
  form.setValue('targetIri', '');
};

const isClassExpressionAxiom = (axiomType: AxiomType) =>
  [
    AxiomType.ClassAssertion,
    AxiomType.DisjointWith,
    AxiomType.EquivalentClass,
    AxiomType.SubclassOf,
  ].includes(axiomType);

const axiomTypeLabel = (
  axiomType: AxiomType,
  t: ReturnType<typeof useTranslation>['t']
) => {
  let label: string;

  switch (axiomType) {
    case AxiomType.ClassAssertion:
      label = t('label.classification');

      break;
    case AxiomType.DataPropertyAssertion:
      label = t('label.custom-property');

      break;
    case AxiomType.DisjointWith:
      label = t('label.conflict-resolution');

      break;
    case AxiomType.EquivalentClass:
      label = t('label.exact-match');

      break;
    case AxiomType.ObjectPropertyAssertion:
      label = t('label.relationship');

      break;
    case AxiomType.SubclassOf:
      label = t('label.child-of');

      break;
  }

  return label;
};

const requiredField = (
  name: string,
  label: string,
  t: ReturnType<typeof useTranslation>['t'],
  type: FieldTypes = FieldTypes.TEXT
): FieldProp => ({
  label,
  name,
  required: true,
  rules: { required: t('label.field-required', { field: label }) },
  type,
});

export default OntologyAxiomPanel;
