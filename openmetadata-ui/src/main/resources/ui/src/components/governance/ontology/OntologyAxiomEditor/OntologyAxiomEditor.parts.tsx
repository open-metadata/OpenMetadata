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
  ButtonGroup,
  ButtonGroupItem,
  Card,
  FieldTypes,
  getField,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { pick } from 'lodash';
import { Key, ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AxiomType,
  ExpressionKind,
  OntologyExpression,
} from '../../../../generated/api/data/createOntologyAxiom';
import {
  OntologyProfileReport,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
import { OntologyAxiom } from '../../../../generated/entity/data/ontologyAxiom';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyExpressionEditor, {
  defaultExpression,
  getExpressionRenderKey,
} from '../../../OntologyExplorer/OntologyExpressionEditor';
import OntologyIriInput from '../OntologyIriInput/OntologyIriInput';
import { ONTOLOGY_DATATYPE_OPTIONS } from '../OntologyIriInput/OntologyIriInput.constants';
import { OntologyReferenceOptions } from '../OntologyIriInput/OntologyIriInput.types';
import {
  AXIOM_LABELS,
  EMPTY_AXIOM_FORM,
  formatOntologyExpression,
  isClassExpressionAxiom,
  OntologyAxiomFormState,
} from './OntologyAxiomEditor.utils';
import {
  AxiomProblem,
  EMPTY_QUICK_RULE,
  formToQuickRule,
  QuickQuantifier,
  QuickRule,
  QuickRuleKind,
  quickRuleSentence,
  quickRuleToForm,
  QUICK_QUANTIFIERS,
  QUICK_QUANTIFIER_LABELS,
  QUICK_RULE_HELP,
  QUICK_RULE_LABELS,
  routeAxiomProblems,
  RoutedAxiomProblems,
} from './OntologyAxiomQuickRule.utils';
import { AxiomEditorMode } from './useOntologyAxiomRule';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

export const resetShape = (
  form: UseFormReturn<OntologyAxiomFormState>,
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

export const axiomTypeLabel = (axiomType: AxiomType, t: TranslateFn) =>
  t(AXIOM_LABELS[axiomType]);

export const ProfileResult = ({
  profile,
  problems,
}: {
  profile: OntologyProfileReport;
  problems: AxiomProblem[];
}) => {
  const { t } = useTranslation();
  const hasWarnings = profile.valid && profile.violations.length > 0;

  let variant: 'success' | 'warning' | 'error' = 'success';
  if (!profile.valid) {
    variant = 'error';
  } else if (hasWarnings) {
    variant = 'warning';
  }

  return (
    <Alert
      data-testid="ontology-axiom-profile"
      title={
        profile.valid
          ? t('label.validation-passed')
          : t('label.validation-failed')
      }
      variant={variant}>
      {problems.length ? (
        <ul className="tw:m-0 tw:list-disc tw:pl-5">
          {problems.map((problem) => (
            <li key={`${problem.path}-${problem.message}`}>
              {problem.message}
            </li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
};

const labelFor =
  (references?: OntologyReferenceOptions) =>
  (iri: string): string =>
    references?.concepts.find((option) => option.iri === iri)?.label ??
    references?.properties.find((option) => option.iri === iri)?.label ??
    iri;

export const previewSentence = (
  values: OntologyAxiomFormState,
  t: TranslateFn,
  references?: OntologyReferenceOptions
) => {
  const label = labelFor(references);
  const quick = formToQuickRule(values);
  if (quick.rule) {
    return quickRuleSentence(quick.rule, label, t);
  }

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

export const AxiomFrame = ({
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

export const AxiomTitle = ({
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

export const axiomButtonSize = (isAiMode: boolean) =>
  isAiMode ? 'sm' : undefined;

export const AxiomPreview = ({ sentence }: { sentence: string }) => {
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

export const axiomFormValues = (
  axiom?: OntologyAxiom
): OntologyAxiomFormState => {
  if (!axiom) {
    return quickRuleToForm(EMPTY_QUICK_RULE, {
      ...EMPTY_AXIOM_FORM,
      name: '',
    });
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

export const AssertionFields = ({
  form,
  values,
  references,
  problems,
}: {
  form: UseFormReturn<OntologyAxiomFormState>;
  values: OntologyAxiomFormState;
  references?: OntologyReferenceOptions;
  problems: RoutedAxiomProblems['byField'];
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
          error={problems.property}
          label={t('label.property')}
          options={references?.properties.filter(
            (property) => property.kind === propertyKind
          )}
          testId="ontology-axiom-property"
          value={values.propertyIri}
          onChange={(propertyIri) =>
            form.setValue('propertyIri', propertyIri, { shouldDirty: true })
          }
        />
      ) : null}
      {values.axiomType === AxiomType.ObjectPropertyAssertion ? (
        <Input
          isRequired
          hint={problems.other}
          isInvalid={Boolean(problems.other)}
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
          <OntologyIriInput
            label={t('label.data-type')}
            options={ONTOLOGY_DATATYPE_OPTIONS}
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

export const QuickRuleFields = ({
  rule,
  references,
  problems,
  onChange,
}: {
  rule: QuickRule;
  references?: OntologyReferenceOptions;
  problems: RoutedAxiomProblems['byField'];
  onChange: (patch: Partial<QuickRule>) => void;
}) => {
  const { t } = useTranslation();
  const isMustHave = rule.kind === QuickRuleKind.MustHave;

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="ontology-rule-quick">
      <OntologyIriInput
        isRequired
        error={problems.subject}
        hint={t('message.ontology-picker-paste-hint')}
        label={t('label.subject')}
        options={references?.concepts}
        testId="ontology-rule-subject"
        value={rule.subjectIri}
        onChange={(subjectIri) => onChange({ subjectIri })}
      />
      <Select
        items={Object.values(QuickRuleKind).map((kind) => ({
          id: kind,
          label: t(QUICK_RULE_LABELS[kind]),
        }))}
        label={t('label.rule')}
        value={rule.kind}
        onChange={(key) =>
          key && onChange({ kind: String(key) as QuickRuleKind })
        }>
        {(item) => (
          <Select.Item id={item.id} key={item.id} label={item.label} />
        )}
      </Select>
      <Card data-testid="ontology-rule-quick-help" size="sm" variant="muted">
        <Card.Content>
          <Typography color="secondary" size="text-sm">
            {t(QUICK_RULE_HELP[rule.kind])}
          </Typography>
        </Card.Content>
      </Card>
      {isMustHave ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          <Select
            items={QUICK_QUANTIFIERS.map((quantifier) => ({
              id: quantifier,
              label: t(QUICK_QUANTIFIER_LABELS[quantifier]),
            }))}
            label={t('label.quantity')}
            value={rule.quantifier}
            onChange={(key) =>
              key && onChange({ quantifier: String(key) as QuickQuantifier })
            }>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
          <Input
            isRequired
            hint={problems.count}
            isInvalid={Boolean(problems.count)}
            label={t('label.cardinality')}
            type="number"
            value={String(rule.count)}
            onChange={(count) =>
              onChange({ count: Math.max(0, Math.floor(Number(count) || 0)) })
            }
          />
          <div className="tw:md:col-span-2">
            <OntologyIriInput
              isRequired
              error={problems.property}
              label={t('label.property')}
              options={references?.properties}
              testId="ontology-rule-property"
              value={rule.propertyIri}
              onChange={(propertyIri) => onChange({ propertyIri })}
            />
          </div>
        </div>
      ) : (
        <OntologyIriInput
          isRequired
          error={problems.other}
          hint={t('message.ontology-picker-paste-hint')}
          label={t('label.concept')}
          options={references?.concepts}
          testId="ontology-rule-other"
          value={rule.otherIri}
          onChange={(otherIri) => onChange({ otherIri })}
        />
      )}
    </div>
  );
};

export const AxiomModeSwitch = ({
  mode,
  onChange,
}: {
  mode: AxiomEditorMode;
  onChange: (mode: AxiomEditorMode) => void;
}) => {
  const { t } = useTranslation();

  return (
    <ButtonGroup
      disallowEmptySelection
      aria-label={t('label.rule')}
      data-testid="ontology-axiom-mode"
      selectedKeys={[mode]}
      size="sm"
      onSelectionChange={(keys) => {
        const [next] = [...keys];
        if (next) {
          onChange(next as AxiomEditorMode);
        }
      }}>
      <ButtonGroupItem data-testid="ontology-axiom-mode-quick" id="quick">
        {t('label.quick')}
      </ButtonGroupItem>
      <ButtonGroupItem data-testid="ontology-axiom-mode-advanced" id="advanced">
        {t('label.advanced')}
      </ButtonGroupItem>
    </ButtonGroup>
  );
};

export const AxiomDetailFields = () => {
  const { t } = useTranslation();
  const optional = (label: string) => `${label} (${t('label.optional')})`;

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-4">
      {getField({
        label: optional(t('label.display-name')),
        name: 'displayName',
        type: FieldTypes.TEXT,
      })}
      {getField({
        label: optional(t('label.description')),
        name: 'description',
        type: FieldTypes.TEXTAREA,
      })}
    </div>
  );
};

export interface AxiomProblems {
  routed: RoutedAxiomProblems;
  warnings: AxiomProblem[];
}

const toProblem = ({ message, path }: { message: string; path: string }) => ({
  message,
  path,
});

export const collectAxiomProblems = (
  validation:
    | { report?: OntologyProfileReport; rejection?: string }
    | undefined,
  isQuick: boolean
): AxiomProblems => {
  const violations = validation?.report?.violations ?? [];
  const errors = violations
    .filter((violation) => violation.severity === Severity.Error)
    .map(toProblem);
  const rejection = validation?.rejection
    ? [{ message: validation.rejection }]
    : [];

  return {
    routed: routeAxiomProblems([...rejection, ...errors], isQuick),
    warnings: violations
      .filter((violation) => violation.severity !== Severity.Error)
      .map(toProblem),
  };
};

export const AxiomOutcome = ({
  problems,
  validation,
}: {
  problems: AxiomProblems;
  validation: { report?: OntologyProfileReport } | undefined;
}) => {
  const { t } = useTranslation();
  const { general } = problems.routed;
  if (!validation?.report) {
    return general.length ? (
      <Alert data-testid="ontology-axiom-rejection" variant="error">
        {general.map((problem) => problem.message).join(' ')}
      </Alert>
    ) : null;
  }

  return (
    <Box direction="col" gap={2}>
      <ProfileResult
        problems={[...general, ...problems.warnings]}
        profile={validation.report}
      />
      <Typography color="secondary" size="text-xs">
        {t('message.ontology-profile-validation-help')}
      </Typography>
    </Box>
  );
};

export const AxiomActions = ({
  isReady,
  isSavable,
  isSubmitting,
  isValidating,
  size,
  onValidate,
}: {
  isReady: boolean;
  isSavable: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  size?: 'sm';
  onValidate: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
      <Button
        color="secondary"
        data-testid="ontology-axiom-validate"
        isDisabled={!isReady}
        isLoading={isValidating}
        size={size}
        onClick={onValidate}>
        {t('label.validate')}
      </Button>
      <Button
        color="primary"
        data-testid="ontology-axiom-submit"
        isDisabled={!isSavable}
        isLoading={isSubmitting}
        size={size}
        type="submit">
        {t('label.save')}
      </Button>
    </div>
  );
};

const TypeAndHelp = ({
  axiomType,
  form,
}: {
  axiomType: AxiomType;
  form: UseFormReturn<OntologyAxiomFormState>;
}) => {
  const { t } = useTranslation();
  const select = (key: Key | null) => {
    if (key) {
      const next = String(key) as AxiomType;
      form.setValue('axiomType', next, { shouldDirty: true });
      resetShape(form, next);
    }
  };

  return (
    <>
      <Select
        items={Object.values(AxiomType).map((type) => ({
          id: type,
          label: axiomTypeLabel(type, t),
        }))}
        label={t('label.type')}
        value={axiomType}
        onChange={select}>
        {(item) => (
          <Select.Item id={item.id} key={item.id} label={item.label} />
        )}
      </Select>
      <Card data-testid="ontology-axiom-help" size="sm" variant="muted">
        <Card.Content>
          <Typography color="secondary" size="text-sm">
            {t(
              `message.ontology-axiom-${axiomType
                .toLowerCase()
                .replaceAll('_', '-')}-help`
            )}
          </Typography>
        </Card.Content>
      </Card>
    </>
  );
};

const ExpressionList = ({
  form,
  references,
  values,
}: {
  form: UseFormReturn<OntologyAxiomFormState>;
  references?: OntologyReferenceOptions;
  values: OntologyAxiomFormState;
}) => {
  const { t } = useTranslation();
  const set = (expressions: OntologyExpression[]) =>
    form.setValue('expressions', expressions, { shouldDirty: true });

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {values.expressions.map((expression, index) => (
        <OntologyExpressionEditor
          expression={expression}
          key={getExpressionRenderKey(expression)}
          references={references}
          onChange={(next) =>
            set(
              values.expressions.map((entry, position) =>
                position === index ? next : entry
              )
            )
          }
          onRemove={() =>
            set(values.expressions.filter((_, position) => position !== index))
          }
        />
      ))}
      <Button
        color="secondary"
        size="sm"
        onClick={() =>
          set([
            ...values.expressions,
            defaultExpression(ExpressionKind.NamedClass),
          ])
        }>
        {t('label.add')} {t('label.constraint')}
      </Button>
    </div>
  );
};

export const AdvancedRuleFields = ({
  axiom,
  form,
  nameTouched,
  problems,
  references,
  values,
}: {
  axiom?: OntologyAxiom;
  form: UseFormReturn<OntologyAxiomFormState>;
  nameTouched: { current: boolean };
  problems: RoutedAxiomProblems['byField'];
  references?: OntologyReferenceOptions;
  values: OntologyAxiomFormState;
}) => {
  const { t } = useTranslation();
  const subjectOptions =
    values.axiomType === AxiomType.ClassAssertion ||
    !isClassExpressionAxiom(values.axiomType)
      ? undefined
      : references?.concepts;

  return (
    <>
      <TypeAndHelp axiomType={values.axiomType} form={form} />
      <Input
        isRequired
        isDisabled={Boolean(axiom)}
        label={t('label.rule-name')}
        value={values.name}
        onChange={(name) => {
          nameTouched.current = true;
          form.setValue('name', name, { shouldDirty: true });
        }}
      />
      <OntologyIriInput
        isRequired
        error={problems.subject}
        label={t('label.subject')}
        options={subjectOptions}
        testId="ontology-axiom-subject"
        value={values.subjectIri}
        onChange={(subjectIri) =>
          form.setValue('subjectIri', subjectIri, { shouldDirty: true })
        }
      />
      <AssertionFields
        form={form}
        problems={problems}
        references={references}
        values={values}
      />
      {isClassExpressionAxiom(values.axiomType) ? (
        <ExpressionList form={form} references={references} values={values} />
      ) : null}
    </>
  );
};
