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
  BadgeWithDot,
  BadgeWithIcon,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  BarChartSquare02,
  Check,
  File02,
  FilterLines,
  Hexagon01,
  Table,
  Trash01,
} from '@untitledui/icons';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import {
  DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
  HEAVY_PERSONA_CONTEXT_SECTIONS,
  PERSONA_CONTEXT_ENTITY_LABEL_KEYS,
  PERSONA_CONTEXT_SECTION_LABEL_KEYS,
} from '../../../../../constants/PersonaAIContext.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { ContextRule } from '../../../../../generated/type/personaContextDefinition';
import {
  getRuleConditionCount,
  getRuleConditionParts,
} from '../../../../../utils/PersonaAIContextUtils';
import { DeleteModal } from '../../../../common/DeleteModal/DeleteModal';

interface ContextRuleCardProps {
  canEdit: boolean;
  matched?: number;
  rule: ContextRule;
  onDelete: () => void;
  onEdit: () => void;
}

const MAX_VISIBLE_SECTIONS = 5;

const ENTITY_TYPE_ICONS: Record<string, FC<{ className?: string }>> = {
  [EntityType.TABLE]: Table,
  [EntityType.KNOWLEDGE_PAGE]: File02,
  [EntityType.METRIC]: BarChartSquare02,
};

export const ContextRuleCard = ({
  canEdit,
  matched,
  rule,
  onDelete,
  onEdit,
}: ContextRuleCardProps) => {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const conditionParts = useMemo(() => getRuleConditionParts(rule), [rule]);
  const conditionCount = getRuleConditionCount(
    rule.filterJsonTree,
    rule.queryFilter
  );
  const matchedCount = matched ?? rule.matchedCount;

  const entityLabel = t(
    PERSONA_CONTEXT_ENTITY_LABEL_KEYS[rule.entityType] ?? 'label.entity'
  );
  const EntityIcon = ENTITY_TYPE_ICONS[rule.entityType] ?? Hexagon01;
  const visibleSections = rule.sections?.slice(0, MAX_VISIBLE_SECTIONS) ?? [];
  const extraSections = (rule.sections?.length ?? 0) - visibleSections.length;

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    onDelete();
  };

  return (
    <Card
      className="tw:flex tw:gap-4 tw:rounded-[10px] tw:px-4.5 tw:py-4 tw:shadow-xs"
      data-testid="context-rule-card">
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={3}>
        <Box align="center" className="tw:gap-2.5" wrap="wrap">
          <Typography
            as="span"
            className="tw:text-[15px] tw:text-primary"
            weight="semibold">
            {rule.name}
          </Typography>
          <BadgeWithIcon color="gray" iconLeading={EntityIcon} size="sm">
            {entityLabel}
          </BadgeWithIcon>
        </Box>

        <Box align="center" gap={2} wrap="wrap">
          {conditionParts ? (
            <>
              <Typography
                as="span"
                className="tw:rounded-md tw:bg-secondary tw:px-2 tw:py-0.5 tw:font-mono tw:text-secondary"
                size="text-xs"
                weight="medium">
                {conditionParts.field}
              </Typography>
              <Typography
                as="span"
                className="tw:text-quaternary"
                size="text-xs"
                weight="semibold">
                {conditionParts.operator}
              </Typography>
              {conditionParts.value && (
                <Typography
                  as="span"
                  className="tw:rounded-md tw:border tw:border-brand tw:bg-brand-primary tw:px-2 tw:py-0.5 tw:font-mono tw:text-brand-secondary"
                  size="text-xs"
                  weight="medium">
                  {conditionParts.value}
                </Typography>
              )}
            </>
          ) : conditionCount > 0 ? (
            <Typography
              as="span"
              className="tw:rounded-md tw:bg-secondary tw:px-2 tw:py-0.5 tw:font-mono tw:text-secondary"
              size="text-xs"
              weight="medium">
              {t('message.persona-context-condition-count', {
                count: conditionCount,
              })}
            </Typography>
          ) : (
            <Typography
              as="span"
              className="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-md tw:border tw:border-dashed tw:border-primary tw:px-2.5 tw:py-0.5 tw:text-tertiary"
              size="text-xs"
              weight="medium">
              <FilterLines className="tw:size-3.5 tw:text-quaternary" />
              {t('label.all-entity', {
                entity: `${entityLabel.toLowerCase()}s`,
              })}
            </Typography>
          )}
        </Box>

        <Box align="center" className="tw:gap-1.5" wrap="wrap">
          {rule.fullyRendered ? (
            <BadgeWithIcon color="brand" iconLeading={Check} size="sm">
              {t('label.fully-rendered')}
            </BadgeWithIcon>
          ) : (
            <>
              {visibleSections.map((section) => (
                <Badge color="gray" key={section} size="sm">
                  <Typography as="span">
                    {t(PERSONA_CONTEXT_SECTION_LABEL_KEYS[section])}
                  </Typography>
                  {HEAVY_PERSONA_CONTEXT_SECTIONS.has(section) && (
                    <Typography
                      as="span"
                      className="tw:ml-1 tw:text-quaternary"
                      size="text-xs">
                      {t('label.heavy')}
                    </Typography>
                  )}
                </Badge>
              ))}
              {extraSections > 0 && (
                <Typography
                  as="span"
                  className="tw:rounded-full tw:border tw:border-dashed tw:border-primary tw:px-2.5 tw:py-0.5 tw:text-quaternary"
                  size="text-xs"
                  weight="medium">
                  {t('message.persona-context-more-sections', {
                    count: extraSections,
                  })}
                </Typography>
              )}
            </>
          )}
          {rule.alwaysInContext && (
            <Badge color="gray" size="sm">
              {t('label.always-in-context')}
            </Badge>
          )}
        </Box>

        <Typography as="p" className="tw:m-0 tw:text-quaternary" size="text-xs">
          {t('message.persona-context-max-assets', {
            count: rule.maxAssets ?? DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
          })}
        </Typography>
      </Box>

      {(matchedCount !== undefined || canEdit) && (
        <Box align="end" className="tw:shrink-0 tw:gap-3.5" direction="col">
          {matchedCount !== undefined && (
            <BadgeWithDot color="success" size="md">
              {t('message.persona-context-entity-matched', {
                count: matchedCount,
                entity: `${entityLabel.toLowerCase()}s`,
              })}
            </BadgeWithDot>
          )}
          {canEdit && (
            <Box align="center" className="tw:mt-auto tw:gap-1.5">
              <Button
                aria-label={t('label.edit')}
                color="secondary"
                data-testid="edit-context-rule"
                iconLeading={EditIcon}
                size="xs"
                onClick={onEdit}
              />
              <Button
                aria-label={t('label.delete')}
                color="secondary-destructive"
                data-testid="delete-context-rule"
                iconLeading={Trash01}
                size="xs"
                onClick={() => setConfirmOpen(true)}
              />
            </Box>
          )}
        </Box>
      )}
      <DeleteModal
        entityTitle={rule.name}
        message={t('message.delete-persona-context-rule-confirmation')}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onDelete={handleConfirmDelete}
      />
    </Card>
  );
};
