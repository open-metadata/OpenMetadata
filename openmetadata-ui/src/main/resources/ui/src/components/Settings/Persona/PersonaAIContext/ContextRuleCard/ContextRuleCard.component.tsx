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
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HEAVY_PERSONA_CONTEXT_SECTIONS,
  PERSONA_CONTEXT_ENTITY_LABEL_KEYS,
  PERSONA_CONTEXT_SECTION_LABEL_KEYS,
} from '../../../../../constants/PersonaAIContext.constants';
import { ContextRule } from '../../../../../generated/type/personaContextDefinition';
import {
  getRuleConditionCount,
  getRuleConditionSummary,
} from '../../../../../utils/PersonaAIContextUtils';

interface ContextRuleCardProps {
  canEdit: boolean;
  matched?: number;
  rule: ContextRule;
  onDelete: () => void;
  onEdit: () => void;
}

export const ContextRuleCard = ({
  canEdit,
  matched,
  rule,
  onDelete,
  onEdit,
}: ContextRuleCardProps) => {
  const { t } = useTranslation();
  const conditionSummary = useMemo(() => getRuleConditionSummary(rule), [rule]);
  const conditionCount = getRuleConditionCount(
    rule.filterJsonTree,
    rule.queryFilter
  );
  const matchedCount = matched ?? rule.matchedCount;
  const conditionLabel =
    conditionSummary ||
    (conditionCount > 0
      ? t('message.persona-context-condition-count', {
          count: conditionCount,
        })
      : t('label.all-entities'));

  return (
    <div
      className="persona-ai-context-rule-card"
      data-testid="context-rule-card">
      <div className="persona-ai-context-rule-main">
        <div className="persona-ai-context-rule-title-row">
          <Typography.Text strong className="persona-ai-context-rule-title">
            {rule.name}
          </Typography.Text>
          <span className="persona-ai-context-type-tag">
            {t(
              PERSONA_CONTEXT_ENTITY_LABEL_KEYS[rule.entityType] ??
                'label.entity'
            )}
          </span>
        </div>

        <div className="persona-ai-context-condition-row">
          <span
            className={`persona-ai-context-condition ${
              conditionCount === 0
                ? 'persona-ai-context-condition--match-all'
                : 'persona-ai-context-condition--filtered'
            }`}>
            {conditionLabel}
          </span>
        </div>

        <div className="persona-ai-context-section-pills">
          {rule.fullyRendered ? (
            <span className="persona-ai-context-section-pill persona-ai-context-section-pill--rendered">
              {t('label.fully-rendered')}
            </span>
          ) : (
            rule.sections?.slice(0, 5).map((section) => (
              <span className="persona-ai-context-section-pill" key={section}>
                {t(PERSONA_CONTEXT_SECTION_LABEL_KEYS[section])}
                {HEAVY_PERSONA_CONTEXT_SECTIONS.has(section) && (
                  <span className="persona-ai-context-heavy-suffix">
                    {t('label.heavy')}
                  </span>
                )}
              </span>
            ))
          )}
          {!rule.fullyRendered && (rule.sections?.length ?? 0) > 5 && (
            <span className="persona-ai-context-section-pill">
              {t('message.persona-context-more-sections', {
                count: (rule.sections?.length ?? 0) - 5,
              })}
            </span>
          )}
          {rule.alwaysInContext && (
            <span className="persona-ai-context-section-pill persona-ai-context-section-pill--always">
              {t('label.always-in-context')}
            </span>
          )}
        </div>

        <Typography.Text
          className="persona-ai-context-rule-footnote"
          type="secondary">
          {t('message.persona-context-max-assets', {
            count: rule.maxAssets ?? 50,
          })}
        </Typography.Text>
      </div>

      {(matchedCount !== undefined || canEdit) && (
        <div className="persona-ai-context-rule-aside">
          {matchedCount !== undefined && (
            <span className="persona-ai-context-matched-badge">
              <span aria-hidden className="persona-ai-context-matched-dot" />
              {t('message.persona-context-matched-count', {
                count: matchedCount,
              })}
            </span>
          )}
          {canEdit && (
            <div className="persona-ai-context-rule-actions">
              <Tooltip title={t('label.edit')}>
                <Button
                  aria-label={t('label.edit')}
                  data-testid="edit-context-rule"
                  icon={<EditOutlined />}
                  onClick={onEdit}
                />
              </Tooltip>
              <Popconfirm
                cancelText={t('label.cancel')}
                okText={t('label.delete')}
                title={t('message.delete-persona-context-rule-confirmation')}
                onConfirm={onDelete}>
                <Tooltip title={t('label.delete')}>
                  <Button
                    aria-label={t('label.delete')}
                    className="persona-ai-context-delete-rule"
                    data-testid="delete-context-rule"
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
