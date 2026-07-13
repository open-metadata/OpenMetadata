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
  Badge,
  BadgeColors,
  Box,
  Button,
  Card,
  Divider,
  FeaturedIcon,
  Input,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock, ClockRewind, Eye, FolderPlus, Plus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PERSONA_CONTEXT_DEFINITION } from '../../../../constants/PersonaAIContext.constants';
import { Persona } from '../../../../generated/entity/teams/persona';
import {
  CacheState,
  ContextRule,
  PersonaContextDefinition,
} from '../../../../generated/type/personaContextDefinition';
import {
  createPersonaAIContextRule,
  deletePersonaAIContextRule,
  getPersonaAIContext,
  PersonaContextDocument,
  updatePersonaAIContext,
  updatePersonaAIContextRule,
} from '../../../../rest/PersonaAPI';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { normalizePersonaContextDefinition } from '../../../../utils/PersonaAIContextUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import { ContextPreviewModal } from './ContextPreviewModal/ContextPreviewModal.component';
import { ContextRuleCard } from './ContextRuleCard/ContextRuleCard.component';
import { ContextRuleEditor } from './ContextRuleEditor/ContextRuleEditor.component';
import { VersionHistoryDrawer } from './VersionHistoryDrawer/VersionHistoryDrawer.component';

interface PersonaAIContextProps {
  canEdit: boolean;
  persona: Persona;
  onPersonaUpdate?: () => void;
}

const VERSION_BADGE_CLASS = [
  'tw:inline-flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-lg',
  'tw:border tw:border-primary tw:bg-primary tw:px-3 tw:py-2 tw:text-secondary',
  'tw:transition tw:hover:bg-primary_hover',
].join(' ');

const CACHE_STATE_BADGE_COLOR: Record<CacheState, BadgeColors> = {
  [CacheState.Fresh]: 'success',
  [CacheState.Stale]: 'gray',
  [CacheState.Generating]: 'warning',
  [CacheState.Failed]: 'error',
};

export const PersonaAIContext = ({
  canEdit,
  persona,
  onPersonaUpdate,
}: PersonaAIContextProps) => {
  const { t } = useTranslation();
  const initialDefinition = normalizePersonaContextDefinition(
    persona.contextDefinition
  );
  const [definition, setDefinition] =
    useState<PersonaContextDefinition>(initialDefinition);
  const persistedDefinitionRef = useRef(initialDefinition);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string>();
  const [budgetDraft, setBudgetDraft] = useState<string>();
  // Guards overlapping optimistic mutations: only the latest one is allowed to
  // apply its server response or roll back, so a slow request can't clobber a
  // newer one.
  const mutationIdRef = useRef(0);

  const applyServerDefinition = useCallback(
    (serverDefinition: PersonaContextDefinition) => {
      const normalized = normalizePersonaContextDefinition(serverDefinition);
      persistedDefinitionRef.current = normalized;
      setDefinition(normalized);
    },
    []
  );

  const loadConfiguration = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }
        applyServerDefinition(await getPersonaAIContext(persona.id));
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [applyServerDefinition, persona.id]
  );

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  useEffect(() => {
    if (definition.cacheState !== CacheState.Generating) {
      return;
    }
    const timeout = window.setTimeout(() => loadConfiguration(false), 1000);

    return () => window.clearTimeout(timeout);
  }, [definition.cacheState, loadConfiguration]);

  const persistSettings = useCallback(
    async (updated: PersonaContextDefinition) => {
      const previous = persistedDefinitionRef.current;
      setDefinition(updated);
      if (
        previous.enabled === updated.enabled &&
        previous.characterBudget === updated.characterBudget &&
        previous.cacheTtlMinutes === updated.cacheTtlMinutes
      ) {
        return;
      }
      const mutationId = ++mutationIdRef.current;
      try {
        const response = await updatePersonaAIContext(persona.id, {
          cacheTtlMinutes:
            updated.cacheTtlMinutes ??
            DEFAULT_PERSONA_CONTEXT_DEFINITION.cacheTtlMinutes,
          characterBudget:
            updated.characterBudget ??
            DEFAULT_PERSONA_CONTEXT_DEFINITION.characterBudget,
          enabled: updated.enabled,
        });
        if (mutationId === mutationIdRef.current) {
          applyServerDefinition(response);
        }
      } catch (error) {
        if (mutationId === mutationIdRef.current) {
          setDefinition(previous);
        }
        showErrorToast(error as AxiosError);
      }
    },
    [applyServerDefinition, persona.id]
  );

  const handleRuleSubmit = useCallback(
    async (rule: ContextRule) => {
      const previous = definition;
      const mutationId = ++mutationIdRef.current;
      setDefinition((current) => {
        const rules = [...(current.rules ?? [])];
        if (editingRuleId) {
          const index = rules.findIndex(({ id }) => id === editingRuleId);
          if (index >= 0) {
            rules[index] = { ...rule, id: editingRuleId };
          }
        } else {
          rules.push({ ...rule, id: `optimistic-${mutationId}-${Date.now()}` });
        }

        return { ...current, rules };
      });
      try {
        const response = editingRuleId
          ? await updatePersonaAIContextRule(persona.id, editingRuleId, rule)
          : await createPersonaAIContextRule(persona.id, rule);
        if (mutationId === mutationIdRef.current) {
          applyServerDefinition(response);
        }
        setEditorOpen(false);
        setEditingRuleId(undefined);
        showSuccessToast(t('message.persona-context-rule-saved'));
      } catch (error) {
        if (mutationId === mutationIdRef.current) {
          setDefinition(previous);
        }
        showErrorToast(error as AxiosError);

        throw error;
      }
    },
    [applyServerDefinition, definition, editingRuleId, persona.id, t]
  );

  const handleDeleteRule = useCallback(
    async (ruleId: string) => {
      const previous = definition;
      const mutationId = ++mutationIdRef.current;
      setDefinition((current) => ({
        ...current,
        rules: (current.rules ?? []).filter(({ id }) => id !== ruleId),
      }));
      try {
        const response = await deletePersonaAIContextRule(persona.id, ruleId);
        if (mutationId === mutationIdRef.current) {
          applyServerDefinition(response);
        }
        showSuccessToast(t('message.persona-context-rule-deleted'));
      } catch (error) {
        if (mutationId === mutationIdRef.current) {
          setDefinition(previous);
        }
        showErrorToast(error as AxiosError);
      }
    },
    [applyServerDefinition, definition, persona.id, t]
  );

  const openAddRule = useCallback(() => {
    setEditingRuleId(undefined);
    setEditorOpen(true);
  }, []);

  const handleDocumentLoaded = useCallback(
    (document: PersonaContextDocument) => {
      setDefinition((current) => ({
        ...current,
        cacheState: document.cacheState,
        lastGeneratedAt: document.generatedAt,
      }));
    },
    []
  );

  const personaName = persona.displayName || persona.name;
  const rules = definition.rules ?? [];
  const hasRules = rules.length > 0;
  const settingsDisabled = !canEdit || !hasRules;
  const lastGenerated = definition.lastGeneratedAt
    ? getRelativeTime(definition.lastGeneratedAt)
    : undefined;
  const editingRule = useMemo(
    () => rules.find(({ id }) => id === editingRuleId),
    [editingRuleId, rules]
  );

  const characterBudget =
    definition.characterBudget ??
    DEFAULT_PERSONA_CONTEXT_DEFINITION.characterBudget ??
    400000;
  const cacheTtlMinutes =
    definition.cacheTtlMinutes ??
    DEFAULT_PERSONA_CONTEXT_DEFINITION.cacheTtlMinutes ??
    30;

  if (loading) {
    return <Loader />;
  }

  return (
    <Box data-testid="persona-ai-context" direction="col">
      <Box align="start" className="tw:mb-4.5" gap={6} justify="between">
        <Box direction="col">
          <Typography
            className="tw:m-0 tw:text-primary"
            size="text-lg"
            weight="semibold">
            {t('label.ai-context')}
          </Typography>
          <Typography
            as="p"
            className="tw:mt-1 tw:mb-0 tw:text-secondary"
            size="text-sm">
            {t('message.persona-ai-context-description')}
          </Typography>
        </Box>
        <Box align="center" className="tw:shrink-0 tw:gap-2.5">
          {persona.version && (
            <Typography
              as="button"
              className={VERSION_BADGE_CLASS}
              data-testid="persona-context-version"
              size="text-sm"
              title={t('label.version-history')}
              weight="semibold"
              onClick={() => setVersionHistoryOpen(true)}>
              <ClockRewind className="tw:size-4" />
              {t('label.version-short', { version: persona.version })}
            </Typography>
          )}
          <Button
            color="secondary"
            data-testid="preview-persona-context"
            iconLeading={Eye}
            isDisabled={!hasRules}
            onClick={() => setPreviewOpen(true)}>
            {t('label.preview-context')}
          </Button>
          {canEdit && (
            <Button
              color="primary"
              data-testid="add-context-rule"
              iconLeading={Plus}
              onClick={openAddRule}>
              {t('label.add-rule')}
            </Button>
          )}
        </Box>
      </Box>

      <Card
        className={`tw:mb-6 tw:rounded-[10px] tw:px-5 tw:py-4.5 tw:shadow-xs ${
          hasRules ? '' : 'tw:opacity-60'
        }`}>
        <Box align="center" gap={7} wrap="wrap">
          <Box align="center" gap={3}>
            <Typography
              className="tw:text-primary"
              size="text-sm"
              weight="semibold">
              {t('label.enabled')}
            </Typography>
            <Toggle
              aria-label={t('label.enabled')}
              data-testid="persona-context-enabled"
              isDisabled={settingsDisabled}
              isSelected={definition.enabled ?? true}
              size="md"
              onChange={(enabled) =>
                persistSettings({ ...definition, enabled })
              }
            />
          </Box>

          <Divider className="tw:h-9 tw:self-center" orientation="vertical" />

          <Box className="tw:gap-1.5" direction="col">
            <Typography
              className="tw:text-quaternary"
              size="text-xs"
              weight="medium">
              {t('label.character-budget')}
            </Typography>
            <Box align="center" gap={2}>
              <Input
                aria-label={t('label.character-budget')}
                inputDataTestId="persona-context-character-budget"
                inputMode="numeric"
                isDisabled={settingsDisabled}
                value={budgetDraft ?? characterBudget.toLocaleString()}
                wrapperClassName="tw:w-28"
                onBlur={() => {
                  setBudgetDraft(undefined);
                  persistSettings(definition);
                }}
                onChange={(value) => {
                  const digits = value.replace(/[^0-9]/g, '');
                  setBudgetDraft(digits);
                  const parsed = Number(digits);
                  setDefinition((current) => ({
                    ...current,
                    characterBudget:
                      parsed ||
                      DEFAULT_PERSONA_CONTEXT_DEFINITION.characterBudget,
                  }));
                }}
              />
              <Typography className="tw:text-quaternary" size="text-sm">
                {t('label.chars')}
              </Typography>
            </Box>
          </Box>

          <Box className="tw:gap-1.5" direction="col">
            <Typography
              className="tw:text-quaternary"
              size="text-xs"
              weight="medium">
              {t('label.cache-ttl')}
            </Typography>
            <Box align="center" gap={2}>
              <Input
                aria-label={t('label.cache-ttl')}
                inputDataTestId="persona-context-cache-ttl"
                inputMode="numeric"
                isDisabled={settingsDisabled}
                value={String(cacheTtlMinutes)}
                wrapperClassName="tw:w-16"
                onBlur={() => persistSettings(definition)}
                onChange={(value) => {
                  const parsed = Number(value.replace(/[^0-9]/g, ''));
                  setDefinition((current) => ({
                    ...current,
                    cacheTtlMinutes:
                      parsed ||
                      DEFAULT_PERSONA_CONTEXT_DEFINITION.cacheTtlMinutes,
                  }));
                }}
              />
              <Typography className="tw:text-quaternary" size="text-sm">
                {t('label.min').toLowerCase()}
              </Typography>
            </Box>
          </Box>

          <Box align="center" className="tw:ml-auto" gap={2}>
            <Clock className="tw:size-4 tw:text-quaternary" />
            <Typography
              className="tw:text-[13px] tw:text-quaternary"
              weight="regular">
              {lastGenerated
                ? t('message.persona-context-last-generated-time', {
                    time: lastGenerated,
                  })
                : t('message.persona-context-not-generated')}
            </Typography>
            {definition.cacheState && (
              <Badge
                color={CACHE_STATE_BADGE_COLOR[definition.cacheState]}
                size="sm">
                {definition.cacheState.toLowerCase()}
              </Badge>
            )}
          </Box>
        </Box>
        {definition.lastError && (
          <Typography
            as="p"
            className="tw:mt-3 tw:mb-0 tw:text-error-primary"
            size="text-sm">
            {definition.lastError}
          </Typography>
        )}
      </Card>

      {hasRules ? (
        <Box direction="col" gap={3}>
          <Box align="center" gap={2}>
            <Typography
              as="p"
              className="tw:text-primary"
              size="text-md"
              weight="semibold">
              {t('label.rule-plural')}
            </Typography>
            <Badge color="blue-dark" type="pill-color">
              {rules.length}
            </Badge>
          </Box>
          <Box direction="col" gap={3}>
            {rules.map((rule) => (
              <ContextRuleCard
                canEdit={canEdit}
                key={rule.id ?? `${rule.name}-${rule.entityType}`}
                rule={rule}
                onDelete={() => rule.id && handleDeleteRule(rule.id)}
                onEdit={() => {
                  setEditingRuleId(rule.id);
                  setEditorOpen(true);
                }}
              />
            ))}
          </Box>
        </Box>
      ) : (
        <Box
          align="center"
          className="tw:rounded-[10px] tw:border tw:border-dashed tw:border-secondary tw:bg-primary tw:p-10 tw:text-center"
          direction="col">
          <FeaturedIcon
            className="tw:isolate tw:mb-4 tw:bg-brand-primary"
            color="brand"
            icon={FolderPlus}
            size="xl"
          />
          <Box className="tw:mb-5.5 tw:max-w-100" direction="col" gap={1}>
            <Typography
              className="tw:text-primary"
              size="text-md"
              weight="semibold">
              {t('message.no-ai-context-rules')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.no-ai-context-rules-description')}
            </Typography>
          </Box>
          {canEdit && (
            <Button
              color="primary"
              data-testid="empty-add-context-rule"
              iconLeading={Plus}
              onClick={openAddRule}>
              {t('label.add-rule')}
            </Button>
          )}
        </Box>
      )}

      <ContextRuleEditor
        existingRuleNames={rules
          .filter(({ id }) => id !== editingRuleId)
          .map(({ name }) => name)}
        open={editorOpen}
        personaId={persona.id}
        rule={editingRule}
        onClose={() => {
          setEditorOpen(false);
          setEditingRuleId(undefined);
        }}
        onSubmit={handleRuleSubmit}
      />
      <ContextPreviewModal
        open={previewOpen}
        personaDisplayName={personaName}
        personaId={persona.id}
        onClose={() => setPreviewOpen(false)}
        onDocumentLoaded={handleDocumentLoaded}
      />
      <VersionHistoryDrawer
        canEdit={canEdit}
        open={versionHistoryOpen}
        personaId={persona.id}
        onClose={() => setVersionHistoryOpen(false)}
        onRestored={() => {
          loadConfiguration(false);
          onPersonaUpdate?.();
        }}
      />
    </Box>
  );
};
