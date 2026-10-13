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
  Button,
  Dialog,
  Grid,
  Modal,
  ModalOverlay,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQueries } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  MEMORY_FIELDS,
  MEMORY_STATUS_LABEL_KEYS,
} from '../../../constants/ContextCenter.constants';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import { Task } from '../../../generated/entity/tasks/task';
import { getContextMemoryById } from '../../../rest/contextMemoryAPI';
import { resolveTask } from '../../../rest/tasksAPI';
import { CONTEXT_CENTER_MEMORY_DETAIL_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  CLAIM_RECENCY_LABELS,
  ReviewDecision,
  REVIEW_DECISIONS,
} from '../MemoryConflictReviews/MemoryConflictReviews.constants';
import {
  ClaimRecency,
  MemoryConflictReviewDispute,
} from '../MemoryConflictReviews/MemoryConflictReviews.types';
import {
  getConflictRecency,
  getReviewDisputes,
  getReviewedClaim,
  getReviewedMemoryTitle,
} from '../MemoryConflictReviews/MemoryConflictReviews.utils';
import {
  DiffSegment,
  getKeepHints,
  getMemoryByline,
  getMemoryDiffRows,
  KeepHint,
  MemoryDiffRow,
} from './MemoryConflictCompare.utils';

export interface MemoryConflictCompareProps {
  review: Task;
  onClose: () => void;
  onResolved: () => void;
}

const SEGMENT_CLASS: Record<string, string> = {
  removed:
    'tw:rounded-xs tw:bg-utility-error-100 tw:text-utility-error-700 tw:line-through',
  added: 'tw:rounded-xs tw:bg-utility-success-100 tw:text-utility-success-700',
};

const CHANGED_CELL_CLASS = {
  current: 'tw:bg-utility-error-50',
  proposed: 'tw:bg-utility-success-50',
};

const SideBadges: FC<{ status?: string; recency?: ClaimRecency }> = ({
  status,
  recency,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {status && (
        <Badge
          color={status === ContextMemoryStatus.Approved ? 'success' : 'gray'}
          size="sm"
          type="color">
          {MEMORY_STATUS_LABEL_KEYS[status]
            ? t(MEMORY_STATUS_LABEL_KEYS[status])
            : status}
        </Badge>
      )}
      {recency && (
        <Badge
          color={recency === 'newer' ? 'brand' : 'gray'}
          size="sm"
          type="color">
          {t(CLAIM_RECENCY_LABELS[recency])}
        </Badge>
      )}
    </>
  );
};

const SideTitle: FC<{ memory?: ContextMemory; testId: string }> = ({
  memory,
  testId,
}) => {
  const { t } = useTranslation();

  return (
    <Typography data-testid={testId} weight="semibold">
      {memory
        ? memory.title || memory.name
        : t('message.memory-no-longer-exists')}
    </Typography>
  );
};

interface SideHeaderProps {
  label: string;
  memory?: ContextMemory;
  status?: string;
  recency?: ClaimRecency;
  isLoading: boolean;
  testId: string;
  children?: ReactNode;
}

/** A column's head: whose side it is, where it stands and which is newer. */
const SideHeader: FC<SideHeaderProps> = ({
  label,
  memory,
  status,
  recency,
  isLoading,
  testId,
  children,
}) => (
  <Box className="tw:px-4 tw:py-3" direction="col" gap={1}>
    <Box align="center" gap={2} wrap="wrap">
      <Typography
        className="tw:text-tertiary tw:uppercase"
        size="text-xs"
        weight="semibold">
        {label}
      </Typography>
      <SideBadges recency={recency} status={status} />
    </Box>
    {isLoading ? (
      <Skeleton height="16px" variant="rounded" width="70%" />
    ) : (
      <SideTitle memory={memory} testId={testId} />
    )}
    <Typography className="tw:text-tertiary" size="text-xs">
      {getMemoryByline(memory)}
    </Typography>
    {children}
  </Box>
);

const DiffValue: FC<{
  segments: DiffSegment[];
  kind: MemoryDiffRow['kind'];
}> = ({ segments, kind }) => {
  if (segments.every(({ value }) => !value.trim())) {
    return (
      <Typography className="tw:text-quaternary" size="text-sm">
        {NO_DATA_PLACEHOLDER}
      </Typography>
    );
  }

  return (
    <Typography
      as="div"
      className={classNames('tw:text-secondary tw:break-words', {
        'tw:whitespace-pre-wrap': kind === 'text',
        'tw:flex tw:flex-wrap tw:gap-1.5': kind === 'list',
      })}
      size="text-sm">
      {segments.map(({ id, value, change }) => (
        <span
          className={classNames(change && SEGMENT_CLASS[change], {
            'tw:rounded-md tw:border tw:border-secondary tw:px-1.5':
              kind === 'list',
          })}
          data-change={change}
          key={id}>
          {value}
        </span>
      ))}
    </Typography>
  );
};

const DiffCell: FC<{
  row: MemoryDiffRow;
  side: 'current' | 'proposed';
}> = ({ row, side }) => (
  <Grid.Item
    className={classNames(
      'tw:border-l tw:border-secondary tw:px-4 tw:py-3',
      row.sides.isChanged && CHANGED_CELL_CLASS[side]
    )}
    data-testid={`diff-${side}-${row.key}`}
    role="cell"
    span={10}>
    <DiffValue kind={row.kind} segments={row.sides[side]} />
  </Grid.Item>
);

const DiffRow: FC<{ row: MemoryDiffRow }> = ({ row }) => {
  const { t } = useTranslation();
  const { isChanged } = row.sides;

  return (
    <Grid
      className="tw:border-b tw:border-secondary tw:last:border-b-0"
      data-changed={isChanged}
      data-testid={`diff-row-${row.key}`}
      role="row">
      <Grid.Item className="tw:px-4 tw:py-3" role="rowheader" span={4}>
        <Typography
          className={isChanged ? 'tw:text-primary' : 'tw:text-tertiary'}
          size="text-sm"
          weight={isChanged ? 'semibold' : 'medium'}>
          {t(row.labelKey)}
        </Typography>
      </Grid.Item>
      <DiffCell row={row} side="current" />
      <DiffCell row={row} side="proposed" />
    </Grid>
  );
};

const ConflictContext: FC<{ question?: string; reason?: string }> = ({
  question,
  reason,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:rounded-lg tw:bg-secondary tw:px-4 tw:py-3"
      direction="col"
      gap={1}>
      {question && (
        <Typography data-testid="compare-question" weight="semibold">
          {question}
        </Typography>
      )}
      {reason && (
        <Typography
          className="tw:text-tertiary"
          data-testid="compare-reason"
          size="text-sm">
          {t('message.why-they-conflict', { reason })}
        </Typography>
      )}
    </Box>
  );
};

interface MemorySide {
  memory?: ContextMemory;
  isLoading: boolean;
  status?: string;
  recency?: ClaimRecency;
}

interface DiffHeaderRowProps {
  current: MemorySide;
  proposed: MemorySide;
  disputes: MemoryConflictReviewDispute[];
  disputedId?: string;
  onSelectDisputed: (id: string) => void;
}

const DiffHeaderRow: FC<DiffHeaderRowProps> = ({
  current,
  proposed,
  disputes,
  disputedId,
  onSelectDisputed,
}) => {
  const { t } = useTranslation();

  return (
    <Grid
      className="tw:border-b tw:border-secondary tw:bg-secondary"
      role="row">
      <Grid.Item className="tw:px-4 tw:py-3" role="columnheader" span={4}>
        <Typography
          className="tw:text-tertiary tw:uppercase"
          size="text-xs"
          weight="semibold">
          {t('label.field')}
        </Typography>
      </Grid.Item>
      <Grid.Item
        className="tw:border-l tw:border-secondary"
        role="columnheader"
        span={10}>
        <SideHeader
          {...current}
          label={t('label.current')}
          testId="compare-current-title">
          {disputes.length > 1 && (
            <Tabs
              selectedKey={disputedId}
              onSelectionChange={(key) => onSelectDisputed(String(key))}>
              <Tabs.List
                items={disputes.map(({ memory }) => ({
                  id: memory.id,
                  label: getEntityName(memory),
                }))}
                type="button-gray">
                {(tab) => <Tabs.Item {...tab} />}
              </Tabs.List>
            </Tabs>
          )}
        </SideHeader>
      </Grid.Item>
      <Grid.Item
        className="tw:border-l tw:border-secondary"
        role="columnheader"
        span={10}>
        <SideHeader
          {...proposed}
          label={t('label.in-review')}
          testId="compare-proposed-title"
        />
      </Grid.Item>
    </Grid>
  );
};

interface KeepActionProps {
  hint: KeepHint;
  testId: string;
  isDisabled: boolean;
  isLoading: boolean;
  onKeep: () => void;
}

const KeepAction: FC<KeepActionProps> = ({
  hint,
  testId,
  isDisabled,
  isLoading,
  onKeep,
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" gap={3}>
      <Button
        className="tw:shrink-0"
        color="primary"
        data-testid={testId}
        isDisabled={isDisabled}
        isLoading={isLoading}
        size="md"
        onClick={onKeep}>
        {t('label.keep-this-one')}
      </Button>
      <Typography className="tw:text-tertiary" size="text-xs">
        {t(hint.key, hint.options)}
      </Typography>
    </Box>
  );
};

/**
 * One dialog that reads like a split diff: the Approved memory on the left,
 * the memory in review on the right, field by field, with what the memory in
 * review drops and adds highlighted. Keeping the memory in review approves it
 * and supersedes the memories it contradicts; keeping those rejects it.
 */
const MemoryConflictCompare: FC<MemoryConflictCompareProps> = ({
  review,
  onClose,
  onResolved,
}) => {
  const { t } = useTranslation();
  const claim = getReviewedClaim(review);
  const disputes = getReviewDisputes(review);
  const recency = getConflictRecency(claim, disputes);
  const [disputedId, setDisputedId] = useState(disputes[0]?.memory.id);
  const [resolving, setResolving] = useState<ReviewDecision>();
  const dispute = disputes.find(({ memory }) => memory.id === disputedId);
  const hints = getKeepHints(
    disputes,
    getReviewedMemoryTitle(review) ?? getEntityName(review.about)
  );

  const [reviewed, disputed] = useQueries({
    queries: [review.about?.id, disputedId].map((id) => ({
      queryKey: [...CONTEXT_CENTER_MEMORY_DETAIL_QUERY_KEY, id],
      queryFn: () => getContextMemoryById(id ?? '', MEMORY_FIELDS),
      enabled: Boolean(id),
      retry: false,
    })),
  });

  const handleKeep = useCallback(
    async (decision: ReviewDecision) => {
      setResolving(decision);
      try {
        await resolveTask(review.id, {
          transitionId: decision,
          resolutionType: REVIEW_DECISIONS[decision],
        });
        showSuccessToast(t('server.task-resolved-successfully'));
        onResolved();
        onClose();
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setResolving(undefined);
      }
    },
    [review.id, onResolved, onClose, t]
  );

  return (
    <ModalOverlay
      isOpen
      style={{ zIndex: 999 }}
      onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="memory-compare-modal"
          dividers="scroll"
          title={review.displayName ?? t('label.compare-memories')}
          width={1200}
          onClose={onClose}>
          <Dialog.Content>
            <Box direction="col" gap={4}>
              <ConflictContext
                question={claim?.question}
                reason={dispute?.reason}
              />
              <div
                aria-label={t('label.compare-memories')}
                className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary"
                role="table">
                <DiffHeaderRow
                  current={{
                    memory: disputed.data,
                    isLoading: disputed.isLoading,
                    status:
                      disputed.data?.entityStatus ?? dispute?.claim?.status,
                    recency: recency.disputed[disputedId ?? ''],
                  }}
                  disputedId={disputedId}
                  disputes={disputes}
                  proposed={{
                    memory: reviewed.data,
                    isLoading: reviewed.isLoading,
                    status: reviewed.data?.entityStatus ?? claim?.status,
                    recency: recency.reviewed,
                  }}
                  onSelectDisputed={setDisputedId}
                />
                {getMemoryDiffRows(disputed.data, reviewed.data).map((row) => (
                  <DiffRow key={row.key} row={row} />
                ))}
              </div>
            </Box>
          </Dialog.Content>
          <Dialog.Footer>
            <Grid className="tw:w-full" colGap="4">
              <Grid.Item span={4} />
              <Grid.Item span={10}>
                <KeepAction
                  hint={hints.approved}
                  isDisabled={Boolean(resolving)}
                  isLoading={resolving === 'reject'}
                  testId="keep-approved-memories"
                  onKeep={() => handleKeep('reject')}
                />
              </Grid.Item>
              <Grid.Item span={10}>
                <KeepAction
                  hint={hints.reviewed}
                  isDisabled={Boolean(resolving)}
                  isLoading={resolving === 'approve'}
                  testId="keep-reviewed-memory"
                  onKeep={() => handleKeep('approve')}
                />
              </Grid.Item>
            </Grid>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default MemoryConflictCompare;
