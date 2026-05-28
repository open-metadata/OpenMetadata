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
  ButtonUtility,
  Dot,
  Dropdown,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock, Trash01 } from '@untitledui/icons';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditNewIcon } from '../../../assets/svg/edit-new.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { stripMarkdown } from '../../../utils/StringUtils';
import {
  MemoriesViewProps,
  MemoryActionsWithOpenProps,
} from './MemoriesView.interface';

const MemoryActions: FC<MemoryActionsWithOpenProps> = ({
  canDelete,
  memory,
  onDeleteMemory,
  onOpenChange,
}) => {
  const { t } = useTranslation();

  if (!canDelete) {
    return null;
  }

  return (
    <Dropdown.Root onOpenChange={onOpenChange}>
      <Tooltip title={t('label.manage-entity', { entity: t('label.memory') })}>
        <TooltipTrigger>
          <Dropdown.DotsButton className="tw:flex tw:p-1" />
        </TooltipTrigger>
      </Tooltip>
      <Dropdown.Popover className="tw:w-30">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'delete') {
              onDeleteMemory?.(memory);
            }
          }}>
          <Dropdown.Item data-testid="delete-btn" id="delete">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Trash01
                aria-hidden="true"
                className="tw:size-4 tw:shrink-0 tw:stroke-[2.25px] tw:text-error-600"
              />
              <Typography
                ellipsis
                className="tw:grow tw:text-error-600"
                size="text-sm"
                weight="medium">
                {t('label.delete')}
              </Typography>
            </div>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const SKELETON_KEYS = Array.from({ length: 8 }, (_, i) => `skeleton-${i}`);

const MemoryRowSkeleton: FC = () => (
  <div className="tw:flex tw:items-start tw:gap-3 tw:px-4 tw:py-4 tw:border-b tw:border-secondary">
    <Skeleton height="32px" variant="circular" width="32px" />
    <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-2">
      <div className="tw:flex tw:items-center tw:gap-2">
        <Skeleton height="12px" variant="rounded" width="80px" />
        <Skeleton height="12px" variant="rounded" width="48px" />
      </div>
      <Skeleton height="14px" variant="rounded" width="70%" />
      <Skeleton height="12px" variant="rounded" width="90%" />
      <div className="tw:flex tw:items-center tw:gap-2 tw:mt-1">
        <Skeleton height="20px" variant="rounded" width="56px" />
        <Skeleton height="20px" variant="rounded" width="72px" />
      </div>
    </div>
  </div>
);

interface MemoryRowProps {
  canDelete?: boolean;
  currentUserName?: string;
  isAdminUser?: boolean;
  memory: ContextMemory;
  onDeleteMemory?: (memory: ContextMemory) => void;
  onEditMemory?: (memory: ContextMemory) => void;
  onViewMemory?: (memory: ContextMemory) => void;
}

const MemoryRow: FC<MemoryRowProps> = ({
  canDelete,
  currentUserName,
  isAdminUser,
  memory,
  onDeleteMemory,
  onEditMemory,
  onViewMemory,
}) => {
  const isOwner =
    memory.owners?.some((owner) => owner.name === currentUserName) ?? false;
  const canActOnMemory = isOwner || Boolean(isAdminUser);
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      className="tw:group tw:relative tw:flex tw:items-start tw:gap-3 tw:px-4 tw:py-4 tw:border-b tw:border-secondary tw:last:border-b-0 tw:cursor-pointer tw:hover:bg-gray-50 tw:transition-colors"
      data-testid={`memory-row-${memory.id}`}
      onClick={() => onViewMemory?.(memory)}>
      {memory.updatedBy && (
        <div className="tw:shrink-0 tw:mt-0.5">
          <ProfilePicture name={memory.updatedBy} />
        </div>
      )}
      <div className="tw:flex tw:items-end tw:justify-between tw:w-full tw:min-w-0 tw:gap-2">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:max-w-[75%] tw:flex-col tw:gap-1">
          <div className="tw:flex tw:items-center tw:gap-1.5 tw:flex-wrap">
            {memory.updatedBy && (
              <Typography className="tw:text-gray-700" size="text-sm">
                {memory.updatedBy}
              </Typography>
            )}
            {memory.updatedAt !== undefined && (
              <>
                <span className="tw:text-gray-400 tw:leading-none tw:select-none tw:text-xs">
                  &middot;
                </span>
                <Typography className="tw:text-gray-500" size="text-xs">
                  {getShortRelativeTime(memory.updatedAt)}
                </Typography>
              </>
            )}
          </div>

          <Typography ellipsis weight="medium">
            {memory.title || memory.name}
          </Typography>

          <Typography
            ellipsis
            className="tw:text-gray-600 tw:line-clamp-2"
            size="text-xs">
            {stripMarkdown(memory.summary ?? memory.answer ?? '')}
          </Typography>

          {memory.tags && memory.tags.length > 0 && (
            <div className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap tw:mt-0.5">
              {memory.tags.map((tag) => (
                <Badge
                  className="tw:max-w-90 tw:min-w-0"
                  key={String(tag.tagFQN ?? '')}
                  size="md"
                  type="color">
                  {tag.style?.color && (
                    <div className="tw:shrink-0">
                      <Dot
                        size="sm"
                        style={{ color: tag.style?.color, marginRight: '6px' }}
                      />
                    </div>
                  )}
                  <Typography
                    ellipsis
                    className="tw:text-gray-700"
                    size="text-xs">
                    {tag.tagFQN}
                  </Typography>
                </Badge>
              ))}
            </div>
          )}
        </div>
        {(memory.usageCount !== undefined ||
          memory.lastUsedAt !== undefined) && (
          <div className="tw:flex tw:items-center tw:gap-1 tw:shrink-0">
            <Clock className="tw:text-gray-500" size={12} strokeWidth={1.5} />
            <Typography
              className="tw:text-gray-500 tw:whitespace-nowrap"
              size="text-xs">
              {memory.usageCount === undefined
                ? ''
                : t('label.used-n-times', { count: memory.usageCount })}
              {memory.lastUsedAt
                ? ` · ${t('label.last')} ${getShortRelativeTime(
                    memory.lastUsedAt
                  )}`
                : ''}
            </Typography>
          </div>
        )}
      </div>

      {/* Actions — visible on hover or while menu is open */}
      <div
        className={`tw:absolute tw:top-3 tw:right-3 tw:flex tw:items-center tw:gap-1 tw:transition-opacity ${
          isMenuOpen
            ? 'tw:opacity-100'
            : 'tw:opacity-0 tw:group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}>
        {canActOnMemory && onEditMemory && (
          <Tooltip title={t('label.edit')}>
            <TooltipTrigger>
              <ButtonUtility
                color="tertiary"
                data-testid="edit-memory-btn"
                icon={<EditNewIcon height={16} width={16} />}
                size="sm"
                onClick={() => onEditMemory(memory)}
              />
            </TooltipTrigger>
          </Tooltip>
        )}
        {canActOnMemory && (
          <MemoryActions
            canDelete={canDelete}
            memory={memory}
            onDeleteMemory={onDeleteMemory}
            onOpenChange={setIsMenuOpen}
          />
        )}
      </div>
    </div>
  );
};

const MemoriesView: FC<MemoriesViewProps> = ({
  canDelete,
  currentUserName,
  data,
  isAdminUser,
  isLoading,
  onDeleteMemory,
  onEditMemory,
  onViewMemory,
}) => {
  if (isLoading) {
    return (
      <>
        {SKELETON_KEYS.map((key) => (
          <MemoryRowSkeleton key={key} />
        ))}
      </>
    );
  }

  if (data.length === 0) {
    return (
      <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:p-12">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
      </div>
    );
  }

  return (
    <>
      {data.map((memory) => (
        <MemoryRow
          canDelete={canDelete}
          currentUserName={currentUserName}
          isAdminUser={isAdminUser}
          key={memory.id}
          memory={memory}
          onDeleteMemory={onDeleteMemory}
          onEditMemory={onEditMemory}
          onViewMemory={onViewMemory}
        />
      ))}
    </>
  );
};

export default MemoriesView;
