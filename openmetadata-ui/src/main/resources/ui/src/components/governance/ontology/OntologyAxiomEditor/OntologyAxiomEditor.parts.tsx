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
  FieldTypes,
  getField,
  Input,
  Label,
  Select,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@openmetadata/ui-core-components/icons';
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

/**
 * A field as the design lays it out: label, a one-line description under it, then the control.
 * The control carries its own accessible name, since this label is not bound to it.
 */
const DescribedField = ({
  children,
  description,
  isRequired,
  label,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly isRequired?: boolean;
  readonly label: string;
}) => (
  <div className="tw:flex tw:flex-col tw:gap-1.5">
    <div className="tw:flex tw:flex-col">
      <Label isRequired={isRequired}>{label}</Label>
      <Typography className="tw:text-tertiary" size="text-xs">
        {description}
      </Typography>
    </div>
    {children}
  </div>
);

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

export const AxiomPreview = ({ sentence }: { sentence: string }) => {
  const { t } = useTranslation();

  return (
    <Card data-testid="ontology-axiom-preview" size="sm" variant="muted">
      <Card.Content className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-tertiary"
          size="text-xs"
          weight="semibold">
          {t('label.reads-as')}
        </Typography>
        <Typography
          className={sentence ? 'tw:text-primary' : 'tw:text-tertiary'}
          size="text-sm">
          {sentence || t('message.ontology-axiom-preview-empty')}
        </Typography>
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
      <DescribedField
        isRequired
        description={t('message.ontology-rule-subject-help')}
        label={t('label.subject')}>
        <OntologyIriInput
          hideLabel
          isRequired
          error={problems.subject}
          label={t('label.subject')}
          options={references?.concepts}
          testId="ontology-rule-subject"
          value={rule.subjectIri}
          onChange={(subjectIri) => onChange({ subjectIri })}
        />
      </DescribedField>
      <DescribedField
        description={t('message.ontology-rule-kind-help')}
        label={t('label.rule')}>
        <Select
          aria-label={t('label.rule')}
          items={Object.values(QuickRuleKind).map((kind) => ({
            id: kind,
            label: t(QUICK_RULE_LABELS[kind]),
          }))}
          value={rule.kind}
          onChange={(key) =>
            key && onChange({ kind: String(key) as QuickRuleKind })
          }>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
        <Typography
          className="tw:text-tertiary"
          data-testid="ontology-rule-quick-help"
          size="text-xs">
          {t(QUICK_RULE_HELP[rule.kind])}
        </Typography>
      </DescribedField>
      {isMustHave ? (
        <>
          <DescribedField
            description={t('message.ontology-rule-quantity-help')}
            label={t('label.quantity')}>
            <Select
              aria-label={t('label.quantity')}
              items={QUICK_QUANTIFIERS.map((quantifier) => ({
                id: quantifier,
                label: t(QUICK_QUANTIFIER_LABELS[quantifier]),
              }))}
              value={rule.quantifier}
              onChange={(key) =>
                key && onChange({ quantifier: String(key) as QuickQuantifier })
              }>
              {(item) => (
                <Select.Item id={item.id} key={item.id} label={item.label} />
              )}
            </Select>
          </DescribedField>
          <DescribedField
            isRequired
            description={t('message.ontology-rule-count-help')}
            label={t('label.cardinality')}>
            <Input
              isRequired
              aria-label={t('label.cardinality')}
              hint={problems.count}
              isInvalid={Boolean(problems.count)}
              type="number"
              value={String(rule.count)}
              onChange={(count) =>
                onChange({ count: Math.max(0, Math.floor(Number(count) || 0)) })
              }
            />
          </DescribedField>
          <DescribedField
            isRequired
            description={t('message.ontology-rule-property-help')}
            label={t('label.property')}>
            <OntologyIriInput
              hideLabel
              isRequired
              error={problems.property}
              label={t('label.property')}
              options={references?.properties}
              testId="ontology-rule-property"
              value={rule.propertyIri}
              onChange={(propertyIri) => onChange({ propertyIri })}
            />
          </DescribedField>
        </>
      ) : (
        <DescribedField
          isRequired
          description={t('message.ontology-picker-paste-hint')}
          label={t('label.concept')}>
          <OntologyIriInput
            hideLabel
            isRequired
            error={problems.other}
            label={t('label.concept')}
            options={references?.concepts}
            testId="ontology-rule-other"
            value={rule.otherIri}
            onChange={(otherIri) => onChange({ otherIri })}
          />
        </DescribedField>
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

  // A grey band across the drawer, whose body pads 24px on each side.
  return (
    <div className="tw:-mx-6 tw:-mt-6 tw:mb-1 tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-b tw:border-secondary tw:bg-secondary tw:px-6 tw:py-3">
      {/* The design's segmented control; the panels are empty because the form below follows the mode. */}
      <Tabs
        className="tw:w-fit"
        data-testid="ontology-axiom-mode"
        selectedKey={mode}
        onSelectionChange={(key) => onChange(key as AxiomEditorMode)}>
        <Tabs.List aria-label={t('label.rule')} size="sm" type="button-minimal">
          <Tabs.Item
            data-testid="ontology-axiom-mode-quick"
            id="quick"
            label={t('label.quick')}
          />
          <Tabs.Item
            data-testid="ontology-axiom-mode-advanced"
            id="advanced"
            label={t('label.advanced')}
          />
        </Tabs.List>
        <Tabs.Panel className="tw:hidden" id="quick" />
        <Tabs.Panel className="tw:hidden" id="advanced" />
      </Tabs>
      <Typography className="tw:text-tertiary" size="text-sm">
        {t(
          mode === 'quick'
            ? 'message.ontology-axiom-quick-help'
            : 'message.ontology-axiom-advanced-help'
        )}
      </Typography>
    </div>
  );
};

export const AxiomDetailFields = () => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <DescribedField
        description={t('message.ontology-rule-display-name-help')}
        label={t('label.display-name')}>
        {getField({
          label: '',
          name: 'displayName',
          type: FieldTypes.TEXT,
          placeholder: t('message.ontology-rule-display-name-placeholder'),
          props: { 'aria-label': t('label.display-name') },
        })}
      </DescribedField>
      <DescribedField
        description={t('message.ontology-rule-description-help')}
        label={t('label.description')}>
        {getField({
          label: '',
          name: 'description',
          type: FieldTypes.TEXTAREA,
          props: { 'aria-label': t('label.description'), size: 'sm' },
        })}
      </DescribedField>
    </div>
  );
};

/** The design's closing note: saving records the rule, publishing makes it live. */
export const AxiomPublishNote = () => {
  const { t } = useTranslation();

  return (
    <Box align="center" gap={2}>
      <InfoCircle
        aria-hidden
        className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
      />
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('message.ontology-rule-publish-note')}
      </Typography>
    </Box>
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

  const listed = [...general, ...problems.warnings];
  // A failure whose every error already sits under its field adds nothing.
  if (!validation.report.valid && !listed.length) {
    return null;
  }

  return (
    <Box direction="col" gap={2}>
      <ProfileResult problems={listed} profile={validation.report} />
      <Typography color="secondary" size="text-xs">
        {t('message.ontology-profile-validation-help')}
      </Typography>
    </Box>
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
      <Typography
        color="secondary"
        data-testid="ontology-axiom-help"
        size="text-sm">
        {t(
          `message.ontology-axiom-${axiomType
            .toLowerCase()
            .replaceAll('_', '-')}-help`
        )}
      </Typography>
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
