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
  Card,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEqual } from 'lodash';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyAxiom } from '../../../../generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import {
  createOntologyAxiom,
  softDeleteOntologyDefinition,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getPropertyLabel,
  OntologyModelRelation,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { generateUUID } from '../../../../utils/StringUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DeleteModal from '../../../common/DeleteModal/DeleteModal';
import InlineEmptyPlaceholder from '../../../common/EmptyPlaceholder/InlineEmptyPlaceholder';
import {
  InspectorList,
  InspectorRemoveButton,
  InspectorRow,
} from '../../../OntologyExplorer/OntologyInspectorSection';
import {
  axiomFormValues,
  AxiomOutcome,
  collectAxiomProblems,
  previewSentence,
} from '../OntologyAxiomEditor/OntologyAxiomEditor.parts';
import { buildOntologyAxiomRequest } from '../OntologyAxiomEditor/OntologyAxiomEditor.utils';
import {
  EMPTY_QUICK_RULE,
  isQuickRuleReady,
  QuickQuantifier,
  QuickRule,
  QuickRuleKind,
  quickRuleToForm,
  QUICK_QUANTIFIERS,
  QUICK_QUANTIFIER_LABELS,
  QUICK_RULE_LABELS,
  RoutedAxiomProblems,
  ruleNameFromSentence,
} from '../OntologyAxiomEditor/OntologyAxiomQuickRule.utils';
import { useOntologyAxiomValidation } from '../OntologyAxiomEditor/useOntologyAxiomValidation';
import OntologyIriInput from '../OntologyIriInput/OntologyIriInput';
import { OntologyReferenceOptions } from '../OntologyIriInput/OntologyIriInput.types';
import {
  ConceptFormCard,
  ConceptFormHeading,
  ConceptSection,
} from './OntologyConceptSection';

interface OntologyConceptRulesProps {
  readonly canAdd?: boolean;
  /** A rule is added only while the concept is being edited. */
  readonly isEditing: boolean;
  readonly concept: OntologyConcept;
  readonly model: OntologyStudioModel;
  readonly relations: readonly OntologyModelRelation[];
  readonly onCreated?: () => void;
}

const RULE_HELP: Record<QuickRuleKind, string> = {
  [QuickRuleKind.MustHave]: 'message.ontology-rule-must-have-short-help',
  [QuickRuleKind.NeverAlsoBe]: 'message.ontology-rule-never-also-be-short-help',
  [QuickRuleKind.SameAs]: 'message.ontology-rule-quick-same-as-help',
};

/** The quick rule's fields without a subject: the form is about this concept only. */
const ConceptRuleFields = ({
  problems,
  references,
  rule,
  onChange,
}: {
  readonly problems: RoutedAxiomProblems['byField'];
  readonly references: OntologyReferenceOptions;
  readonly rule: QuickRule;
  readonly onChange: (patch: Partial<QuickRule>) => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Select
        hint={t(RULE_HELP[rule.kind])}
        items={Object.values(QuickRuleKind).map((kind) => ({
          id: kind,
          label: t(QUICK_RULE_LABELS[kind]),
        }))}
        label={t('label.ontology-rule-type')}
        value={rule.kind}
        onChange={(key) =>
          key && onChange({ kind: String(key) as QuickRuleKind })
        }>
        {(item) => (
          <Select.Item id={item.id} key={item.id} label={item.label} />
        )}
      </Select>
      {rule.kind === QuickRuleKind.MustHave ? (
        <div className="tw:grid tw:grid-cols-[1.4fr_0.6fr_2fr] tw:items-start tw:gap-3">
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
            hint={problems.count}
            isInvalid={Boolean(problems.count)}
            label={t('label.count')}
            type="number"
            value={String(rule.count)}
            onChange={(count) =>
              onChange({ count: Math.max(0, Math.floor(Number(count) || 0)) })
            }
          />
          <OntologyIriInput
            isNameOnly
            error={problems.property}
            label={t('label.property')}
            options={references.properties}
            testId="ontology-rule-property"
            value={rule.propertyIri}
            onChange={(propertyIri) => onChange({ propertyIri })}
          />
        </div>
      ) : (
        <OntologyIriInput
          isNameOnly
          error={problems.other}
          label={t('label.concept')}
          options={references.concepts}
          testId="ontology-rule-other"
          value={rule.otherIri}
          onChange={(otherIri) => onChange({ otherIri })}
        />
      )}
    </>
  );
};

/** The Constraints tab's quick rule, with the subject fixed to this concept. */
const ConceptRuleForm = ({
  concept,
  model,
  onClose,
  onCreated,
}: {
  readonly concept: OntologyConcept;
  readonly model: OntologyStudioModel;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}) => {
  const { t } = useTranslation();
  const [rule, setRule] = useState<QuickRule>({
    ...EMPTY_QUICK_RULE,
    subjectIri: concept.iri,
  });
  // A rule with anything filled in is unsaved work: closing the drawer asks before dropping it.
  useOntologyDirtyForm(
    !isEqual(rule, { ...EMPTY_QUICK_RULE, subjectIri: concept.iri })
  );
  const [isSaving, setIsSaving] = useState(false);
  const nameSuffix = useRef(generateUUID().slice(0, 6));
  const references = useMemo(
    () => ({
      concepts: model.concepts.map((candidate) => ({
        iri: candidate.iri,
        label: getEntityName(candidate),
      })),
      properties: model.properties
        .filter((property) => !property.deleted)
        .map((property) => ({
          iri: property.iri,
          kind: property.kind,
          label: getPropertyLabel(property),
        })),
    }),
    [model]
  );
  const ontologyFqn = model.ontology.fullyQualifiedName ?? model.ontology.name;
  const base = quickRuleToForm(rule, axiomFormValues());
  const sentence = previewSentence(base, t, references);
  const values = {
    ...base,
    name: ruleNameFromSentence(sentence, nameSuffix.current),
  };
  const validation = useOntologyAxiomValidation(values, ontologyFqn, sentence);
  const problems = collectAxiomProblems(validation.current, true);

  // Same gate as the Constraints editor: the server must accept the rule before it is written.
  const save = async () => {
    setIsSaving(true);
    try {
      const report = await validation.validate(values);
      if (!report?.valid) {
        return;
      }
      await createOntologyAxiom(
        buildOntologyAxiomRequest(ontologyFqn, values, sentence)
      );
      onCreated();
      onClose();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConceptFormCard testId="ontology-rule-form">
      <ConceptFormHeading
        hint={t('message.rule-applies-to-every-concept', {
          name: getEntityName(concept),
        })}
        title={t('label.ontology-new-rule')}
      />
      {problems.routed.byField.subject ? (
        <Typography color="danger" role="alert" size="text-xs">
          {problems.routed.byField.subject}
        </Typography>
      ) : null}
      <ConceptRuleFields
        problems={problems.routed.byField}
        references={references}
        rule={rule}
        onChange={(patch) => setRule((current) => ({ ...current, ...patch }))}
      />
      <Card data-testid="ontology-axiom-preview" size="sm" variant="muted">
        <Card.Content className="tw:flex tw:flex-col tw:gap-1">
          <Typography color="secondary" size="text-xs" weight="medium">
            {t('label.preview')}
          </Typography>
          <Typography size="text-sm">
            {isQuickRuleReady(rule)
              ? sentence
              : t('message.ontology-rule-preview-empty')}
          </Typography>
        </Card.Content>
      </Card>
      <AxiomOutcome problems={problems} validation={validation.current} />
      <Box gap={2} justify="end">
        <Button
          color="secondary"
          isDisabled={isSaving}
          size="sm"
          onPress={onClose}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="ontology-rule-submit"
          isDisabled={!isQuickRuleReady(rule)}
          isLoading={isSaving}
          size="sm"
          onPress={() => void save()}>
          {t('label.ontology-add-rule')}
        </Button>
      </Box>
    </ConceptFormCard>
  );
};

/** The rules about this concept: its axioms that are not drawn as relationships. */
const OntologyConceptRules = ({
  canAdd,
  isEditing,
  concept,
  model,
  relations,
  onCreated,
}: OntologyConceptRulesProps) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  // Deleting a rule is not undoable here, so it asks first.
  const [pendingRule, setPendingRule] = useState<OntologyAxiom>();
  const canDelete = [canAdd, isEditing, onCreated].every(Boolean);
  const subject = getEntityName(concept);
  // The design greys the concept a rule is about, so the rule itself reads first.
  const renderRuleText = (text: string) =>
    text.startsWith(`${subject} `) ? (
      <>
        <span className="tw:text-tertiary">{subject}</span>
        {text.slice(subject.length)}
      </>
    ) : (
      text
    );
  const deleteRule = async (id: string) => {
    setDeletingId(id);
    try {
      await softDeleteOntologyDefinition('axiom', id);
      onCreated?.();
      setPendingRule(undefined);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setDeletingId(undefined);
    }
  };
  const ruleText = (rule: OntologyAxiom) =>
    rule.displayName || rule.description || rule.name;
  const rules = useMemo(() => {
    const drawn = new Set(
      relations.flatMap((relation) =>
        relation.axiom ? [relation.axiom.id] : []
      )
    );

    return model.axioms.filter(
      (axiom) =>
        axiom.subjectIri === concept.iri &&
        !axiom.deleted &&
        !drawn.has(axiom.id)
    );
  }, [concept.iri, model.axioms, relations]);

  return (
    <ConceptSection
      addTestId="ontology-add-rule"
      count={rules.length}
      testId="ontology-concept-rules"
      title={t('label.rule-plural')}
      onAdd={
        [canAdd, isEditing, onCreated, !isAdding].every(Boolean)
          ? () => setIsAdding(true)
          : undefined
      }>
      {isAdding && onCreated ? (
        <ConceptRuleForm
          concept={concept}
          model={model}
          onClose={() => setIsAdding(false)}
          onCreated={onCreated}
        />
      ) : null}
      {rules.length > 0 ? (
        <InspectorList>
          {rules.map((rule) => (
            <InspectorRow key={rule.id}>
              <Typography
                className="tw:min-w-0 tw:flex-1"
                data-testid={`ontology-concept-rule-${rule.id}`}
                size="text-sm">
                {renderRuleText(ruleText(rule))}
              </Typography>
              {canDelete ? (
                <InspectorRemoveButton
                  isDisabled={deletingId === rule.id}
                  label={t('label.delete-entity', { entity: t('label.rule') })}
                  testId={`ontology-concept-rule-delete-${rule.id}`}
                  onRemove={() => setPendingRule(rule)}
                />
              ) : null}
            </InspectorRow>
          ))}
        </InspectorList>
      ) : (
        <InlineEmptyPlaceholder
          data-testid="ontology-concept-empty"
          title={t('message.ontology-no-rules-yet-hint')}
          variant="text"
        />
      )}
      <DeleteModal
        entityTitle={t('label.rule')}
        isDeleting={Boolean(pendingRule && deletingId === pendingRule.id)}
        message={pendingRule ? ruleText(pendingRule) : ''}
        open={Boolean(pendingRule)}
        onCancel={() => setPendingRule(undefined)}
        onDelete={() => pendingRule && void deleteRule(pendingRule.id)}
      />
    </ConceptSection>
  );
};

export default OntologyConceptRules;
