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
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  ProgressBar,
  Select,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  OnboardingAssignees,
  OnboardingSearchIndex,
} from '../../../components/governance/onboarding/OnboardingAssignees';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { SearchIndex } from '../../../enums/search.enum';
import {
  OnboardingStage,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import { OnboardingBoard } from '../../../generated/governance/onboarding/onboardingBoard';
import { OnboardingProgress } from '../../../generated/governance/onboarding/onboardingProgress';
import { EntityReference } from '../../../generated/type/entityReference';
import { listOnboarding } from '../../../rest/governance/onboarding/Onboarding.api';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  ONBOARDING_ENTITY_TYPES,
  ONBOARDING_STAGES,
  STAGE_LABELS,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import {
  assigneeInitials,
  blockingProgress,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import {
  getDataProductDetailsPath,
  getDomainDetailsPath,
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const DOMAIN_INDEX: OnboardingSearchIndex[] = [SearchIndex.DOMAIN];
const ENTITY_LABELS: Record<string, string> = {
  dataProduct: 'data-product',
  glossaryTerm: 'glossary-term',
  domain: 'domain',
  metric: 'metric',
};
const assetPath = (type: TargetEntityType, fqn: string) => {
  if (type === TargetEntityType.Domain) {
    return getDomainDetailsPath(fqn);
  }
  if (type === TargetEntityType.DataProduct) {
    return getDataProductDetailsPath(fqn);
  }
  if (type === TargetEntityType.GlossaryTerm) {
    return getGlossaryTermDetailsPath(fqn);
  }

  return getEntityDetailsPath(ONBOARDING_ENTITY_TYPES[type], fqn);
};
const assetName = (entity: OnboardingProgress['entity']) =>
  entity?.fullyQualifiedName ?? entity?.name ?? '';
const stageDuration = (enteredAt: number, locale: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - enteredAt) / 60000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'day',
      unitDisplay: 'short',
    }).format(days);
  }
  if (hours) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'hour',
      unitDisplay: 'short',
    }).format(hours);
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'short',
  }).format(minutes);
};
const filterReference = (
  search: URLSearchParams,
  key: string
): EntityReference[] => {
  const id = search.get(key);
  if (!id) {
    return [];
  }

  return [
    {
      id,
      type: search.get(key + 'Type') ?? key,
      name: search.get(key + 'Name') ?? id,
    },
  ];
};
const boardEmptyMessage = (
  loading: boolean,
  error: boolean,
  scanIncomplete: boolean
) => {
  if (loading) {
    return 'label.loading';
  }

  if (error) {
    return 'message.onboarding-board-load-error';
  }

  return scanIncomplete
    ? 'message.onboarding-board-scan-incomplete'
    : 'message.onboarding-board-empty';
};
const hasPartialScanResults = (board: OnboardingBoard) =>
  Boolean(board.scanLimitReached && board.data.length);
const OnboardingBoardPage = () => {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useSearchParams();
  const type = Object.values(TargetEntityType).find(
    (item) => item === search.get('entityType')
  );
  const stage = ONBOARDING_STAGES.find((item) => item === search.get('stage'));
  const cursor = search.get('after') ?? undefined;
  const previous = search.getAll('previous');
  const domainId = search.get('domain') ?? undefined;
  const assigneeId = search.get('assignee') ?? undefined;
  const domains = filterReference(search, 'domain');
  const assignees = filterReference(search, 'assignee');
  const [board, setBoard] = useState<OnboardingBoard>({ data: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const scanIncomplete = Boolean(board.scanLimitReached);
  const request = useRef(0);
  const updateFilter = (values: Record<string, string | undefined>) => {
    setSearch((current) => {
      const params = new URLSearchParams(current);
      params.delete('after');
      params.delete('previous');
      Object.entries(values).forEach(([key, value]) =>
        value ? params.set(key, value) : params.delete(key)
      );

      return params;
    });
  };
  const fetch = useCallback(
    async (signal?: AbortSignal) => {
      const sequence = ++request.current;
      setLoading(true);
      setError(false);
      setBoard({ data: [] });
      try {
        const result = await listOnboarding(
          {
            entityType: type,
            stage,
            domain: domainId,
            assignee: assigneeId,
            after: cursor,
            limit: 25,
          },
          signal
        );
        if (!signal?.aborted && sequence === request.current) {
          setBoard(result);
        }
      } catch (error) {
        if (!signal?.aborted && sequence === request.current) {
          setError(true);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (!signal?.aborted && sequence === request.current) {
          setLoading(false);
        }
      }
    },
    [type, stage, domainId, assigneeId, cursor]
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch(controller.signal);

    return () => {
      controller.abort();
      request.current++;
    };
  }, [fetch]);

  return (
    <PageLayoutV1 pageTitle={t('label.onboarding-board')}>
      <Box
        className="tw:gap-6 tw:p-6"
        data-testid="onboarding-board"
        direction="col">
        <Box align="center" justify="between">
          <Typography size="display-sm" weight="semibold">
            {t('label.onboarding-board')}
          </Typography>
          <Button color="secondary" isLoading={loading} onPress={() => fetch()}>
            {t('label.refresh')}
          </Button>
        </Box>
        <Box align="start" className="tw:gap-4" wrap="wrap">
          <Select
            label={t('label.entity-type')}
            selectedKey={type ?? 'all'}
            onSelectionChange={(key) => {
              updateFilter({
                entityType: Object.values(TargetEntityType).find(
                  (item) => item === key
                ),
              });
            }}>
            <Select.Item id="all" label={t('label.all')} />
            {Object.values(TargetEntityType).map((item) => (
              <Select.Item
                id={item}
                key={item}
                label={t(`label.${ENTITY_LABELS[item]}`)}
              />
            ))}
          </Select>
          <Select
            label={t('label.stage')}
            selectedKey={stage ?? 'all'}
            onSelectionChange={(key) => {
              updateFilter({
                stage: ONBOARDING_STAGES.find((item) => item === key),
              });
            }}>
            <Select.Item id="all" label={t('label.all')} />
            {ONBOARDING_STAGES.filter(
              (item) => item !== OnboardingStage.Creation
            ).map((item) => (
              <Select.Item id={item} key={item} label={t(STAGE_LABELS[item])} />
            ))}
          </Select>
          <OnboardingAssignees
            label={t('label.domain')}
            searchIndex={DOMAIN_INDEX}
            value={domains}
            onChange={(values) => {
              const selected = values.at(-1);
              updateFilter({
                domain: selected?.id,
                domainName: selected ? getEntityName(selected) : undefined,
              });
            }}
          />
          <OnboardingAssignees
            label={t('label.waiting-on')}
            value={assignees}
            onChange={(values) => {
              const selected = values.at(-1);
              updateFilter({
                assignee: selected?.id,
                assigneeName: selected ? getEntityName(selected) : undefined,
                assigneeType: selected?.type,
              });
            }}
          />
        </Box>
        {error && (
          <Alert
            title={t('message.onboarding-board-load-error')}
            variant="error"
          />
        )}
        {hasPartialScanResults(board) && (
          <Typography className="tw:text-tertiary" role="status" size="text-sm">
            {t('message.onboarding-board-scan-incomplete')}
          </Typography>
        )}
        <Card
          aria-label={t('label.onboarding-board')}
          className="tw:overflow-x-auto"
          role="region"
          tabIndex={0}>
          <Table aria-label={t('label.onboarding-board')}>
            <Table.Header>
              {[
                'asset',
                'entity-type',
                'domain',
                'stage',
                'progress',
                'waiting-on',
                'time-in-stage',
              ].map((key, index) => (
                <Table.Head
                  id={key}
                  isRowHeader={index === 0}
                  key={key}
                  label={t(`label.${key}`)}
                />
              ))}
            </Table.Header>
            <Table.Body
              items={board.data}
              renderEmptyState={() => (
                <Typography
                  className="tw:p-6 tw:text-tertiary"
                  role="status"
                  size="text-sm">
                  {t(boardEmptyMessage(loading, error, scanIncomplete))}
                </Typography>
              )}>
              {(row) => {
                const entity = row.entity;
                const counts = blockingProgress(row.steps);
                const entityType = Object.values(TargetEntityType).find(
                  (item) => item === entity?.type
                );
                const waiting = row.steps.filter(
                  (step) =>
                    step.required &&
                    step.state !== 'Complete' &&
                    step.state !== 'NotApplicable'
                );

                return (
                  <Table.Row id={entity?.id ?? row.configurationId}>
                    <Table.Cell>
                      {entity && entityType && (
                        <Link to={assetPath(entityType, assetName(entity))}>
                          {getEntityName(entity)}
                        </Link>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {entityType && t(`label.${ENTITY_LABELS[entityType]}`)}
                    </Table.Cell>
                    <Table.Cell>
                      {row.domains?.map(getEntityName).join(', ')}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={row.completed ? 'success' : 'brand'}>
                        {t(STAGE_LABELS[row.stage])}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Box className="tw:min-w-32" direction="col" gap={2}>
                        <ProgressBar
                          aria-label={t('label.progress')}
                          max={Math.max(counts.total, 1)}
                          value={counts.total ? counts.complete : 1}
                        />
                        <Typography className="tw:text-tertiary" size="text-xs">
                          {t('message.onboarding-progress-count', counts)}
                        </Typography>
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      <Box className="tw:gap-1" direction="col">
                        {waiting.map((step) => (
                          <Box align="start" gap={2} key={step.step.id}>
                            <Avatar
                              alt={
                                step.assignees?.map(getEntityName).join(', ') ||
                                t('label.unassigned')
                              }
                              initials={assigneeInitials(
                                step.assignees?.map(getEntityName).join(' ') ??
                                  ''
                              )}
                              size="xs"
                            />
                            <Typography size="text-sm">
                              {step.taskId ? (
                                <Link to={`/tasks/${step.taskId}`}>
                                  {step.step.title ?? step.step.id}
                                </Link>
                              ) : (
                                step.step.title ?? step.step.id
                              )}
                              {' · '}
                              {step.assignees?.map(getEntityName).join(', ') ||
                                t('label.unassigned')}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Table.Cell>
                    <Table.Cell>
                      {row.enteredAt &&
                        stageDuration(row.enteredAt, i18n.language)}
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table>
        </Card>
        <Box className="tw:justify-end tw:gap-3">
          <Button
            color="secondary"
            isDisabled={!previous.length || loading}
            onPress={() => {
              setSearch((current) => {
                const params = new URLSearchParams(current);
                const last = previous.at(-1);
                if (last) {
                  params.set('after', last);
                } else {
                  params.delete('after');
                }
                params.delete('previous');
                previous
                  .slice(0, -1)
                  .forEach((value) => params.append('previous', value));

                return params;
              });
            }}>
            {t('label.previous')}
          </Button>
          <Button
            color="secondary"
            isDisabled={!board.after || loading}
            onPress={() => {
              setSearch((current) => {
                const params = new URLSearchParams(current);
                params.append('previous', cursor ?? '');
                if (board.after) {
                  params.set('after', board.after);
                }

                return params;
              });
            }}>
            {t('label.next')}
          </Button>
        </Box>
      </Box>
    </PageLayoutV1>
  );
};

export default OnboardingBoardPage;
