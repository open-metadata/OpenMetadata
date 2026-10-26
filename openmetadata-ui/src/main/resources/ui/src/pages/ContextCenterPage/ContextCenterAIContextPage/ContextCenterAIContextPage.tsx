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
  Box,
  FeaturedIcon,
  PageLayout,
  PaginationCardWithControls,
  ProgressBarBase,
  Table,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { User01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as PersonaIcon } from '../../../assets/svg/common/persona.svg';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import NoDataPlaceholder from '../../../components/common/EmptyPlaceholder/NoDataPlaceholder';
import Loader from '../../../components/common/Loader/Loader';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import { useContextCenterPageLayout } from '../../../components/ContextCenter/ContextCenterLayout/useContextCenterPageLayout';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { DEFAULT_PERSONA_CONTEXT_DEFINITION } from '../../../constants/PersonaAIContext.constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { CursorType } from '../../../enums/pagination.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { PersonaContextStatus } from '../../../generated/type/personaContextStatus';
import { useAuth } from '../../../hooks/authHooks';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useIsAiMode } from '../../../hooks/useAppMode';
import {
  getAllPersonas,
  getPersonaAIContextStatus,
  updatePersonaAIContext,
} from '../../../rest/PersonaAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { digitFormatter } from '../../../utils/NumberUtils';
import { getPersonaContextFreshness } from '../../../utils/PersonaAIContextUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const PERSONA_FIELDS = `${TabSpecificField.USERS},${TabSpecificField.CONTEXT_DEFINITION}`;
const EMPTY_CELL = '—';
const MIN_VISIBLE_BUDGET_FRACTION = 0.02;
// The budget is stored in characters; the backend estimates tokens with the same 4:1 ratio.
const CHARS_PER_TOKEN = 4;

const ContextCenterAIContextPage = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const pageLayoutClassNames = useContextCenterPageLayout();
  const navigate = useNavigate();
  const { isAdminUser } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [statuses, setStatuses] = useState<Map<string, PersonaContextStatus>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    pageSize,
    paging,
    pagingCursor: { cursorType: urlCursorType, cursorValue: urlCursorValue },
    showPagination,
  } = usePaging();

  const fetchPersonas = useCallback(
    async (cursor?: Partial<Record<CursorType, string>>) => {
      setIsLoading(true);
      try {
        const params = { ...cursor, limit: pageSize };
        // The status endpoint pages like the persona list, so one cursor fetches both halves of
        // a page. Cache state is admin-only; non-admins get the configuration columns alone.
        const [personaPage, statusPage] = await Promise.all([
          getAllPersonas({ ...params, fields: PERSONA_FIELDS }),
          isAdminUser ? getPersonaAIContextStatus(params) : undefined,
        ]);
        setPersonas(personaPage.data);
        handlePagingChange(personaPage.paging);
        setStatuses(
          new Map(
            (statusPage?.data ?? []).map((status) => [status.personaId, status])
          )
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
        setPersonas([]);
      } finally {
        setIsLoading(false);
      }
    },
    [isAdminUser, pageSize, handlePagingChange]
  );

  // The URL owns the cursor alongside the page number, so a reload or browser Back lands on the
  // same personas the pager says it is showing; page clicks only write the URL.
  useEffect(() => {
    void fetchPersonas(
      urlCursorType && urlCursorValue
        ? { [urlCursorType]: urlCursorValue }
        : undefined
    );
  }, [fetchPersonas, urlCursorType, urlCursorValue]);

  const handlePageNavigation = (newPage: number) => {
    // ponytail: cursor paging only supports ±1 steps; a jump beyond the adjacent page no-ops.
    const cursorType =
      newPage > currentPage ? CursorType.AFTER : CursorType.BEFORE;
    const cursor = paging[cursorType];
    if (Math.abs(newPage - currentPage) !== 1 || !cursor) {
      return;
    }
    handlePageChange(newPage, { cursorType, cursorValue: cursor });
  };

  const setPersonaEnabled = (personaId: string, enabled: boolean) =>
    setPersonas((current) =>
      current.map((persona) =>
        persona.id === personaId
          ? {
              ...persona,
              contextDefinition: { ...persona.contextDefinition, enabled },
            }
          : persona
      )
    );

  const handleEnabledChange = async (persona: Persona, enabled: boolean) => {
    const definition = persona.contextDefinition;
    setPersonaEnabled(persona.id, enabled);
    try {
      // The endpoint overwrites all three settings from the body, so they ride along unchanged.
      await updatePersonaAIContext(persona.id, {
        cacheTtlMinutes:
          definition?.cacheTtlMinutes ??
          DEFAULT_PERSONA_CONTEXT_DEFINITION.cacheTtlMinutes,
        characterBudget:
          definition?.characterBudget ??
          DEFAULT_PERSONA_CONTEXT_DEFINITION.characterBudget,
        enabled,
      });
    } catch (error) {
      setPersonaEnabled(persona.id, !enabled);
      showErrorToast(error as AxiosError);
    }
  };

  const renderBudget = (persona: Persona, status?: PersonaContextStatus) => {
    if (!status) {
      return EMPTY_CELL;
    }
    if (!status.lastGeneratedAt) {
      return (
        <Box direction="col" gap={1}>
          <ProgressBarBase value={0} />
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.no-context-generated')}
          </Typography>
        </Box>
      );
    }
    const budget = Math.ceil(
      (persona.contextDefinition?.characterBudget ??
        DEFAULT_PERSONA_CONTEXT_DEFINITION.characterBudget ??
        CHARS_PER_TOKEN) / CHARS_PER_TOKEN
    );

    return (
      <Box direction="col" gap={1}>
        <ProgressBarBase
          max={budget}
          // A small document is a fraction of a percent of the budget, which renders as an empty
          // track that reads as a loading skeleton — keep a visible sliver whenever there is content.
          value={Math.min(
            Math.max(status.tokensEst, budget * MIN_VISIBLE_BUDGET_FRACTION),
            budget
          )}
        />
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.persona-context-budget-usage', {
            total: digitFormatter(budget),
            used: digitFormatter(status.tokensEst),
          })}
        </Typography>
      </Box>
    );
  };

  const renderFreshness = (
    hasRules: boolean,
    status?: PersonaContextStatus
  ) => {
    const freshness = getPersonaContextFreshness(hasRules, status);
    if (!freshness) {
      return EMPTY_CELL;
    }
    const label = t(freshness.labelKey);

    return (
      <Badge color={freshness.color} size="sm" type="pill-color">
        {freshness.withTime && status?.lastGeneratedAt
          ? t('label.freshness-with-time', {
              state: label,
              time: getRelativeTime(status.lastGeneratedAt),
            })
          : label}
      </Badge>
    );
  };

  const renderPersona = (persona: Persona) => {
    const rules = persona.contextDefinition?.rules ?? [];
    const status = statuses.get(persona.id);

    return (
      <Table.Row
        className="tw:cursor-pointer"
        data-testid={`ai-context-persona-${persona.name}`}
        id={persona.id}
        key={persona.id}
        onAction={() =>
          navigate(
            contextCenterClassBase.getAIContextPath(
              persona.fullyQualifiedName ?? persona.name
            )
          )
        }>
        <Table.Cell>
          <Box align="center" gap={3}>
            <FeaturedIcon
              className="tw:shrink-0"
              color="brand"
              icon={User01}
              size="md"
              theme="light"
            />
            <Box className="tw:min-w-0" direction="col">
              <Typography ellipsis weight="medium">
                {getEntityName(persona)}
              </Typography>
              <Typography ellipsis color="secondary" size="text-xs">
                {persona.name}
              </Typography>
            </Box>
          </Box>
        </Table.Cell>
        <Table.Cell data-testid="ai-context-persona-users">
          {persona.users?.length ?? 0}
        </Table.Cell>
        <Table.Cell data-testid="ai-context-persona-rules">
          {rules.length}
        </Table.Cell>
        <Table.Cell data-testid="ai-context-persona-entities">
          {status?.entitiesIncluded ?? 0}
        </Table.Cell>
        <Table.Cell data-testid="ai-context-persona-budget">
          {renderBudget(persona, status)}
        </Table.Cell>
        <Table.Cell data-testid="ai-context-persona-freshness">
          {renderFreshness(rules.length > 0, status)}
        </Table.Cell>
        <Table.Cell>
          <Toggle
            aria-label={t('label.enabled')}
            data-testid={`ai-context-persona-enabled-${persona.name}`}
            isDisabled={!isAdminUser}
            isSelected={persona.contextDefinition?.enabled ?? true}
            onChange={(enabled) => handleEnabledChange(persona, enabled)}
          />
        </Table.Cell>
      </Table.Row>
    );
  };

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:overflow-hidden ${contextCenterClassBase.getPageContainerClassName(
        isAiMode
      )}`}
      data-testid="context-center-ai-context-page">
      <DocumentTitle title={t('label.ai-context')} />
      <PageLayout
        className={pageLayoutClassNames.root}
        data-testid="context-center-page-layout">
        <PageLayout.Header className={pageLayoutClassNames.header}>
          <ContextCenterHeader
            breadcrumbs={[{ label: t('label.ai-context') }]}
            hasPermission={isAdminUser}
            subtitle={t('message.persona-ai-context-description')}
            title={t('label.ai-context')}
          />
        </PageLayout.Header>
        <PageLayout.Content
          className={classNames(
            'tw:min-h-0 tw:overflow-y-auto tw:relative',
            pageLayoutClassNames.content
          )}>
          {isLoading && <Loader />}
          {!isLoading && personas.length === 0 && (
            <NoDataPlaceholder
              description={t('message.no-persona-ai-context-description')}
              icon={PersonaIcon}
              title={t('message.no-persona-available')}
            />
          )}
          {!isLoading && personas.length > 0 && (
            <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:shadow-xs">
              <Table
                aria-label={t('label.persona-plural')}
                className="tw:table-fixed"
                data-testid="ai-context-persona-table">
                <Table.Header>
                  <Table.Head
                    isRowHeader
                    className="tw:w-1/4"
                    id="persona"
                    label={t('label.persona')}
                  />
                  <Table.Head id="users" label={t('label.user-plural')} />
                  <Table.Head id="rules" label={t('label.rule-plural')} />
                  <Table.Head id="entities" label={t('label.entity-plural')} />
                  <Table.Head
                    className="tw:w-1/5"
                    id="budget"
                    label={t('label.context-budget-used')}
                  />
                  <Table.Head
                    className="tw:w-1/6"
                    id="freshness"
                    label={t('label.freshness')}
                  />
                  <Table.Head id="enabled" label={t('label.enabled')} />
                </Table.Header>
                <Table.Body>{personas.map(renderPersona)}</Table.Body>
              </Table>
              {showPagination && (
                <PaginationCardWithControls
                  minimal
                  page={currentPage}
                  pageSize={pageSize}
                  pageSizeOptions={[
                    PAGE_SIZE_BASE,
                    PAGE_SIZE_MEDIUM,
                    PAGE_SIZE_LARGE,
                  ]}
                  total={Math.max(1, Math.ceil((paging.total ?? 0) / pageSize))}
                  onPageChange={handlePageNavigation}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </div>
          )}
        </PageLayout.Content>
      </PageLayout>
    </div>
  );
};

export default ContextCenterAIContextPage;
