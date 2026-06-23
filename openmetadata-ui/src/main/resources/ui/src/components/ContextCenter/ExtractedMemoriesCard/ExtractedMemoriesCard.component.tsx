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
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import CreateMemoryModal from '../CreateMemoryModal/CreateMemoryModal.component';

interface ExtractedMemoriesCardProps {
  sourceId: string;
}

const ExtractedMemoriesCard: FC<ExtractedMemoriesCardProps> = ({
  sourceId,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [memories, setMemories] = useState<ContextMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [memoryToView, setMemoryToView] = useState<ContextMemory>();

  const fetchMemories = useCallback(
    async (isCancelled?: () => boolean) => {
      try {
        setIsLoading(true);
        const response = await getListContextMemories({
          sourceEntityId: sourceId,
          fields: 'owners,sourceEntity',
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
  }, [fetchMemories]);

  const handleMemoryDeleted = useCallback(() => {
    setMemoryToView(undefined);
    fetchMemories();
  }, [fetchMemories]);

  const canDeleteMemory =
    (memoryToView?.owners?.some((o) => o.name === currentUser?.name) ??
      false) ||
    Boolean(currentUser?.isAdmin);

  return (
    // shrink-0: Card sets overflow-hidden, which lets flexbox shrink it to fit
    // the scroll container and clip the list instead of letting the body scroll
    <Card className="tw:p-4 tw:shrink-0" data-testid="extracted-memories-card">
      <div className="tw:mb-3">
        <Typography
          className="tw:text-gray-500 tw:uppercase"
          size="text-xs"
          weight="semibold">
          {t('label.memory-plural')}
          {!isLoading && memories.length > 0 ? ` (${memories.length})` : ''}
        </Typography>
      </div>
      {isLoading ? (
        <Box direction="col" gap={2}>
          <Skeleton height="14px" variant="rounded" width="80%" />
          <Skeleton height="14px" variant="rounded" width="60%" />
        </Box>
      ) : memories.length === 0 ? (
        <Typography className="tw:text-gray-400" size="text-sm">
          {t('label.no-entity', { entity: t('label.memory-plural') })}
        </Typography>
      ) : (
        <Box direction="col">
          {memories.map((memory) => (
            <Box
              className="tw:py-1.5 tw:-mx-2 tw:px-2 tw:rounded-md tw:cursor-pointer hover:tw:bg-gray-50"
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
                className="tw:text-gray-900"
                size="text-sm"
                weight="medium">
                {memory.title ?? getEntityName(memory)}
              </Typography>
              {memory.question && (
                <Typography
                  ellipsis
                  className="tw:text-gray-500"
                  size="text-xs">
                  {memory.question}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {memoryToView && (
        <CreateMemoryModal
          viewOnly
          canDelete={canDeleteMemory}
          currentUserName={currentUser?.name}
          isOpen={Boolean(memoryToView)}
          memoryToEdit={memoryToView}
          onClose={() => setMemoryToView(undefined)}
          onCreated={() => setMemoryToView(undefined)}
          onDeleted={handleMemoryDeleted}
          onUpdated={handleMemoryDeleted}
        />
      )}
    </Card>
  );
};

export default ExtractedMemoriesCard;
