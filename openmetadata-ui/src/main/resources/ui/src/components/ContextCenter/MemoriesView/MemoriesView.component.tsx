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
  ButtonUtility,
  Dot,
  Dropdown,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock, Copy06, Pin01, Trash01 } from '@untitledui/icons';
import classNames from 'classnames';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditNewIcon } from '../../../assets/svg/edit-new.svg';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { stripMarkdown } from '../../../utils/StringUtils';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
import {
  MemoriesViewProps,
  MemoryActionsProps,
} from './MemoriesView.interface';
import './MemoriesView.less';

const MemoryActions: FC<MemoryActionsProps> = ({ memory, onDeleteMemory }) => {
  const { t } = useTranslation();

  return (
    <Dropdown.Root>
      <Tooltip title={t('label.manage-entity', { entity: t('label.memory') })}>
        <TooltipTrigger>
          <Dropdown.DotsButton className="tw:flex tw:p-1" />
        </TooltipTrigger>
      </Tooltip>
      <Dropdown.Popover className="tw:w-36">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'delete') {
              onDeleteMemory?.(memory);
            }
          }}>
          <Dropdown.Item data-testid="delete-btn" id="delete">
            <Box align="center" gap={2}>
              <Trash01
                aria-hidden="true"
                className="tw:size-4 tw:shrink-0 tw:stroke-[2.25px] tw:text-error-primary"
              />
              <Typography
                ellipsis
                className="tw:grow tw:text-error-primary"
                size="text-sm"
                weight="medium">
                {t('label.delete')}
              </Typography>
            </Box>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

interface PinButtonProps {
  pinned: boolean;
  animKey: number;
  onClick: () => void;
}

const PinButton: FC<PinButtonProps> = ({ pinned, animKey, onClick }) => {
  const { t } = useTranslation();

  return (
    <Tooltip title={pinned ? t('label.unpin') : t('label.pin')}>
      <TooltipTrigger>
        <ButtonUtility
          className={classNames('tw:transition-colors tw:duration-150', {
            'tw:bg-utility-blue-50 tw:text-fg-brand-primary': pinned,
          })}
          color="tertiary"
          icon={
            <Pin01
              className={pinned ? 'pin-icon-pinned' : 'pin-icon-unpinned'}
              key={animKey}
              size={15}
            />
          }
          onClick={onClick}
        />
      </TooltipTrigger>
    </Tooltip>
  );
};

const SKELETON_KEYS = Array.from({ length: 8 }, (_, i) => `skeleton-${i}`);
const VISIBLE_LINKED_ENTITIES_COUNT = 4;

const MemoryRowSkeleton: FC = () => (
  <Box
    align="start"
    className="tw:px-4 tw:py-4 tw:border-b tw:border-secondary"
    gap={3}>
    <Skeleton height="32px" variant="circular" width="32px" />
    <Box className="tw:flex-1" direction="col" gap={2}>
      <Box align="center" gap={2}>
        <Skeleton height="12px" variant="rounded" width="80px" />
        <Skeleton height="12px" variant="rounded" width="48px" />
      </Box>
      <Skeleton height="14px" variant="rounded" width="70%" />
      <Skeleton height="12px" variant="rounded" width="90%" />
      <Box align="center" className="tw:mt-1" gap={2}>
        <Skeleton height="20px" variant="rounded" width="56px" />
        <Skeleton height="20px" variant="rounded" width="72px" />
      </Box>
    </Box>
  </Box>
);

interface MemoryRowProps {
  currentUserName?: string;
  isAdminUser?: boolean;
  memory: ContextMemory;
  canEdit?: boolean;
  canDelete?: boolean;
  onDeleteMemory?: (memory: ContextMemory) => void;
  onEditMemory?: (memory: ContextMemory) => void;
  onViewMemory?: (memory: ContextMemory) => void;
}

const MemoryRow: FC<MemoryRowProps> = ({
  currentUserName,
  isAdminUser,
  memory,
  canEdit,
  canDelete,
  onDeleteMemory,
  onEditMemory,
  onViewMemory,
}) => {
  const isOwner =
    memory.owners?.some((owner) => owner.name === currentUserName) ?? false;
  const canActOnMemory = isOwner || Boolean(isAdminUser);
  const { t } = useTranslation();
  const [pinned, setPinned] = useState(false);
  const [pinAnimKey, setPinAnimKey] = useState(0);
  const memoryUrl = useMemo(
    () =>
      memory.name
        ? `${window.location.origin}${
            window.location.pathname
          }?memory=${encodeURIComponent(memory.name)}`
        : window.location.href,
    [memory.name]
  );

  return (
    <Box
      align="start"
      className="tw:group tw:relative tw:px-5.5 tw:py-4.5 tw:border-b tw:border-secondary tw:last:border-b-0 tw:cursor-pointer tw:transition-colors tw:overflow-hidden"
      data-testid={`memory-row-${memory.id}`}
      gap={3}
      style={
        pinned
          ? {
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--tw-color-utility-brand-50) 80%, transparent) 0%, transparent 60%)',
            }
          : undefined
      }
      onClick={() => onViewMemory?.(memory)}>
      {pinned && (
        <Box
          align="start"
          className="tw:pointer-events-none tw:absolute tw:top-0 tw:right-0 tw:text-fg-brand-primary"
          justify="end"
          style={{
            width: 28,
            height: 28,
            background:
              'linear-gradient(225deg, color-mix(in srgb, var(--tw-color-utility-brand-100) 80%, transparent) 0%, transparent 70%)',
            borderBottomLeftRadius: 12,
            padding: '5px 7px 0 0',
          }}>
          <Pin01 size={11} strokeWidth={2.4} />
        </Box>
      )}
      {(memory.owners?.[0]?.name ?? memory.updatedBy) && (
        <div className="tw:shrink-0 tw:mt-0.5">
          <ProfilePicture name={getEntityName(memory.owners?.[0])} />
        </div>
      )}
      <Box
        align="start"
        className="tw:w-full tw:min-w-0"
        gap={2}
        justify="between">
        <Box
          className="tw:min-w-0 tw:flex-1 tw:max-w-[75%]"
          direction="col"
          gap={1}>
          <Box align="center" gap={2} wrap="wrap">
            {(memory.owners?.[0]?.displayName ??
              memory.owners?.[0]?.name ??
              memory.updatedBy) && (
              <Typography className="tw:text-secondary" size="text-sm">
                {memory.owners?.[0]?.displayName ??
                  memory.owners?.[0]?.name ??
                  memory.updatedBy}
              </Typography>
            )}
            {memory.updatedAt !== undefined && (
              <>
                <span className="tw:text-utility-gray-400 tw:leading-none tw:select-none tw:text-xs">
                  &middot;
                </span>
                <Typography className="tw:text-quaternary" size="text-xs">
                  {getShortRelativeTime(memory.updatedAt)}
                </Typography>
              </>
            )}
          </Box>

          <Typography ellipsis weight="medium">
            {memory.title || memory.name}
          </Typography>

          <Typography
            className="tw:text-tertiary tw:line-clamp-2"
            size="text-xs">
            {stripMarkdown(memory.summary ?? memory.answer ?? '')}
          </Typography>

          {memory.tags && memory.tags.length > 0 && (
            <Box align="center" className="tw:mt-0.5" gap={2} wrap="wrap">
              {memory.tags.map((tag) => (
                <Badge
                  className="tw:max-w-60 tw:min-w-0"
                  key={tag.name}
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
                    className="tw:text-secondary"
                    size="text-xs">
                    {getEntityName(tag)}
                  </Typography>
                </Badge>
              ))}
              {memory?.tags?.length > VISIBLE_LINKED_ENTITIES_COUNT && (
                <Badge size="md" type="color">
                  <Typography className="tw:text-secondary" size="text-xs">
                    +{memory.tags.length - VISIBLE_LINKED_ENTITIES_COUNT}
                  </Typography>
                </Badge>
              )}
            </Box>
          )}

          {(memory.usageCount !== undefined ||
            memory.lastUsedAt !== undefined) && (
            <Box align="center" className="tw:mt-1" gap={1}>
              <Clock
                className="tw:text-utility-gray-500"
                size={12}
                strokeWidth={1.5}
              />
              <Typography
                className="tw:text-quaternary tw:whitespace-nowrap"
                size="text-xs">
                {memory.usageCount === undefined
                  ? ''
                  : t('label.cited-n-times', { count: memory.usageCount })}
                {memory.lastUsedAt
                  ? ` · ${t('label.last')} ${getShortRelativeTime(
                      memory.lastUsedAt
                    )}`
                  : ''}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Actions — always visible */}
        <Box align="center" gap={1} onClick={(e) => e.stopPropagation()}>
          <PinButton
            animKey={pinAnimKey}
            pinned={pinned}
            onClick={() => {
              setPinned((prev) => !prev);
              setPinAnimKey((prev) => prev + 1);
            }}
          />
          <CopyLinkButton className="tw:w-7 tw:h-7" url={memoryUrl}>
            <Copy06 aria-hidden="true" size={17} strokeWidth={1.8} />
          </CopyLinkButton>
          {canActOnMemory && canEdit && onEditMemory && (
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
          {canActOnMemory && canDelete && (
            <MemoryActions memory={memory} onDeleteMemory={onDeleteMemory} />
          )}
        </Box>
      </Box>
    </Box>
  );
};

const MemoriesView: FC<MemoriesViewProps> = ({
  currentUserName,
  data,
  isAdminUser,
  isLoading,
  onDeleteMemory,
  onEditMemory,
  canEdit,
  canDelete,
  onViewMemory,
}) => {
  const { t } = useTranslation();
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
      <Box
        align="center"
        className="tw:py-12 tw:text-center"
        direction="col"
        gap={1}
        justify="center">
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('label.no-entity-available', {
            entity: t('label.memory-plural'),
          })}
        </Typography>
        <Typography className="tw:text-quaternary" size="text-sm">
          {t('message.try-a-different-filter-or-search')}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {data.map((memory) => (
        <MemoryRow
          canDelete={canDelete}
          canEdit={canEdit}
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
