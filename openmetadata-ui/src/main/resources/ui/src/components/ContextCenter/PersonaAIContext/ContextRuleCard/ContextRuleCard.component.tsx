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
  ButtonUtility,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  BarChartSquare02,
  Check,
  Edit01,
  File02,
  FilterLines,
  Hexagon01,
  Search,
  Table,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { FC, ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
  HEAVY_PERSONA_CONTEXT_SECTIONS,
  PERSONA_CONTEXT_ENTITY_LABEL_KEYS,
  PERSONA_CONTEXT_ENTITY_PLURAL_LABEL_KEYS,
  PERSONA_CONTEXT_SECTION_LABEL_KEYS,
} from '../../../../constants/PersonaAIContext.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { ContextRule } from '../../../../generated/type/personaContextDefinition';
import {
  getRuleConditionCount,
  getRuleConditionParts,
  getRuleQuery,
  isSearchScopedRule,
  RuleQuery,
} from '../../../../utils/PersonaAIContextUtils';
import { DeleteModal } from '../../../common/DeleteModal/DeleteModal';

interface RuleActions {
  onEdit: () => void;
  onDelete: () => void;
}

export interface ContextRuleCardProps extends RuleActions {
  canEdit: boolean;
  changeBadge?: ReactNode;
  inherited?: boolean;
  matched?: number;
  renderActions?: (actions: RuleActions) => ReactNode;
  renderQuery?: (query: RuleQuery) => ReactNode;
  renderVersionValue?: (
    field: 'name' | 'description',
    value?: string
  ) => ReactNode;
  rule: ContextRule;
}

const MAX_VISIBLE_SECTIONS = 5;

const ENTITY_TYPE_ICONS: Record<string, FC<{ className?: string }>> = {
  [EntityType.TABLE]: Table,
  [EntityType.KNOWLEDGE_PAGE]: File02,
  [EntityType.METRIC]: BarChartSquare02,
};

interface RuleConditionSummaryProps {
  entityLabelPlural: string;
  renderQuery?: ContextRuleCardProps['renderQuery'];
  rule: ContextRule;
}

const RuleConditionSummary = ({
  entityLabelPlural,
  renderQuery,
  rule,
}: RuleConditionSummaryProps) => {
  const { t } = useTranslation();
  const conditionParts = useMemo(
    () => (renderQuery ? undefined : getRuleConditionParts(rule)),
    [renderQuery, rule]
  );
  if (renderQuery) {
    return <>{renderQuery(getRuleQuery(rule))}</>;
  }
  const conditionCount = getRuleConditionCount(
    rule.filterJsonTree,
    rule.queryFilter
  );

  const renderSummary = () => {
    if (conditionParts) {
      return (
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
      );
    }

    if (conditionCount > 0) {
      return (
        <Typography
          as="span"
          className="tw:rounded-md tw:bg-secondary tw:px-2 tw:py-0.5 tw:font-mono tw:text-secondary"
          size="text-xs"
          weight="medium">
          {t('message.persona-context-condition-count', {
            count: conditionCount,
          })}
        </Typography>
      );
    }

    return (
      <Typography
        as="span"
        className="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-md tw:border tw:border-dashed tw:border-primary tw:px-2.5 tw:py-0.5 tw:text-tertiary"
        size="text-xs"
        weight="medium">
        <FilterLines className="tw:size-3.5 tw:text-quaternary" />
        {t('label.all-entity', {
          entity: entityLabelPlural,
        })}
      </Typography>
    );
  };

  return (
    <Box align="center" gap={2} wrap="wrap">
      {renderSummary()}
    </Box>
  );
};

interface RuleSectionsProps {
  isScoped: boolean;
  fullyRendered?: boolean;
  visibleSections: NonNullable<ContextRule['sections']>;
  extraSections: number;
  alwaysInContext?: boolean;
}

const RuleSections = ({
  isScoped,
  fullyRendered,
  visibleSections,
  extraSections,
  alwaysInContext,
}: RuleSectionsProps) => {
  const { t } = useTranslation();

  if (isScoped) {
    return (
      <Box align="center" className="tw:gap-1.5" wrap="wrap">
        <BadgeWithIcon color="brand" iconLeading={Search} size="sm">
          {t('label.filtered-in-search')}
        </BadgeWithIcon>
      </Box>
    );
  }

  return (
    <Box align="center" className="tw:gap-1.5" wrap="wrap">
      {fullyRendered ? (
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
      {alwaysInContext && (
        <Badge color="gray" size="sm">
          {t('label.always-in-context')}
        </Badge>
      )}
    </Box>
  );
};

interface RuleCardActionsProps {
  matchedCount?: number;
  canEdit: boolean;
  entityLabelPlural: string;
  renderActions?: ContextRuleCardProps['renderActions'];
  onEdit: () => void;
  onDeleteClick: () => void;
}

const RuleCardActions = ({
  matchedCount,
  canEdit,
  entityLabelPlural,
  renderActions,
  onEdit,
  onDeleteClick,
}: RuleCardActionsProps) => {
  const { t } = useTranslation();

  if (matchedCount === undefined && !canEdit) {
    return null;
  }

  return (
    <Box align="end" className="tw:shrink-0 tw:gap-3.5" direction="col">
      {matchedCount !== undefined && (
        <BadgeWithDot color="success" size="md">
          {t('message.persona-context-entity-matched', {
            count: matchedCount,
            entity: entityLabelPlural,
          })}
        </BadgeWithDot>
      )}
      {canEdit && (
        <Box align="center" className="tw:mt-auto tw:gap-1.5">
          {renderActions ? (
            renderActions({ onEdit, onDelete: onDeleteClick })
          ) : (
            <>
              <ButtonUtility
                data-testid="edit-context-rule"
                icon={Edit01}
                size="lg"
                tooltip={t('label.edit')}
                onClick={onEdit}
              />
              <ButtonUtility
                color="tertiary-destructive"
                data-testid="delete-context-rule"
                icon={Trash01}
                size="lg"
                tooltip={t('label.delete')}
                onClick={onDeleteClick}
              />
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

const RuleCardHeader = ({
  changeBadge,
  inherited,
  renderVersionValue,
  rule,
}: Pick<
  ContextRuleCardProps,
  'changeBadge' | 'inherited' | 'renderVersionValue' | 'rule'
>) => {
  const { t } = useTranslation();
  const entityLabel = t(
    PERSONA_CONTEXT_ENTITY_LABEL_KEYS[rule.entityType] ?? 'label.entity'
  );
  const EntityIcon = ENTITY_TYPE_ICONS[rule.entityType] ?? Hexagon01;

  return (
    <Box align="center" className="tw:gap-2.5" wrap="wrap">
      <Typography
        as="span"
        className="tw:text-[15px] tw:text-primary"
        weight="semibold">
        {renderVersionValue ? renderVersionValue('name', rule.name) : rule.name}
      </Typography>
      {changeBadge}
      {inherited && (
        <Badge color="gray" size="sm">
          {t('label.inherited')}
        </Badge>
      )}
      {rule.enabled === false && (
        <Badge color="gray" size="sm">
          {t('label.disabled')}
        </Badge>
      )}
      <BadgeWithIcon color="gray" iconLeading={EntityIcon} size="sm">
        {entityLabel}
      </BadgeWithIcon>
    </Box>
  );
};

export const ContextRuleCard = ({
  canEdit,
  changeBadge,
  inherited,
  matched,
  renderActions,
  renderQuery,
  renderVersionValue,
  rule,
  onDelete,
  onEdit,
}: ContextRuleCardProps) => {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEditRule = canEdit && !inherited;
  const description = renderVersionValue?.('description', rule.description);

  // Not rule.filteredInSearch: the server ignores that flag on knowledge rules, so trusting it here
  // would badge a rule as scoping search while the server preloads it.
  const isScoped = isSearchScopedRule(rule);
  const isEnabled = rule.enabled !== false;
  const matchedCount = matched ?? rule.matchedCount;

  const entityLabelPlural = t(
    PERSONA_CONTEXT_ENTITY_PLURAL_LABEL_KEYS[rule.entityType] ??
      'label.entity-plural'
  );
  const sections = rule.sections ?? [];
  const visibleSections = sections.slice(0, MAX_VISIBLE_SECTIONS);
  const extraSections = sections.length - visibleSections.length;

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    onDelete();
  };

  return (
    <Card
      className="tw:flex tw:gap-4 tw:rounded-[10px] tw:px-4.5 tw:py-4 tw:shadow-xs"
      data-testid="context-rule-card">
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={3}>
        <RuleCardHeader
          changeBadge={changeBadge}
          inherited={inherited}
          renderVersionValue={renderVersionValue}
          rule={rule}
        />

        <RuleConditionSummary
          entityLabelPlural={entityLabelPlural}
          renderQuery={renderQuery}
          rule={rule}
        />

        {description && (
          <Typography as="p" className="tw:whitespace-pre-wrap" size="text-sm">
            {description}
          </Typography>
        )}

        <RuleSections
          alwaysInContext={rule.alwaysInContext}
          extraSections={extraSections}
          fullyRendered={rule.fullyRendered}
          isScoped={isScoped}
          visibleSections={visibleSections}
        />

        {isEnabled && (
          <Typography
            as="p"
            className="tw:m-0 tw:text-quaternary"
            size="text-xs">
            {isScoped
              ? t('message.persona-context-scoped-rule-summary')
              : t('message.persona-context-max-assets', {
                  count: rule.maxAssets ?? DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
                })}
          </Typography>
        )}
      </Box>

      <RuleCardActions
        canEdit={canEditRule}
        entityLabelPlural={entityLabelPlural}
        matchedCount={matchedCount}
        renderActions={renderActions}
        onDeleteClick={() => setConfirmOpen(true)}
        onEdit={onEdit}
      />
      <DeleteModal
        entityTitle={rule.name}
        message={t('message.delete-persona-context-rule-confirmation')}
        open={canEditRule && confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onDelete={handleConfirmDelete}
      />
    </Card>
  );
};
