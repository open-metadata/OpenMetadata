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
  Select,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  useQueries,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, ReactNode, useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import {
  MEMORY_FIELDS,
  MEMORY_STATUS_LABEL_KEYS,
} from '../../../../constants/ContextCenter.constants';
import {
  ContextMemory,
  ContextMemoryStatus,
  EntityReference,
} from '../../../../generated/entity/context/contextMemory';
import { Task } from '../../../../generated/entity/tasks/task';
import { getContextMemoryById } from '../../../../rest/contextMemoryAPI';
import { resolveTask } from '../../../../rest/tasksAPI';
import {
  CONTEXT_CENTER_MEMORY_DETAIL_QUERY_KEY,
  CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY,
} from '../../../../utils/ContextCenterQueryKeys';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  CLAIM_RECENCY_LABELS,
  ReviewDecision,
  REVIEW_DECISIONS,
} from '../MemoryConflictReviews/MemoryConflictReviews.constants';
import { ClaimRecency } from '../MemoryConflictReviews/MemoryConflictReviews.types';
import {
  getConflictRecency,
  getDisputeReason,
  getReviewDisputes,
} from '../MemoryConflictReviews/MemoryConflictReviews.utils';
import {
  CHANGED_CELL_CLASS,
  DIFF_SKELETON_ROW_KEYS,
  SEGMENT_CLASS,
  SEGMENT_TAG,
} from './MemoryConflictCompare.constants';
import {
  DiffSegment,
  KeepHint,
  MemoryDiffRow,
  UnavailableMemory,
} from './MemoryConflictCompare.types';
import {
  getKeepHints,
  getMemoryByline,
  getMemoryDiffRows,
  getUnavailableMemory,
  getUnavailableMemoryLabel,
} from './MemoryConflictCompare.utils';

export interface MemoryConflictCompareProps {
  review: Task;
  onClose: () => void;
  onResolved: () => void;
}

interface MemorySide {
  memory?: ContextMemory;
  isLoading: boolean;
  unavailable?: UnavailableMemory;
  recency?: ClaimRecency;
}

const toSide = (
  result: UseQueryResult<ContextMemory> | undefined,
  recency?: ClaimRecency
): MemorySide => ({
  memory: result?.data,
  isLoading: Boolean(result?.isLoading),
  unavailable: getUnavailableMemory(result?.error),
  recency,
});

const titleOf = (memory?: ContextMemory, reference?: EntityReference) =>
  memory?.title || (reference ? getEntityName(reference) : '');

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

const SideTitle: FC<{ side: MemorySide; testId: string }> = ({
  side,
  testId,
}) => {
  const { t } = useTranslation();

  if (side.isLoading) {
    return <Skeleton height="16px" variant="rounded" width="70%" />;
  }

  return (
    <Typography data-testid={testId} weight="semibold">
      {side.memory
        ? titleOf(side.memory)
        : side.unavailable && getUnavailableMemoryLabel(side.unavailable, t)}
    </Typography>
  );
};

interface SideHeaderProps {
  label: string;
  side: MemorySide;
  testId: string;
  children?: ReactNode;
}

/** A column's head: whose side it is, where it stands and which is newer. */
const SideHeader: FC<SideHeaderProps> = ({ label, side, testId, children }) => (
  <Box className="tw:px-4 tw:py-3" direction="col" gap={1}>
    <Box align="center" gap={2} wrap="wrap">
      <Typography
        className="tw:text-tertiary tw:uppercase"
        size="text-xs"
        weight="semibold">
        {label}
      </Typography>
      <SideBadges recency={side.recency} status={side.memory?.entityStatus} />
    </Box>
    {children}
    <SideTitle side={side} testId={testId} />
    <Typography className="tw:text-tertiary" size="text-xs">
      {getMemoryByline(side.memory)}
    </Typography>
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
      {segments.map(({ id, value, change }) => {
        const Segment = change ? SEGMENT_TAG[change] : 'span';

        return (
          <Segment
            className={classNames(change && SEGMENT_CLASS[change], {
              'tw:rounded-md tw:border tw:border-secondary tw:px-1.5':
                kind === 'list',
            })}
            data-change={change}
            key={id}>
            {value}
          </Segment>
        );
      })}
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

const DiffRowsSkeleton: FC = () => (
  <>
    {DIFF_SKELETON_ROW_KEYS.map((key) => (
      <Grid
        className="tw:border-b tw:border-secondary"
        data-testid="diff-row-skeleton"
        key={key}
        role="row">
        <Grid.Item className="tw:px-4 tw:py-3" role="rowheader" span={4}>
          <Skeleton height="14px" variant="rounded" width="60%" />
        </Grid.Item>
        {['current', 'proposed'].map((side) => (
          <Grid.Item
            className="tw:border-l tw:border-secondary tw:px-4 tw:py-3"
            key={side}
            role="cell"
            span={10}>
            <Skeleton height="14px" variant="rounded" width="80%" />
          </Grid.Item>
        ))}
      </Grid>
    ))}
  </>
);

const ConflictContext: FC<{ question?: string; reason?: string }> = ({
  question,
  reason,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:rounded-lg tw:bg-secondary tw:px-4 tw:py-3">
      <Box direction="col" gap={1}>
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
    </div>
  );
};

interface DisputedPickerProps {
  options: { id: string; label: string }[];
  value?: string;
  onChange: (id: string) => void;
}

/** With several contradicted memories, the left column shows one at a time. */
const DisputedPicker: FC<DisputedPickerProps> = ({
  options,
  value,
  onChange,
}) => {
  const { t } = useTranslation();

  return (
    <Select
      aria-label={t('label.current')}
      data-testid="disputed-memory-select"
      fontSize="sm"
      size="sm"
      value={value}
      onChange={(key) => onChange(String(key))}>
      {options.map(({ id, label }) => (
        <Select.Item id={id} key={id} label={label} />
      ))}
    </Select>
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
  const hintId = useId();

  return (
    <Box align="center" gap={3}>
      <Button
        aria-describedby={hintId}
        className="tw:shrink-0"
        color="primary"
        data-testid={testId}
        isDisabled={isDisabled}
        isLoading={isLoading}
        size="md"
        onClick={onKeep}>
        {t('label.keep-this-one')}
      </Button>
      <Typography className="tw:text-tertiary" id={hintId} size="text-xs">
        {t(hint.key, hint.options)}
      </Typography>
    </Box>
  );
};

/**
 * One dialog that reads like a split diff: the Approved memory on the left,
 * the memory in review on the right, field by field, with what the memory in
 * review drops and adds marked. Both are read through the memory API, which
 * applies their visibility. Keeping the memory in review approves it and
 * supersedes the memories it contradicts; keeping those rejects it.
 */
const MemoryConflictCompare: FC<MemoryConflictCompareProps> = ({
  review,
  onClose,
  onResolved,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const disputes = useMemo(() => getReviewDisputes(review), [review]);
  const [disputedId, setDisputedId] = useState(disputes[0]?.memory.id);
  const [resolving, setResolving] = useState<ReviewDecision>();
  const dispute = disputes.find(({ memory }) => memory.id === disputedId);

  const [reviewed, ...disputed] = useQueries({
    queries: [review.about?.id, ...disputes.map(({ memory }) => memory.id)].map(
      (id) => ({
        queryKey: [...CONTEXT_CENTER_MEMORY_DETAIL_QUERY_KEY, id],
        queryFn: () => getContextMemoryById(id ?? '', MEMORY_FIELDS),
        enabled: Boolean(id),
        retry: false,
      })
    ),
  });
  const shown = disputed[disputes.indexOf(dispute ?? disputes[0])];
  const recency = getConflictRecency(
    reviewed.data,
    disputed.flatMap(({ data }) => (data ? [data] : []))
  );
  const isComparing = !reviewed.isLoading && !shown?.isLoading;
  const rows = useMemo(
    () => getMemoryDiffRows(shown?.data, reviewed.data, t),
    [shown?.data, reviewed.data, t]
  );
  const hints = getKeepHints(
    disputes,
    titleOf(reviewed.data, review.about),
    titleOf(shown?.data, dispute?.memory)
  );
  const pickerOptions = disputes.map(({ memory }, index) => ({
    id: memory.id,
    label: titleOf(disputed[index]?.data, memory),
  }));

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
        queryClient.invalidateQueries({
          queryKey: CONTEXT_CENTER_MEMORY_REVIEWS_QUERY_KEY,
        });
      } finally {
        setResolving(undefined);
      }
    },
    [review.id, onResolved, onClose, queryClient, t]
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
          title={t('label.compare-memories')}
          width={1200}
          onClose={onClose}>
          <Dialog.Content>
            <Box direction="col" gap={4}>
              <ConflictContext
                question={reviewed.data?.question}
                reason={getDisputeReason(reviewed.data, disputedId)}
              />
              <div
                aria-label={t('label.compare-memories')}
                className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary"
                role="table">
                <Grid
                  className="tw:border-b tw:border-secondary tw:bg-secondary"
                  role="row">
                  <Grid.Item
                    className="tw:px-4 tw:py-3"
                    role="columnheader"
                    span={4}>
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
                      label={t('label.current')}
                      side={toSide(shown, recency.disputed[disputedId ?? ''])}
                      testId="compare-current-title">
                      {disputes.length > 1 && (
                        <DisputedPicker
                          options={pickerOptions}
                          value={disputedId}
                          onChange={setDisputedId}
                        />
                      )}
                    </SideHeader>
                  </Grid.Item>
                  <Grid.Item
                    className="tw:border-l tw:border-secondary"
                    role="columnheader"
                    span={10}>
                    <SideHeader
                      label={t('label.in-review')}
                      side={toSide(reviewed, recency.reviewed)}
                      testId="compare-proposed-title"
                    />
                  </Grid.Item>
                </Grid>
                {isComparing ? (
                  rows.map((row) => <DiffRow key={row.key} row={row} />)
                ) : (
                  <DiffRowsSkeleton />
                )}
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
