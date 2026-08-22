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
  Input,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, Stars02 } from '@untitledui/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyDomainDraftResult } from '../../generated/api/data/ontologyDomainDraftResult';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  createOntologyChangeSet,
  generateOntologyDomainDraft,
} from '../../rest/ontologyAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { glossaryFqn } from './OntologyAiAssistant.utils';

interface OntologyAiDomainPanelProps {
  glossary: Glossary;
}

interface DomainDraftForm {
  changeSetName: string;
  description: string;
  displayName: string;
  domainDescription: string;
}

const EMPTY_FORM: DomainDraftForm = {
  changeSetName: '',
  description: '',
  displayName: '',
  domainDescription: '',
};

const OntologyAiDomainPanel = ({ glossary }: OntologyAiDomainPanelProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<DomainDraftForm>(EMPTY_FORM);
  const [result, setResult] = useState<OntologyDomainDraftResult>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const canGenerate = Object.values(form).every(
    (value) => value.trim().length > 0
  );

  const updateField = (field: keyof DomainDraftForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setResult(undefined);
    setIsCreated(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generatedResult = await generateOntologyDomainDraft({
        changeSetName: form.changeSetName.trim(),
        description: form.description.trim(),
        displayName: form.displayName.trim(),
        domainDescription: form.domainDescription.trim(),
        glossary: glossaryFqn(glossary),
        maxConcepts: 25,
      });
      setResult(generatedResult);
    } catch {
      showErrorToast(t('server.unexpected-error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateDraft = async () => {
    if (result) {
      setIsCreating(true);
      try {
        await createOntologyChangeSet(result.draft);
        setIsCreated(true);
        showSuccessToast(t('message.ontology-ai-draft-created'));
      } catch {
        showErrorToast(t('server.unexpected-error'));
      } finally {
        setIsCreating(false);
      }
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div>
        <Typography as="h2" size="text-lg" weight="semibold">
          {t('label.domain-draft')}
        </Typography>
        <Typography as="p" className="tw:mt-1 tw:text-tertiary" size="text-sm">
          {t('message.ontology-ai-domain-description')}
        </Typography>
      </div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
        <Input
          isRequired
          label={t('label.change-set-name')}
          value={form.changeSetName}
          onChange={(value) => updateField('changeSetName', value)}
        />
        <Input
          isRequired
          label={t('label.display-name')}
          value={form.displayName}
          onChange={(value) => updateField('displayName', value)}
        />
      </div>
      <TextArea
        isRequired
        label={t('label.draft-description')}
        rows={3}
        value={form.description}
        onChange={(value) => updateField('description', value)}
      />
      <TextArea
        isRequired
        label={t('label.domain-description')}
        placeholder={t('message.ontology-ai-domain-placeholder')}
        rows={5}
        value={form.domainDescription}
        onChange={(value) => updateField('domainDescription', value)}
      />
      <div>
        <Button
          color="primary"
          data-testid="generate-domain-draft"
          iconLeading={Stars02}
          isDisabled={!canGenerate}
          isLoading={isGenerating}
          onPress={() => void handleGenerate()}>
          {t('label.generate-draft')}
        </Button>
      </div>
      {result ? (
        <Card data-testid="ontology-ai-domain-preview" size="md">
          <Card.Header
            subtitle={t('message.ontology-ai-domain-preview', {
              count: result.draft.operations?.length ?? 0,
            })}
            title={result.draft.displayName}
          />
          <Card.Content>
            <Typography as="p" className="tw:text-secondary" size="text-sm">
              {result.draft.description}
            </Typography>
          </Card.Content>
          <Card.Footer className="tw:flex tw:justify-end">
            <Button
              color="primary"
              data-testid="create-generated-domain-draft"
              iconLeading={Check}
              isDisabled={isCreated}
              isLoading={isCreating}
              onPress={() => void handleCreateDraft()}>
              {isCreated ? t('label.draft-created') : t('label.create-draft')}
            </Button>
          </Card.Footer>
        </Card>
      ) : null}
    </div>
  );
};

export default OntologyAiDomainPanel;
