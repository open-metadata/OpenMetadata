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
  Box,
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
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, pick } from 'lodash';
import { Key, ReactNode, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AxiomType,
  ExpressionKind,
} from '../../../../generated/api/data/createOntologyAxiom';
import { OntologyProfileReport } from '../../../../generated/api/data/ontologyProfileReport';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyAxiom } from '../../../../generated/entity/data/ontologyAxiom';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  createOntologyAxiom,
  patchOntologyAxiom,
  validateOntologyAxiom,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { generateUUID } from '../../../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyExpressionEditor, {
  defaultExpression,
  getExpressionRenderKey,
} from '../../../OntologyExplorer/OntologyExpressionEditor';
import OntologyIriInput from '../OntologyIriInput/OntologyIriInput';
import { OntologyReferenceOptions } from '../OntologyIriInput/OntologyIriInput.types';
import {
  AXIOM_LABELS,
  buildOntologyAxiomRequest,
  EMPTY_AXIOM_FORM,
  formatOntologyExpression,
  isClassExpressionAxiom,
  isOntologyAxiomReady,
  OntologyAxiomFormState,
} from './OntologyAxiomEditor.utils';

interface OntologyAxiomEditorProps {
  ontology: Ontology;
  references?: OntologyReferenceOptions;
  axiom?: OntologyAxiom;
  canEdit: boolean;
  onSaved?: (axiom: OntologyAxiom) => void;
}

const LIVE_VALIDATION_DELAY_MILLIS = 450;

const resetShape = (
  form: ReturnType<typeof useForm<OntologyAxiomFormState>>,
  axiomType: AxiomType
) => {
  if (
    isClassExpressionAxiom(axiomType) &&
    !form.getValues('expressions').length
  ) {
    form.setValue(
      'expressions',
      [defaultExpression(ExpressionKind.NamedClass)],
      { shouldDirty: true }
    );
  }
};

const axiomTypeLabel = (
  axiomType: AxiomType,
  t: ReturnType<typeof useTranslation>['t']
) => t(AXIOM_LABELS[axiomType]);

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

const previewSentence = (
  values: OntologyAxiomFormState,
  t: ReturnType<typeof useTranslation>['t'],
  references?: OntologyReferenceOptions
) => {
  const label = (iri: string) =>
    references?.concepts.find((option) => option.iri === iri)?.label ??
    references?.properties.find((option) => option.iri === iri)?.label ??
    iri;

  return [
    label(values.subjectIri),
    axiomTypeLabel(values.axiomType, t),
    !isClassExpressionAxiom(values.axiomType)
      ? label(values.propertyIri)
      : undefined,
    values.axiomType === AxiomType.ObjectPropertyAssertion
      ? values.targetIri
      : undefined,
    values.axiomType === AxiomType.DataPropertyAssertion
      ? JSON.stringify(values.literalValue)
      : undefined,
    ...(isClassExpressionAxiom(values.axiomType)
      ? values.expressions.map((expression) =>
          formatOntologyExpression(expression, label, t)
        )
      : []),
  ]
    .filter(Boolean)
    .join(' ');
};

const AxiomFrame = ({
  isAiMode,
  children,
}: {
  isAiMode: boolean;
  children: ReactNode;
}) =>
  isAiMode ? (
    <section
      className="tw:flex tw:flex-col tw:gap-4.5"
      data-testid="ontology-axiom-panel">
      {children}
    </section>
  ) : (
    <Card
      className="tw:flex tw:flex-col tw:gap-5 tw:border tw:border-secondary tw:p-5"
      data-testid="ontology-axiom-panel">
      {children}
    </Card>
  );

const AxiomTitle = ({
  isAiMode,
  axiom,
}: {
  isAiMode: boolean;
  axiom?: OntologyAxiom;
}) => {
  const { t } = useTranslation();

  return isAiMode ? (
    <Typography
      as="h3"
      className="not-prose tw:m-0"
      size="text-sm"
      weight="semibold">
      {axiom
        ? getEntityName(axiom)
        : t('label.new-entity', { entity: t('label.constraint') })}
    </Typography>
  ) : (
    <Typography as="h3" size="text-lg" weight="semibold">
      {t('label.ontology')} {t('label.constraint-plural')}
    </Typography>
  );
};

const axiomButtonSize = (isAiMode: boolean) => (isAiMode ? 'sm' : undefined);

const AxiomPreview = ({ sentence }: { sentence: string }) => {
  const { t } = useTranslation();

  return (
    <Card data-testid="ontology-axiom-preview" size="sm" variant="muted">
      <Card.Content className="tw:flex tw:flex-col tw:gap-1">
        <Typography color="secondary" size="text-xs" weight="medium">
          {t('label.preview')}
        </Typography>
        <Typography size="text-sm">{sentence}</Typography>
      </Card.Content>
    </Card>
  );
};

const axiomFormValues = (axiom?: OntologyAxiom): OntologyAxiomFormState => {
  if (!axiom) {
    return {
      ...EMPTY_AXIOM_FORM,
      name: `axiom-${generateUUID()}`,
      expressions: [defaultExpression(ExpressionKind.NamedClass)],
    };
  }

  return {
    ...EMPTY_AXIOM_FORM,
    ...pick(axiom, [
      'description',
      'displayName',
      'name',
      'axiomType',
      'expressions',
      'subjectIri',
      'targetIri',
      'propertyIri',
    ]),
    literalValue: axiom.literal?.value ?? '',
    literalDatatypeIri: axiom.literal?.datatypeIri ?? '',
  };
};

const AssertionFields = ({
  form,
  values,
  references,
}: {
  form: ReturnType<typeof useForm<OntologyAxiomFormState>>;
  values: OntologyAxiomFormState;
  references?: OntologyReferenceOptions;
}) => {
  const { t } = useTranslation();
  const propertyKind =
    values.axiomType === AxiomType.DataPropertyAssertion
      ? Kind.Data
      : Kind.Object;
  const usesProperty = [
    AxiomType.DataPropertyAssertion,
    AxiomType.ObjectPropertyAssertion,
  ].includes(values.axiomType);

  return (
    <>
      {usesProperty ? (
        <OntologyIriInput
          isRequired
          label={`${t('label.property')} ${t('label.concept-iri')}`}
          options={references?.properties.filter(
            (property) => property.kind === propertyKind
          )}
          value={values.propertyIri}
          onChange={(propertyIri) =>
            form.setValue('propertyIri', propertyIri, { shouldDirty: true })
          }
        />
      ) : null}
      {values.axiomType === AxiomType.ObjectPropertyAssertion ? (
        <Input
          isRequired
          label={`${t('label.target')} ${t('label.concept-iri')}`}
          value={values.targetIri}
          onChange={(targetIri) =>
            form.setValue('targetIri', targetIri, { shouldDirty: true })
          }
        />
      ) : null}
      {values.axiomType === AxiomType.DataPropertyAssertion ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          <Input
            isRequired={false}
            label={t('label.value')}
            value={values.literalValue}
            onChange={(literalValue) =>
              form.setValue('literalValue', literalValue, {
                shouldDirty: true,
              })
            }
          />
          <Input
            label={`${t('label.data-type')} ${t('label.concept-iri')}`}
            value={values.literalDatatypeIri}
            onChange={(literalDatatypeIri) =>
              form.setValue('literalDatatypeIri', literalDatatypeIri, {
                shouldDirty: true,
              })
            }
          />
        </div>
      ) : null}
    </>
  );
};

const OntologyAxiomEditor = ({
  ontology,
  references,
  axiom,
  canEdit,
  onSaved,
}: OntologyAxiomEditorProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const buttonSize = axiomButtonSize(isAiMode);
  const form = useForm<OntologyAxiomFormState>({
    defaultValues: {
      ...EMPTY_AXIOM_FORM,
      expressions: [defaultExpression(ExpressionKind.NamedClass)],
    },
  });
  const markSaved = useOntologyDirtyForm(form.formState.isDirty);
  const values = form.watch();
  const validationSequence = useRef(0);
  const [validation, setValidation] = useState<{
    key: string;
    report: OntologyProfileReport;
  }>();
  const [created, setCreated] = useState<OntologyAxiom>();
  const [isValidating, setIsValidating] = useState(false);
  const ontologyFullyQualifiedName =
    ontology.fullyQualifiedName ?? ontology.name;
  const validationKey = JSON.stringify(values);
  const profile =
    validation?.key === validationKey ? validation.report : undefined;
  const validationValues = useRef(values);
  validationValues.current = values;

  useEffect(() => {
    form.reset(axiomFormValues(axiom));
    setCreated(undefined);
    setValidation(undefined);
  }, [
    form,
    axiom,
    ontology.description,
    ontology.displayName,
    ontology.id,
    ontology.name,
  ]);

  useEffect(() => {
    if (!isOntologyAxiomReady(validationValues.current)) {
      setValidation(undefined);

      return;
    }
    const sequence = ++validationSequence.current;
    const timeout = window.setTimeout(() => {
      validateOntologyAxiom(
        buildOntologyAxiomRequest(
          ontologyFullyQualifiedName,
          validationValues.current
        )
      )
        .then((report) => {
          if (sequence === validationSequence.current) {
            setValidation({ key: validationKey, report });
          }
        })
        .catch(() => {
          if (sequence === validationSequence.current) {
            setValidation(undefined);
          }
        });
    }, LIVE_VALIDATION_DELAY_MILLIS);

    return () => {
      window.clearTimeout(timeout);
      validationSequence.current += 1;
    };
  }, [ontologyFullyQualifiedName, validationKey]);

  const validate = async (submitted = values) => {
    setIsValidating(true);
    let report: OntologyProfileReport | undefined;
    try {
      report = await validateOntologyAxiom(
        buildOntologyAxiomRequest(ontologyFullyQualifiedName, submitted)
      );
      setValidation({ key: JSON.stringify(submitted), report });
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsValidating(false);
    }

    return report;
  };

  const submit = async (submitted: OntologyAxiomFormState) => {
    if (!canEdit) {
      return;
    }
    const report = await validate(submitted);
    if (report?.valid) {
      try {
        const request = buildOntologyAxiomRequest(
          ontologyFullyQualifiedName,
          submitted
        );
        const fields = Object.keys(request).filter(
          (field) => !['ontology', 'name', 'provenance'].includes(field)
        );
        const saved = axiom
          ? await patchOntologyAxiom(axiom.id, [
              { op: 'test', path: '/version', value: axiom.version },
              ...compare(
                omitBy(pick(axiom, fields), isUndefined),
                omitBy(pick(request, fields), isUndefined)
              ),
            ])
          : await createOntologyAxiom(request);
        form.reset(axiomFormValues(saved));
        markSaved();
        setCreated(saved);
        onSaved?.(saved);
        showSuccessToast(t('label.saved'));
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
    {
      ...requiredField('name', t('label.name'), t),
      props: { isDisabled: Boolean(axiom) },
    },
    requiredField('displayName', t('label.display-name'), t),
    requiredField(
      'description',
      t('label.description'),
      t,
      FieldTypes.TEXTAREA
    ),
  ];
  const usesExpressions = isClassExpressionAxiom(values.axiomType);

  return (
    <HookForm form={form} onSubmit={form.handleSubmit(submit)}>
      <AxiomFrame isAiMode={isAiMode}>
        <AxiomTitle axiom={axiom} isAiMode={isAiMode} />
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
        <Card data-testid="ontology-axiom-help" size="sm" variant="muted">
          <Card.Content>
            <Typography color="secondary" size="text-sm">
              {t(
                `message.ontology-axiom-${values.axiomType
                  .toLowerCase()
                  .replaceAll('_', '-')}-help`
              )}
            </Typography>
          </Card.Content>
        </Card>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          {metadataFields.slice(0, 2).map((field) => (
            <div key={field.name}>{getField(field)}</div>
          ))}
          <div className="tw:md:col-span-2">{getField(metadataFields[2])}</div>
          <div className="tw:md:col-span-2">
            <OntologyIriInput
              isRequired
              label={t('label.subject')}
              options={
                values.axiomType === AxiomType.ClassAssertion ||
                !isClassExpressionAxiom(values.axiomType)
                  ? undefined
                  : references?.concepts
              }
              value={values.subjectIri}
              onChange={(subjectIri) =>
                form.setValue('subjectIri', subjectIri, { shouldDirty: true })
              }
            />
          </div>
        </div>

        <AssertionFields form={form} references={references} values={values} />

        {usesExpressions ? (
          <div className="tw:flex tw:flex-col tw:gap-3">
            {values.expressions.map((expression, index) => (
              <OntologyExpressionEditor
                expression={expression}
                key={getExpressionRenderKey(expression)}
                references={references}
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

        <AxiomPreview sentence={previewSentence(values, t, references)} />
        {profile ? (
          <Box direction="col" gap={2}>
            <ProfileResult profile={profile} />
            <Typography color="secondary" size="text-xs">
              {t('message.ontology-profile-validation-help')}
            </Typography>
          </Box>
        ) : null}
        <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
          <Button
            color="secondary"
            data-testid="ontology-axiom-validate"
            isDisabled={!isOntologyAxiomReady(values)}
            isLoading={isValidating}
            size={buttonSize}
            onClick={() => void validate()}>
            {t('label.validate')}
          </Button>
          <Button
            color="primary"
            data-testid="ontology-axiom-submit"
            isDisabled={!canEdit || !profile?.valid}
            isLoading={form.formState.isSubmitting}
            size={buttonSize}
            type="submit">
            {t('label.save')}
          </Button>
        </div>
        {created ? (
          <Alert
            title={created.displayName ?? created.name}
            variant="success"
          />
        ) : null}
      </AxiomFrame>
    </HookForm>
  );
};

export default OntologyAxiomEditor;
