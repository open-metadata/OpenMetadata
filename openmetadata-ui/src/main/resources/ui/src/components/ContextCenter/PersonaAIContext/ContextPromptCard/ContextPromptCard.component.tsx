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
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERSONA_CONTEXT_PROMPT_MAX_LENGTH } from '../../../../constants/PersonaAIContext.constants';

interface ContextPromptCardProps {
  canEdit: boolean;
  prompt?: string;
  onSave: (prompt: string) => Promise<void>;
}

const CARD_CLASS = 'tw:mb-6 tw:rounded-[10px] tw:px-5 tw:py-4.5 tw:shadow-xs';

/**
 * The persona's prompt: instructions the AI assistant follows for this persona's users. Editors
 * get a draft they save explicitly; everyone else reads it, or sees nothing when none is set.
 */
export const ContextPromptCard = ({
  canEdit,
  prompt = '',
  onSave,
}: ContextPromptCardProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(prompt);
  const [isSaving, setIsSaving] = useState(false);

  // The saved prompt can move underneath the draft: a version restore, or a save's trimmed echo.
  useEffect(() => {
    setDraft(prompt);
  }, [prompt]);

  if (!canEdit && !prompt) {
    return null;
  }

  // The server trims, so whitespace alone would write back the same prompt.
  const isDirty = draft.trim() !== prompt;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <Card className={CARD_CLASS} data-testid="persona-ai-context-prompt-card">
        <Box className="tw:gap-1.5" direction="col">
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.prompt')}
          </Typography>
          <Typography
            as="p"
            className="tw:m-0 tw:whitespace-pre-wrap tw:text-secondary"
            data-testid="persona-context-prompt-text"
            size="text-sm">
            {prompt}
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASS} data-testid="persona-ai-context-prompt-card">
      <Box direction="col" gap={3}>
        <TextArea
          hint={t('message.persona-context-prompt-description')}
          isDisabled={isSaving}
          label={t('label.prompt')}
          maxLength={PERSONA_CONTEXT_PROMPT_MAX_LENGTH}
          placeholder={t('message.persona-context-prompt-placeholder')}
          rows={5}
          value={draft}
          onChange={setDraft}
        />
        <Box gap={2} justify="end">
          <Button
            color="secondary"
            data-testid="persona-context-prompt-cancel"
            isDisabled={!isDirty || isSaving}
            onPress={() => setDraft(prompt)}>
            {t('label.cancel')}
          </Button>
          <Button
            showTextWhileLoading
            color="primary"
            data-testid="persona-context-prompt-save"
            isDisabled={!isDirty || isSaving}
            isLoading={isSaving}
            onPress={handleSave}>
            {t('label.save')}
          </Button>
        </Box>
      </Box>
    </Card>
  );
};
