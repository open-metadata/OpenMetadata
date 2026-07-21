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
  Input,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Stars02 } from '@untitledui/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyMappingSuggestion } from '../../generated/api/data/ontologyMappingSuggestionList';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  createOntologyChangeSet,
  suggestOntologyMappings,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  buildMappingSourceTermIds,
  glossaryFqn,
  mappingDraftOperation,
  proposalChangeSet,
} from './OntologyAiAssistant.utils';
import OntologyAiSuggestionCard from './OntologyAiSuggestionCard';
import { OntologyGraphData } from './OntologyExplorer.interface';

interface OntologyAiMappingPanelProps {
  canCreateDraft: boolean;
  glossary: Glossary;
  graphData: OntologyGraphData | null;
}

const parseStandards = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 10);

const OntologyAiMappingPanel = ({
  canCreateDraft,
  glossary,
  graphData,
}: OntologyAiMappingPanelProps) => {
  const { t } = useTranslation();
  const [standardsText, setStandardsText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [suggestions, setSuggestions] = useState<OntologyMappingSuggestion[]>(
    []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string>();
  const [hasGenerated, setHasGenerated] = useState(false);
  const sourceTermIds = useMemo(
    () => buildMappingSourceTermIds(graphData, glossary.id),
    [glossary.id, graphData]
  );
  const standards = useMemo(
    () => parseStandards(standardsText),
    [standardsText]
  );
  const canGenerate = sourceTermIds.length > 0 && standards.length > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await suggestOntologyMappings({
        glossary: glossaryFqn(glossary),
        instructions: instructions.trim() || undefined,
        maxSuggestions: 10,
        sourceTermIds,
        standards,
      });
      setSuggestions(result.suggestions);
      setHasGenerated(true);
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = async (suggestion: OntologyMappingSuggestion) => {
    setAcceptingId(suggestion.id);
    try {
      const request = proposalChangeSet(
        glossary,
        suggestion.id,
        t('label.ai-mapping-proposal'),
        t('message.ontology-ai-proposal-draft-description'),
        mappingDraftOperation(suggestion)
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

  const sourceLabel = (suggestion: OntologyMappingSuggestion): string => {
    const sourceId = suggestion.operation.targetId;
    const sourceNode = graphData?.nodes.find(
      (node) => (node.termId ?? node.entityRef?.id ?? node.id) === sourceId
    );

    return sourceNode?.label ?? t('label.concept');
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div>
        <Typography as="h2" size="text-lg" weight="semibold">
          {t('label.mapping-suggestions')}
        </Typography>
        <Typography as="p" className="tw:mt-1 tw:text-tertiary" size="text-sm">
          {t('message.ontology-ai-mapping-description')}
        </Typography>
      </div>
      <Input
        isRequired
        label={t('label.standard-plural')}
        placeholder={t('message.ontology-ai-standards-placeholder')}
        value={standardsText}
        onChange={setStandardsText}
      />
      <TextArea
        label={t('label.instructions')}
        placeholder={t('message.ontology-ai-instructions-placeholder')}
        rows={3}
        value={instructions}
        onChange={setInstructions}
      />
      {sourceTermIds.length === 0 ? (
        <Alert
          title={t('message.ontology-ai-mapping-scope-empty')}
          variant="warning"
        />
      ) : null}
      <div>
        <Button
          color="primary"
          data-testid="generate-mapping-suggestions"
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
        {suggestions.map((suggestion) => (
          <OntologyAiSuggestionCard
            canAccept={canCreateDraft}
            confidence={suggestion.confidence}
            isAccepting={acceptingId === suggestion.id}
            key={suggestion.id}
            rationale={suggestion.rationale}
            subtitle={suggestion.operation.mapping?.conceptIri ?? ''}
            testId={`mapping-suggestion-${suggestion.id}`}
            title={`${sourceLabel(suggestion)} → ${suggestion.targetLabel}`}
            onAccept={() => void handleAccept(suggestion)}
            onDismiss={() =>
              setSuggestions((current) =>
                current.filter((item) => item.id !== suggestion.id)
              )
            }
          />
        ))}
      </div>
    </div>
  );
};

export default OntologyAiMappingPanel;
