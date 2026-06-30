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
  ButtonUtility,
  Card,
  Dot,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { File06, RefreshCcw01, Trash01 } from '@untitledui/icons';
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { ArchiveItem, ArchiveViewProps } from './ArchiveView.interface';

const ArchiveRowSkeleton: FC = () => (
  <div className="tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3 tw:border-b tw:border-secondary tw:last:border-0">
    <Skeleton
      className="tw:shrink-0"
      height="32px"
      variant="rounded"
      width="32px"
    />
    <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2">
      <Skeleton height="14px" variant="rounded" width="35%" />
      <Skeleton height="12px" variant="rounded" width="55%" />
    </div>
    <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
      <Skeleton height="32px" variant="rounded" width="80px" />
      <Skeleton height="32px" variant="rounded" width="72px" />
    </div>
  </div>
);

interface ArchiveRowProps {
  item: ArchiveItem;
  canRestore?: boolean;
  canDelete?: boolean;
  onRestore: (item: ArchiveItem) => void;
  onDelete: (item: ArchiveItem) => void;
}

const ArchiveRow: FC<ArchiveRowProps> = ({
  item,
  canRestore,
  canDelete,
  onDelete,
  onRestore,
}) => {
  const { t } = useTranslation();

  const Icon = item.type === 'article' ? File06 : FolderIcon;

  return (
    <Box
      align="center"
      className="tw:px-4 tw:py-3 tw:border-b tw:border-secondary tw:last:border-0"
      data-testid={`archive-row-${item.id}`}
      gap={4}>
      <Box
        align="center"
        className={classNames(
          'tw:h-8 tw:w-8 tw:shrink-0 tw:rounded-lg',
          item.type === 'article'
            ? 'tw:bg-utility-brand-50'
            : 'tw:bg-utility-purple-50'
        )}
        justify="center">
        <Icon
          className={classNames(
            'tw:size-4',
            item.type === 'article'
              ? 'tw:text-utility-brand-700'
              : 'tw:text-utility-purple-500'
          )}
        />
      </Box>

      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Typography ellipsis size="text-sm" weight="medium">
          {item.name}
        </Typography>
        <Box align="center" gap={2}>
          {item.updatedBy && (
            <Typography className="tw:text-quaternary" size="text-xs">
              {t('label.archived-by', { name: item.updatedBy })}
            </Typography>
          )}
          {item.updatedAt && (
            <>
              <Dot className="tw:text-quaternary" size="micro" />
              <Typography className="tw:text-quaternary" size="text-xs">
                {getShortRelativeTime(item.updatedAt)}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      <div className="tw:flex tw:items-center tw:gap-2 tw:shrink-0">
        {canRestore && (
          <ButtonUtility
            color="tertiary"
            data-testid="restore-btn"
            icon={<RefreshCcw01 size={20} />}
            size="sm"
            tooltip={t('label.restore')}
            onClick={() => onRestore(item)}
          />
        )}
        {canDelete && (
          <ButtonUtility
            color="tertiary"
            data-testid="delete-btn"
            icon={<Trash01 size={20} />}
            size="sm"
            tooltip={t('label.delete')}
            onClick={() => onDelete(item)}
          />
        )}
      </div>
    </Box>
  );
};

const ArchiveView: FC<ArchiveViewProps> = ({
  data,
  isLoading,
  canRestore,
  canDelete,
  onDelete,
  onRestore,
}) => {
  if (isLoading) {
    return (
      <Card className="tw:flex tw:flex-col">
        {Array.from({ length: 8 }).map((_, idx) => (
          <ArchiveRowSkeleton key={idx} />
        ))}
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:p-12">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
      </Card>
    );
  }

  return (
    <div data-testid="archive-view">
      {data.map((item) => (
        <ArchiveRow
          canDelete={canDelete}
          canRestore={canRestore}
          item={item}
          key={item.id}
          onDelete={onDelete}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
};

export default ArchiveView;
