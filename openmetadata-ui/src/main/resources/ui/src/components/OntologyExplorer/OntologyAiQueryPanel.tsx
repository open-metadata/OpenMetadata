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
  Button,
  Card,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight, Stars02 } from '@untitledui/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyNaturalLanguageQueryResult } from '../../generated/api/data/ontologyNaturalLanguageQueryResult';
import { Glossary } from '../../generated/entity/data/glossary';
import { generateOntologySparql } from '../../rest/ontologyAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { glossaryFqn } from './OntologyAiAssistant.utils';

interface OntologyAiQueryPanelProps {
  glossary: Glossary;
  onOpenQuery: (query: string) => void;
}

const OntologyAiQueryPanel = ({
  glossary,
  onOpenQuery,
}: OntologyAiQueryPanelProps) => {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<OntologyNaturalLanguageQueryResult>();
  const [isGenerating, setIsGenerating] = useState(false);
  const canGenerate = question.trim().length > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generatedResult = await generateOntologySparql({
        glossaries: [glossaryFqn(glossary)],
        question: question.trim(),
      });
      setResult(generatedResult);
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div>
        <Typography as="h2" size="text-lg" weight="semibold">
          {t('label.natural-language-query')}
        </Typography>
        <Typography as="p" className="tw:mt-1 tw:text-tertiary" size="text-sm">
          {t('message.ontology-ai-query-description')}
        </Typography>
      </div>
      <TextArea
        isRequired
        label={t('label.question')}
        placeholder={t('message.ontology-ai-question-placeholder')}
        rows={4}
        value={question}
        onChange={setQuestion}
      />
      <div>
        <Button
          color="primary"
          data-testid="generate-ontology-sparql"
          iconLeading={Stars02}
          isDisabled={!canGenerate}
          isLoading={isGenerating}
          onPress={() => void handleGenerate()}>
          {t('label.generate-sparql')}
        </Button>
      </div>
      {result ? (
        <Card data-testid="ontology-ai-generated-query" size="md">
          <Card.Header
            subtitle={result.explanation}
            title={t('label.generated-sparql')}
          />
          <Card.Content>
            <pre
              className="tw:max-h-96 tw:overflow-auto tw:rounded-lg tw:bg-tertiary tw:p-4 tw:text-sm tw:whitespace-pre-wrap tw:text-primary"
              data-testid="ontology-ai-query-text">
              {result.query}
            </pre>
          </Card.Content>
          <Card.Footer className="tw:flex tw:justify-end">
            <Button
              color="secondary"
              iconTrailing={ArrowRight}
              onPress={() => onOpenQuery(result.query)}>
              {t('label.open-in-query-console')}
            </Button>
          </Card.Footer>
        </Card>
      ) : null}
    </div>
  );
};

export default OntologyAiQueryPanel;
