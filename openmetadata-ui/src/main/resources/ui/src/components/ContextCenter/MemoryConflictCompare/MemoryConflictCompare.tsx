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
  CloseButton,
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
import { FC, ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import CreateMemoryModal from '../CreateMemoryModal/CreateMemoryModal.component';
import {
  CLAIM_RECENCY_LABELS,
  ReviewDecision,
  REVIEW_DECISIONS,
} from '../MemoryConflictReviews/MemoryConflictReviews.constants';
import { ClaimRecency } from '../MemoryConflictReviews/MemoryConflictReviews.types';
import {
  getConflictRecency,
  getReviewDisputes,
  getReviewedClaim,
  getReviewedMemoryTitle,
} from '../MemoryConflictReviews/MemoryConflictReviews.utils';

export interface MemoryConflictCompareProps {
  review: Task;
  currentUserName?: string;
  isAdminUser?: boolean;
  onClose: () => void;
  onResolved: () => void;
}

interface SideHeaderProps {
  label: string;
  status?: string;
  recency?: ClaimRecency;
  children?: ReactNode;
}

const SideHeader: FC<SideHeaderProps> = ({
  label,
  status,
  recency,
  children,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:rounded-xl tw:bg-overlay-surface tw:px-4 tw:py-2"
      gap={2}
      wrap="wrap">
      <Typography size="text-sm" weight="semibold">
        {label}
      </Typography>
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
      {children}
    </Box>
  );
};

interface KeepFooterProps {
  hint: string;
  testId: string;
  isDisabled: boolean;
  isLoading: boolean;
  onKeep: () => void;
}

const KeepFooter: FC<KeepFooterProps> = ({
  hint,
  testId,
  isDisabled,
  isLoading,
  onKeep,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:shrink-0 tw:border-t tw:border-tertiary tw:px-6 tw:py-4"
      gap={3}
      justify="between">
      <Typography className="tw:text-tertiary" size="text-xs">
        {hint}
      </Typography>
      <Button
        className="tw:shrink-0"
        color="primary"
        data-testid={testId}
        isDisabled={isDisabled}
        isLoading={isLoading}
        size="md"
        type="button"
        onClick={onKeep}>
        {t('label.keep-this-one')}
      </Button>
    </Box>
  );
};

interface MemoryPanelProps {
  memory?: ContextMemory;
  isLoading: boolean;
  footer: ReactNode;
  currentUserName?: string;
  isAdminUser?: boolean;
  onClose: () => void;
}

/** The memory exactly as its own detail modal shows it, as one panel. */
const MemoryPanel: FC<MemoryPanelProps> = ({
  memory,
  isLoading,
  footer,
  currentUserName,
  isAdminUser,
  onClose,
}) => {
  const { t } = useTranslation();

  if (memory) {
    return (
      <CreateMemoryModal
        embedded
        isOpen
        viewOnly
        currentUserName={currentUserName}
        footer={footer}
        isAdminUser={isAdminUser}
        memoryToEdit={memory}
        onClose={onClose}
        onCreated={onClose}
      />
    );
  }

  return (
    <Box
      className="tw:h-full tw:overflow-hidden tw:rounded-2xl tw:bg-overlay-surface tw:shadow-overlay"
      direction="col"
      justify="between">
      <Box className="tw:p-6" direction="col" gap={3}>
        {isLoading ? (
          <>
            <Skeleton height="20px" variant="rounded" width="60%" />
            <Skeleton height="120px" variant="rounded" width="100%" />
          </>
        ) : (
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.memory-no-longer-exists')}
          </Typography>
        )}
      </Box>
      {footer}
    </Box>
  );
};

/**
 * Both sides of a memory conflict in full, each as its own detail modal shows
 * it, next to each other. Keeping the memory in review approves it and
 * supersedes the memories it contradicts; keeping those rejects it.
 */
const MemoryConflictCompare: FC<MemoryConflictCompareProps> = ({
  review,
  currentUserName,
  isAdminUser,
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
  const reviewedTitle =
    getReviewedMemoryTitle(review) ?? getEntityName(review.about);
  const isSingle = disputes.length === 1;

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
          aria-label={t('label.compare-memories')}
          data-testid="memory-compare-modal"
          panelClassName="tw:bg-transparent! tw:shadow-none!"
          width={1320}>
          <Box direction="col" gap={3}>
            <Box
              align="start"
              className="tw:rounded-2xl tw:bg-overlay-surface tw:shadow-overlay tw:px-6 tw:py-4"
              gap={4}
              justify="between">
              <Box direction="col" gap={1}>
                <Typography data-testid="compare-question" weight="semibold">
                  {claim?.question ?? reviewedTitle}
                </Typography>
                {dispute?.reason && (
                  <Typography
                    className="tw:text-tertiary"
                    data-testid="compare-reason"
                    size="text-sm">
                    {t('message.why-they-conflict', { reason: dispute.reason })}
                  </Typography>
                )}
              </Box>
              <CloseButton
                aria-label={t('label.close')}
                data-testid="close-compare"
                onPress={onClose}
              />
            </Box>
            <Grid colGap="4" rowGap="3">
              <Grid.Item span={12}>
                <Box direction="col" gap={2}>
                  <SideHeader
                    label={t('label.in-review')}
                    recency={recency.reviewed}
                    status={reviewed.data?.entityStatus ?? claim?.status}
                  />
                  <div className="tw:h-[68vh]">
                    <MemoryPanel
                      currentUserName={currentUserName}
                      footer={
                        <KeepFooter
                          hint={
                            isSingle
                              ? t('message.keep-reviewed-memory-hint', {
                                  title: getEntityName(disputes[0].memory),
                                })
                              : t('message.keep-reviewed-memory-hint-plural', {
                                  count: disputes.length,
                                })
                          }
                          isDisabled={Boolean(resolving)}
                          isLoading={resolving === 'approve'}
                          testId="keep-reviewed-memory"
                          onKeep={() => handleKeep('approve')}
                        />
                      }
                      isAdminUser={isAdminUser}
                      isLoading={reviewed.isLoading}
                      memory={reviewed.data}
                      onClose={onClose}
                    />
                  </div>
                </Box>
              </Grid.Item>
              <Grid.Item span={12}>
                <Box direction="col" gap={2}>
                  <SideHeader
                    label={t('label.conflicts-with')}
                    recency={
                      disputedId ? recency.disputed[disputedId] : undefined
                    }
                    status={
                      disputed.data?.entityStatus ?? dispute?.claim?.status
                    }>
                    {!isSingle && (
                      <Tabs
                        selectedKey={disputedId}
                        onSelectionChange={(key) => setDisputedId(String(key))}>
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
                  <div className="tw:h-[68vh]">
                    <MemoryPanel
                      currentUserName={currentUserName}
                      footer={
                        <KeepFooter
                          hint={
                            isSingle
                              ? t('message.keep-approved-memory-hint', {
                                  title: reviewedTitle,
                                })
                              : t('message.keep-approved-memories-hint', {
                                  title: reviewedTitle,
                                })
                          }
                          isDisabled={Boolean(resolving)}
                          isLoading={resolving === 'reject'}
                          testId="keep-approved-memories"
                          onKeep={() => handleKeep('reject')}
                        />
                      }
                      isAdminUser={isAdminUser}
                      isLoading={disputed.isLoading}
                      memory={disputed.data}
                      onClose={onClose}
                    />
                  </div>
                </Box>
              </Grid.Item>
            </Grid>
          </Box>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default MemoryConflictCompare;
