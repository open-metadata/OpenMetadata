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
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Stars02 } from '@untitledui/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyRelationshipSuggestion } from '../../generated/api/data/ontologyRelationshipSuggestionList';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import {
  createOntologyChangeSet,
  suggestOntologyRelationships,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  buildOntologyAiScope,
  glossaryFqn,
  proposalChangeSet,
  relationshipDraftOperation,
} from './OntologyAiAssistant.utils';
import OntologyAiSuggestionCard from './OntologyAiSuggestionCard';
import { OntologyGraphData } from './OntologyExplorer.interface';

interface OntologyAiRelationshipPanelProps {
  canCreateDraft: boolean;
  glossary: Glossary;
  graphData: OntologyGraphData | null;
  relationshipTypes: RelationshipType[];
}

const entityLabel = (entity: {
  displayName?: string;
  name?: string;
  id: string;
}): string => entity.displayName ?? entity.name ?? entity.id;

const OntologyAiRelationshipPanel = ({
  canCreateDraft,
  glossary,
  graphData,
  relationshipTypes,
}: OntologyAiRelationshipPanelProps) => {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState('');
  const [suggestions, setSuggestions] = useState<
    OntologyRelationshipSuggestion[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string>();
  const [hasGenerated, setHasGenerated] = useState(false);
  const scope = useMemo(
    () => buildOntologyAiScope(graphData, glossary.id, relationshipTypes),
    [glossary.id, graphData, relationshipTypes]
  );
  const canGenerate =
    scope.sourceTermIds.length > 0 &&
    scope.candidateTermIds.length > 0 &&
    scope.relationshipTypeIds.length > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await suggestOntologyRelationships({
        candidateTermIds: scope.candidateTermIds,
        glossary: glossaryFqn(glossary),
        instructions: instructions.trim() || undefined,
        maxSuggestions: 10,
        relationshipTypeIds: scope.relationshipTypeIds,
        sourceTermIds: scope.sourceTermIds,
      });
      setSuggestions(result.suggestions);
      setHasGenerated(true);
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = async (suggestion: OntologyRelationshipSuggestion) => {
    setAcceptingId(suggestion.id);
    try {
      const request = proposalChangeSet(
        glossary,
        suggestion.id,
        t('label.ai-relationship-proposal'),
        t('message.ontology-ai-proposal-draft-description'),
        relationshipDraftOperation(suggestion)
      );
      await createOntologyChangeSet(request);
      setSuggestions((current) =>
        current.filter((item) => item.id !== suggestion.id)
      );
      showSuccessToast(t('message.ontology-ai-draft-created'));
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setAcceptingId(undefined);
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div>
        <Typography as="h2" size="text-lg" weight="semibold">
          {t('label.relationship-suggestions')}
        </Typography>
        <Typography as="p" className="tw:mt-1 tw:text-tertiary" size="text-sm">
          {t('message.ontology-ai-relationship-description')}
        </Typography>
      </div>
      <TextArea
        label={t('label.instructions')}
        placeholder={t('message.ontology-ai-instructions-placeholder')}
        rows={3}
        value={instructions}
        onChange={setInstructions}
      />
      {!canGenerate ? (
        <Alert
          title={t('message.ontology-ai-relationship-scope-empty')}
          variant="warning"
        />
      ) : null}
      <div>
        <Button
          color="primary"
          data-testid="generate-relationship-suggestions"
          iconLeading={Stars02}
          isDisabled={!canGenerate}
          isLoading={isGenerating}
          onPress={() => void handleGenerate()}>
          {t('label.generate-suggestions')}
        </Button>
      </div>
      {hasGenerated && suggestions.length === 0 ? (
        <Alert title={t('message.ontology-ai-no-suggestions')} variant="gray" />
      ) : null}
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-2">
        {suggestions.map((suggestion) => {
          const relationship = suggestion.operation.relationship;
          const title = relationship
            ? `${entityLabel(relationship.fromTerm)} → ${entityLabel(
                relationship.toTerm
              )}`
            : t('label.relationship');
          const subtitle = relationship
            ? entityLabel(relationship.relationshipType)
            : t('label.relationship-type');

          return (
            <OntologyAiSuggestionCard
              canAccept={canCreateDraft}
              confidence={suggestion.confidence}
              isAccepting={acceptingId === suggestion.id}
              key={suggestion.id}
              rationale={suggestion.rationale}
              subtitle={subtitle}
              testId={`relationship-suggestion-${suggestion.id}`}
              title={title}
              onAccept={() => void handleAccept(suggestion)}
              onDismiss={() =>
                setSuggestions((current) =>
                  current.filter((item) => item.id !== suggestion.id)
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
};

export default OntologyAiRelationshipPanel;
