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
  Box,
  Button,
  Card,
  Select,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  OnboardingAssignees,
  OnboardingSearchIndex,
} from '../../../components/governance/onboarding/OnboardingAssignees';
import {
  OnboardingAgeCell,
  OnboardingProgressCell,
  OnboardingStageBadge,
  OnboardingWaitingOnCell,
} from '../../../components/governance/onboarding/OnboardingRowCells';
import { OnboardingSummaryTiles } from '../../../components/governance/onboarding/OnboardingSummaryTiles';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { NO_DATA } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import {
  OnboardingConfiguration,
  OnboardingPlaybook,
  OnboardingStageDefinition,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { OnboardingBoard } from '../../../generated/governance/onboarding/onboardingBoard';
import {
  OnboardingProgress,
  OnboardingStepResult,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { OnboardingSummary } from '../../../generated/governance/onboarding/onboardingSummary';
import { EntityReference } from '../../../generated/type/entityReference';
import {
  getOnboardingSummary,
  listOnboarding,
  nudgeOnboarding,
} from '../../../rest/governance/onboarding/Onboarding.api';
import { getOnboardingPlaybooks } from '../../../rest/governance/onboarding/OnboardingPlaybook.api';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ONBOARDING_STAGE } from '../../../utils/governance/onboarding/Onboarding.constants';
import {
  ONBOARDING_ENTITY_TYPES,
  ONBOARDING_STAGES,
  STAGE_LABELS,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import { stageLabel } from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  blockingProgress,
  firstOpenBlocking,
  isLate,
  wasRemindedRecently,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import {
  getGateForStage,
  getStages,
} from '../../../utils/governance/playbooks/Playbook.utils';
import {
  getDataProductDetailsPath,
  getDomainDetailsPath,
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const DOMAIN_INDEX: OnboardingSearchIndex[] = [SearchIndex.DOMAIN];
/** The board's columns, in the order the design reads them; `nudge` is the unlabelled action. */
const BOARD_COLUMNS = [
  'asset',
  'stage',
  'playbook-progress',
  'waiting-on',
  'in-stage',
  'nudge',
];
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
/** A filter the board only sends when the URL carries it. */
const optionalParam = (search: URLSearchParams, key: string) =>
  search.get(key) ?? undefined;

/**
 * What the board covers, named after the lifecycle the assets are actually on rather than after the
 * default one: a playbook that renames its stages renames them here too.
 */
const BoardSubtitle = ({
  entityType,
  lifecycle,
}: {
  entityType?: TargetEntityType;
  lifecycle: OnboardingStageDefinition[];
}) => {
  const { t } = useTranslation();

  return (
    <Typography className="tw:text-tertiary" size="text-sm">
      {t('message.onboarding-board-subtitle', {
        entity: t(
          entityType ? `label.${ENTITY_LABELS[entityType]}` : 'label.asset'
        ).toLowerCase(),
        from: stageLabel(lifecycle[1]?.key ?? '', t, lifecycle),
        to: stageLabel(
          lifecycle[lifecycle.length - 2]?.key ?? '',
          t,
          lifecycle
        ),
      })}
    </Typography>
  );
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

interface BoardRowProps {
  /** The collection key react-aria resolves from the rendered element's own `id`. */
  id: string;
  row: OnboardingProgress;
  configuration?: OnboardingConfiguration;
  isNudging: boolean;
  onNudge: (row: OnboardingProgress, step: OnboardingStepResult) => void;
}

/** One asset on the board: where it is, how far through the gate, who it waits on, for how long. */
const BoardRow = ({
  id,
  row,
  configuration,
  isNudging,
  onNudge,
}: BoardRowProps) => {
  const { t } = useTranslation();
  const entity = row.entity;
  const counts = blockingProgress(row.steps);
  const entityType = Object.values(TargetEntityType).find(
    (item) => item === entity?.type
  );
  const late = isLate(row.enteredAt, getGateForStage(configuration, row.stage));
  const waiting = firstOpenBlocking(row.steps);
  const reminded = wasRemindedRecently(waiting);

  return (
    <Table.Row id={id}>
      <Table.Cell>
        <Box className="tw:min-w-0" direction="col">
          {entity && entityType && (
            <Link to={assetPath(entityType, assetName(entity))}>
              {getEntityName(entity)}
            </Link>
          )}
          <Typography className="tw:text-quaternary" size="text-xs">
            {row.domains?.map(getEntityName).join(', ') || NO_DATA}
          </Typography>
        </Box>
      </Table.Cell>
      <Table.Cell>
        <OnboardingStageBadge
          stage={row.stage}
          stages={configuration?.stages}
        />
      </Table.Cell>
      <Table.Cell>
        <OnboardingProgressCell
          complete={counts.complete}
          isLate={late}
          total={counts.total}
        />
      </Table.Cell>
      <Table.Cell>
        <OnboardingWaitingOnCell step={waiting} />
      </Table.Cell>
      <Table.Cell>
        <OnboardingAgeCell
          isLate={late}
          testId={`in-stage-${entity?.id}`}
          timestamp={row.enteredAt}
        />
      </Table.Cell>
      <Table.Cell>
        {waiting && (
          <Button
            color="secondary"
            data-testid={`nudge-${entity?.id}`}
            isDisabled={reminded}
            isLoading={isNudging}
            size="sm"
            onPress={() => onNudge(row, waiting)}>
            {t(reminded ? 'label.nudged' : 'label.nudge')}
          </Button>
        )}
      </Table.Cell>
    </Table.Row>
  );
};
const OnboardingBoardPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useSearchParams();
  const type = Object.values(TargetEntityType).find(
    (item) => item === search.get('entityType')
  );
  const stage = ONBOARDING_STAGES.find((item) => item === search.get('stage'));
  const cursor = optionalParam(search, 'after');
  const previous = search.getAll('previous');
  const domainId = optionalParam(search, 'domain');
  const assigneeId = optionalParam(search, 'assignee');
  const domains = filterReference(search, 'domain');
  const assignees = filterReference(search, 'assignee');
  const [board, setBoard] = useState<OnboardingBoard>({ data: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<OnboardingSummary>();
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [playbooks, setPlaybooks] = useState<OnboardingPlaybook[]>([]);
  const [nudging, setNudging] = useState<string>();
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

  /*
   * The tiles are an aggregate over months of history and are slower than the board itself, so they
   * load on their own and a failure leaves the table intact rather than blanking the page.
   */
  useEffect(() => {
    if (!type) {
      setSummary(undefined);

      return;
    }
    const controller = new AbortController();
    setIsSummaryLoading(true);
    getOnboardingSummary(type, controller.signal)
      .then((result) => setSummary(result))
      .catch(() => setSummary(undefined))
      .finally(() => setIsSummaryLoading(false));

    return () => controller.abort();
  }, [type]);

  /** What each row's gate tolerates before it counts as stalled; independent of the board itself. */
  useEffect(() => {
    getOnboardingPlaybooks()
      .then((result) => setPlaybooks(result.data ?? []))
      .catch(() => setPlaybooks([]));
  }, []);

  const configurationFor = useCallback(
    (configurationId?: string) =>
      playbooks.find((playbook) => playbook.id === configurationId)?.onboarding,
    [playbooks]
  );

  /*
   * The lifecycle the rows are moving through. Every asset of a type shares one playbook, so the
   * first row's is the board's, and an unconfigured board falls back to the default stage names.
   */
  const lifecycle = useMemo(
    () => getStages(configurationFor(board.data[0]?.configurationId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.data, playbooks]
  );

  /** The design names the first column after the asset type it is looking at. */
  const columnLabel = (key: string) => {
    if (key === 'nudge') {
      return '';
    }

    return key === 'asset' && type
      ? t(`label.${ENTITY_LABELS[type]}`)
      : t(`label.${key}`);
  };

  /**
   * Remind whoever the row is waiting on. A 429 means someone already did within the day, which is
   * still the answer the board should show, so the step is refreshed either way.
   */
  const handleNudge = useCallback(
    async (row: OnboardingProgress, step: OnboardingStepResult) => {
      const entityType = Object.values(TargetEntityType).find(
        (item) => item === row.entity?.type
      );
      if (!entityType || !row.entity?.id) {
        return;
      }
      setNudging(row.entity.id);
      try {
        const progress = await nudgeOnboarding(entityType, row.entity.id, {
          stepId: step.step.id,
        });
        setBoard((current) => ({
          ...current,
          data: current.data.map((candidate) =>
            candidate.entity?.id === row.entity?.id ? progress : candidate
          ),
        }));
      } catch (nudgeError) {
        showErrorToast(nudgeError as AxiosError);
      } finally {
        setNudging(undefined);
      }
    },
    []
  );

  return (
    <PageLayoutV1 pageTitle={t('label.onboarding-board')}>
      <Box
        className="tw:gap-6 tw:p-6"
        data-testid="onboarding-board"
        direction="col">
        <Box align="start" justify="between">
          <Box className="tw:gap-1.5" direction="col">
            <Typography size="display-sm" weight="semibold">
              {t('label.onboarding-board')}
            </Typography>
            <BoardSubtitle entityType={type} lifecycle={lifecycle} />
          </Box>
          <Button color="secondary" isLoading={loading} onPress={() => fetch()}>
            {t('label.refresh')}
          </Button>
        </Box>

        {type && (
          <OnboardingSummaryTiles
            configuration={configurationFor(board.data[0]?.configurationId)}
            entityType={type}
            isLoading={isSummaryLoading}
            summary={summary}
          />
        )}
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
              (item) => item !== ONBOARDING_STAGE.CREATION
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
              {BOARD_COLUMNS.map((key, index) => (
                <Table.Head
                  id={key}
                  isRowHeader={index === 0}
                  key={key}
                  label={columnLabel(key)}
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
              {(row) => (
                <BoardRow
                  configuration={configurationFor(row.configurationId)}
                  id={row.entity?.id ?? row.configurationId ?? ''}
                  isNudging={nudging === row.entity?.id}
                  row={row}
                  onNudge={handleNudge}
                />
              )}
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
