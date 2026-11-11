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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { createOntologyAxiom } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getPropertyLabel,
  OntologyModelRelation,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { generateUUID } from '../../../../utils/StringUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  InspectorList,
  InspectorRow,
} from '../../../OntologyExplorer/OntologyInspectorSection';
import {
  axiomFormValues,
  AxiomOutcome,
  AxiomPreview,
  collectAxiomProblems,
  previewSentence,
  QuickRuleFields,
} from '../OntologyAxiomEditor/OntologyAxiomEditor.parts';
import { buildOntologyAxiomRequest } from '../OntologyAxiomEditor/OntologyAxiomEditor.utils';
import {
  EMPTY_QUICK_RULE,
  isQuickRuleReady,
  QuickRule,
  quickRuleToForm,
  ruleNameFromSentence,
} from '../OntologyAxiomEditor/OntologyAxiomQuickRule.utils';
import { useOntologyAxiomValidation } from '../OntologyAxiomEditor/useOntologyAxiomValidation';
import {
  ConceptEmptyState,
  ConceptFormCard,
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
      <QuickRuleFields
        problems={problems.routed.byField}
        references={references}
        rule={rule}
        onChange={(patch) => setRule((current) => ({ ...current, ...patch }))}
      />
      <AxiomPreview sentence={sentence} />
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
          {t('label.add-rule')}
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
                {rule.displayName || rule.description || rule.name}
              </Typography>
            </InspectorRow>
          ))}
        </InspectorList>
      ) : (
        <ConceptEmptyState
          title={t('label.no-entity', { entity: t('label.rule-plural') })}
        />
      )}
    </ConceptSection>
  );
};

export default OntologyConceptRules;
