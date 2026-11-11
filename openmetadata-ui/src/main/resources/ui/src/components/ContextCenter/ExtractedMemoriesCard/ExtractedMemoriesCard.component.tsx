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
  Box,
  Button,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CONTEXT_FILE_ENTITY_TYPE } from '../../../constants/ContextCenter.constants';
import { EntityType } from '../../../enums/entity.enum';
import { ExtractedMemoryApproval } from '../../../generated/api/context/extractedMemoryApproval';
import {
  ContextMemory,
  EntityReference,
} from '../../../generated/entity/context/contextMemory';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { queryClient } from '../../../queryClient';
import {
  approveExtractedMemories,
  getExtractedMemoryApproval,
  getListContextMemories,
} from '../../../rest/contextMemoryAPI';
import { CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY } from '../../../utils/ContextCenterQueryKeys';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../../utils/ToastUtils';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import CreateMemoryModal from '../CreateMemoryModal/CreateMemoryModal.component';
import {
  canApproveExtractedMemories,
  getApprovalPendingCount,
  getDisplayedMemoryApproval,
} from './ExtractedMemoriesCard.utils';

interface ExtractedMemoriesCardProps {
  sourceId: string;
  /** The document the memories were extracted from: a context file or a page. */
  sourceType: typeof CONTEXT_FILE_ENTITY_TYPE | EntityType.KNOWLEDGE_PAGE;
  /** The document's owners, who approve its extracted memories as admins do. */
  sourceOwners?: EntityReference[];
  collapsible?: boolean;
  titleClassName?: string;
}

const ExtractedMemoriesCard: FC<ExtractedMemoriesCardProps> = ({
  sourceId,
  sourceType,
  sourceOwners,
  collapsible = false,
  titleClassName,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [memories, setMemories] = useState<ContextMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [memoryToView, setMemoryToView] = useState<ContextMemory>();
  const [approval, setApproval] = useState<ExtractedMemoryApproval>();
  const [approvingSourceId, setApprovingSourceId] = useState<string>();
  // Bumped after a write, so both effects refetch for the document shown now.
  const [refreshCount, setRefreshCount] = useState(0);

  const canApprove = canApproveExtractedMemories(currentUser, sourceOwners);
  const isApproving = approvingSourceId === sourceId;
  const displayedApproval = useMemo(
    () =>
      isLoading ? undefined : getDisplayedMemoryApproval(approval, memories),
    [approval, isLoading, memories]
  );
  const pendingCount = getApprovalPendingCount(displayedApproval);

  const fetchMemories = useCallback(
    async (isCancelled?: () => boolean) => {
      try {
        setIsLoading(true);
        const response = await getListContextMemories({
          sourceEntityId: sourceId,
          fields: 'owners,sourceEntity,derivedEntities',
          limit: 50,
        });
        if (!isCancelled?.()) {
          setMemories(response.data);
        }
      } catch {
        if (!isCancelled?.()) {
          setMemories([]);
        }
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [sourceId]
  );

  useEffect(() => {
    let isStale = false;
    fetchMemories(() => isStale);

    return () => {
      isStale = true;
    };
  }, [fetchMemories, refreshCount]);

  useEffect(() => {
    let isStale = false;
    setApproval(undefined);
    const fetchApproval = async () => {
      try {
        const preview = await getExtractedMemoryApproval(sourceId, sourceType);
        if (!isStale) {
          setApproval(preview);
        }
      } catch {
        // A 403 or a failed preview offers nothing to approve.
      }
    };
    if (canApprove) {
      fetchApproval();
    }

    return () => {
      isStale = true;
    };
  }, [canApprove, sourceId, sourceType, refreshCount]);

  const handleMemoryChanged = useCallback(() => {
    setMemoryToView(undefined);
    setRefreshCount((count) => count + 1);
  }, []);

  const handleApproveExtracted = useCallback(async () => {
    setApprovingSourceId(sourceId);
    try {
      const result = await approveExtractedMemories({
        source: { id: sourceId, type: sourceType },
        approvable: displayedApproval?.approvable ?? [],
      });
      const failedCount = result.failed ?? 0;
      if (result.approved > 0) {
        showSuccessToast(
          t('message.memories-approved', { approvedCount: result.approved })
        );
      }
      if (result.needsDecision.length > 0) {
        showInfoToast(
          t('message.extracted-memories-need-decision', {
            decisionCount: result.needsDecision.length,
          })
        );
      }
      if (failedCount > 0) {
        showErrorToast(t('message.memories-not-approved', { failedCount }));
      }
      void queryClient.invalidateQueries({
        queryKey: CONTEXT_CENTER_MEMORIES_COUNT_QUERY_KEY,
      });
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setApprovingSourceId((current) =>
        current === sourceId ? undefined : current
      );
      setRefreshCount((count) => count + 1);
    }
  }, [displayedApproval, sourceId, sourceType, t]);

  const canDeleteMemory =
    (memoryToView?.owners?.some((o) => o.name === currentUser?.name) ??
      false) ||
    Boolean(currentUser?.isAdmin);

  const memoriesTitle = `${t('label.memory-plural')}${
    !isLoading && memories.length > 0 ? ` (${memories.length})` : ''
  }`;

  const approveAction = pendingCount > 0 && (
    <div className="tw:mb-3">
      <Button
        color="secondary"
        data-testid="approve-extracted-memories-btn"
        iconLeading={Check}
        isDisabled={isApproving}
        isLoading={isApproving}
        size="sm"
        onClick={handleApproveExtracted}>
        {t('label.approve-extracted-memories', { pendingCount })}
      </Button>
    </div>
  );

  const memoriesBody =
    memories.length === 0 ? (
      <Typography className="tw:text-utility-gray-400" size="text-sm">
        {t('label.no-entity', { entity: t('label.memory-plural') })}
      </Typography>
    ) : (
      <Box direction="col">
        {memories.map((memory) => (
          <Box
            className="tw:py-1.5 tw:-mx-2 tw:px-2 tw:rounded-md tw:cursor-pointer tw:hover:bg-primary_hover"
            data-testid={`extracted-memory-${memory.id}`}
            direction="col"
            key={memory.id}
            role="button"
            tabIndex={0}
            onClick={() => setMemoryToView(memory)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setMemoryToView(memory);
              }
            }}>
            <Typography
              ellipsis
              className="tw:text-primary"
              size="text-sm"
              weight="medium">
              {memory.title ?? getEntityName(memory)}
            </Typography>
            {memory.question && (
              <Typography
                ellipsis
                className="tw:text-quaternary"
                size="text-xs">
                {memory.question}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    );

  const memoriesContent = (
    <>
      {approveAction}
      {isLoading ? (
        <Box direction="col" gap={2}>
          <Skeleton height="14px" variant="rounded" width="80%" />
          <Skeleton height="14px" variant="rounded" width="60%" />
        </Box>
      ) : (
        memoriesBody
      )}

      {memoryToView && (
        <CreateMemoryModal
          viewOnly
          canDelete={canDeleteMemory}
          currentUserName={currentUser?.name}
          isAdminUser={currentUser?.isAdmin}
          isOpen={Boolean(memoryToView)}
          memoryToEdit={memoryToView}
          onClose={() => setMemoryToView(undefined)}
          onCreated={() => setMemoryToView(undefined)}
          onDeleted={handleMemoryChanged}
          onUpdated={handleMemoryChanged}
        />
      )}
    </>
  );

  if (collapsible) {
    return (
      <WidgetCard
        dataTestId="extracted-memories-card"
        isExpandDisabled={isLoading}
        title={memoriesTitle}>
        {memoriesContent}
      </WidgetCard>
    );
  }

  return (
    // shrink-0: Card sets overflow-hidden, which lets flexbox shrink it to fit
    // the scroll container and clip the list instead of letting the body scroll
    <Card className="tw:p-4 tw:shrink-0" data-testid="extracted-memories-card">
      <div className="tw:mb-3">
        <Typography
          className={classNames('tw:text-quaternary', titleClassName)}
          size="text-xs"
          weight="semibold">
          {memoriesTitle}
        </Typography>
      </div>
      {memoriesContent}
    </Card>
  );
};

export default ExtractedMemoriesCard;
