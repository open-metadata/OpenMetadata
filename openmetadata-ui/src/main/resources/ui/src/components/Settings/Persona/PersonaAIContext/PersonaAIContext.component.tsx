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
import { EyeOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  InputNumber,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
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
import { ContextPreviewModal } from './ContextPreviewModal/ContextPreviewModal.component';
import { ContextRuleCard } from './ContextRuleCard/ContextRuleCard.component';
import { ContextRuleEditor } from './ContextRuleEditor/ContextRuleEditor.component';
import './persona-ai-context.less';

interface PersonaAIContextProps {
  canEdit: boolean;
  persona: Persona;
}

export const PersonaAIContext = ({
  canEdit,
  persona,
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string>();

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
        applyServerDefinition(response);
      } catch (error) {
        setDefinition(previous);
        showErrorToast(error as AxiosError);
      }
    },
    [applyServerDefinition, persona.id]
  );

  const handleRuleSubmit = useCallback(
    async (rule: ContextRule) => {
      const previous = definition;
      const rules = [...(definition.rules ?? [])];
      if (editingRuleId) {
        const index = rules.findIndex(({ id }) => id === editingRuleId);
        if (index >= 0) {
          rules[index] = { ...rule, id: editingRuleId };
        }
      } else {
        rules.push({ ...rule, id: `optimistic-${Date.now()}` });
      }
      setDefinition({ ...definition, rules });
      try {
        const response = editingRuleId
          ? await updatePersonaAIContextRule(persona.id, editingRuleId, rule)
          : await createPersonaAIContextRule(persona.id, rule);
        applyServerDefinition(response);
        setEditorOpen(false);
        setEditingRuleId(undefined);
        showSuccessToast(t('message.persona-context-rule-saved'));
      } catch (error) {
        setDefinition(previous);
        showErrorToast(error as AxiosError);

        throw error;
      }
    },
    [applyServerDefinition, definition, editingRuleId, persona.id, t]
  );

  const handleDeleteRule = useCallback(
    async (ruleId: string) => {
      const previous = definition;
      setDefinition({
        ...definition,
        rules: (definition.rules ?? []).filter(({ id }) => id !== ruleId),
      });
      try {
        applyServerDefinition(
          await deletePersonaAIContextRule(persona.id, ruleId)
        );
        showSuccessToast(t('message.persona-context-rule-deleted'));
      } catch (error) {
        setDefinition(previous);
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
  const lastGenerated = definition.lastGeneratedAt
    ? getRelativeTime(definition.lastGeneratedAt)
    : undefined;
  const editingRule = useMemo(
    () => rules.find(({ id }) => id === editingRuleId),
    [editingRuleId, rules]
  );

  return (
    <Spin spinning={loading}>
      <div className="persona-ai-context" data-testid="persona-ai-context">
        <div className="persona-ai-context-header">
          <div>
            <Typography.Title level={4}>
              {t('label.ai-context')}
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              {t('message.persona-ai-context-description')}
            </Typography.Paragraph>
          </div>
          <Space>
            <Button
              data-testid="preview-persona-context"
              disabled={rules.length === 0}
              icon={<EyeOutlined />}
              onClick={() => setPreviewOpen(true)}>
              {t('label.preview-context')}
            </Button>
            {canEdit && (
              <Button
                data-testid="add-context-rule"
                icon={<PlusOutlined />}
                type="primary"
                onClick={openAddRule}>
                {t('label.add-rule')}
              </Button>
            )}
          </Space>
        </div>

        <Card
          className="persona-ai-context-settings-card"
          data-disabled={rules.length === 0}>
          <div className="persona-ai-context-settings-grid">
            <div className="persona-ai-context-setting persona-ai-context-enabled-setting">
              <Typography.Text strong>{t('label.enabled')}</Typography.Text>
              <Switch
                checked={definition.enabled ?? true}
                data-testid="persona-context-enabled"
                disabled={!canEdit || rules.length === 0}
                onChange={(enabled) =>
                  persistSettings({ ...definition, enabled })
                }
              />
            </div>
            <div className="persona-ai-context-setting">
              <Typography.Text type="secondary">
                {t('label.character-budget')}
              </Typography.Text>
              <InputNumber
                controls={false}
                data-testid="persona-context-character-budget"
                disabled={!canEdit || rules.length === 0}
                max={2000000}
                min={10000}
                value={
                  definition.characterBudget ??
                  DEFAULT_PERSONA_CONTEXT_DEFINITION.characterBudget
                }
                onBlur={() => persistSettings(definition)}
                onChange={(value) =>
                  setDefinition((current) => ({
                    ...current,
                    characterBudget: value ?? 150000,
                  }))
                }
              />
            </div>
            <div className="persona-ai-context-setting">
              <Typography.Text type="secondary">
                {t('label.cache-ttl')}
              </Typography.Text>
              <InputNumber
                addonAfter={t('label.minute-plural')}
                controls={false}
                data-testid="persona-context-cache-ttl"
                disabled={!canEdit || rules.length === 0}
                max={1440}
                min={1}
                value={
                  definition.cacheTtlMinutes ??
                  DEFAULT_PERSONA_CONTEXT_DEFINITION.cacheTtlMinutes
                }
                onBlur={() => persistSettings(definition)}
                onChange={(value) =>
                  setDefinition((current) => ({
                    ...current,
                    cacheTtlMinutes: value ?? 30,
                  }))
                }
              />
            </div>
            <div className="persona-ai-context-generation-status">
              <Typography.Text type="secondary">
                {lastGenerated
                  ? t('message.persona-context-last-generated', {
                      status: definition.cacheState?.toLowerCase(),
                      time: lastGenerated,
                    })
                  : t('message.persona-context-not-generated')}
              </Typography.Text>
              {definition.cacheState && (
                <Tag>{definition.cacheState.toLowerCase()}</Tag>
              )}
            </div>
          </div>
          {definition.lastError && (
            <Typography.Text className="persona-ai-context-error" type="danger">
              {definition.lastError}
            </Typography.Text>
          )}
        </Card>

        {rules.length === 0 ? (
          <div className="persona-ai-context-empty-state">
            <Empty
              description={
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>
                    {t('message.no-ai-context-rules')}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t('message.no-ai-context-rules-description')}
                  </Typography.Text>
                </Space>
              }
              image={
                <RobotOutlined className="persona-ai-context-empty-icon" />
              }
            />
            {canEdit && (
              <Button
                data-testid="empty-add-context-rule"
                icon={<PlusOutlined />}
                type="primary"
                onClick={openAddRule}>
                {t('label.add-rule')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="persona-ai-context-rules-header">
              <Typography.Title level={5}>
                {t('message.persona-context-rules-count', {
                  count: rules.length,
                })}
              </Typography.Title>
            </div>
            <div className="persona-ai-context-rules-list">
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
            </div>
          </>
        )}

        <ContextRuleEditor
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
      </div>
    </Spin>
  );
};
