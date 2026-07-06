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
  FileIcon,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import { FOLDER_CARD_CHILDREN_LIMIT } from '../../../constants/ContextCenter.constants';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { listContextFiles } from '../../../rest/assetAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ContextSimplePillarCard from '../ContextSimplePillarCard/ContextSimplePillarCard.component';
import { DashboardFoldersCardProps } from './DashboardFoldersCard.interface';

const DashboardFoldersCard: FC<DashboardFoldersCardProps> = ({
  folders,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [folderChildren, setFolderChildren] = useState<
    Map<string, ContextFile[]>
  >(new Map());

  const fetchFolderChildrenIfNeeded = useCallback(
    async (folderId: string) => {
      if (folderChildren.has(folderId)) {
        return;
      }
      try {
        const response = await listContextFiles({
          folderId,
          limit: FOLDER_CARD_CHILDREN_LIMIT,
        });
        setFolderChildren((prev) =>
          new Map(prev).set(folderId, response.data)
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [folderChildren]
  );

  useEffect(() => {
    setFolderChildren(new Map());
    setExpandedKeys(new Set());
  }, [folders]);

  const handleExpandedChange = (keys: Set<string | number>) => {
    const next = new Set(Array.from(keys).map(String));
    const added = Array.from(next).find((k) => !expandedKeys.has(k));
    setExpandedKeys(next);
    if (added) {
      fetchFolderChildrenIfNeeded(added);
    }
  };

  return (
    <ContextSimplePillarCard
      dataTestId="dashboard-folders-card"
      emptyMessage={t('label.no-entity', { entity: t('label.folder-plural') })}
      isEmpty={folders.length === 0}
      isLoading={isLoading}
      title={t('label.folder-plural')}>
      <Tree
        aria-label={t('label.folder-plural')}
        className="tw:w-full"
        expandedKeys={expandedKeys}
        onExpandedChange={handleExpandedChange}>
        {folders.map((folder) => {
          const hasChildItems = (folder.childrenCount ?? 0) > 0;
          const children = folderChildren.get(folder.id) ?? [];

          return (
            <Tree.Item
              id={folder.id}
              key={folder.id}
              textValue={getEntityName(folder)}>
              <Tree.ItemContent
                hasChildItems={hasChildItems}
                showExpandIcon={false}>
                <div className="tw:flex tw:flex-1 tw:items-center tw:gap-2 tw:min-w-0">
                  <FolderIcon
                    className="tw:size-4 tw:shrink-0 tw:text-quaternary"
                    height={16}
                    width={16}
                  />
                  <Typography
                    ellipsis
                    className="tw:flex-1 tw:min-w-0 tw:text-secondary"
                    size="text-sm"
                    weight="medium">
                    {getEntityName(folder)}
                  </Typography>
                  <Badge size="sm" type="color">
                    {folder.childrenCount ?? 0}
                  </Badge>
                  <Tree.ExpandButton
                    className={classNames(
                      !hasChildItems && 'tw:invisible tw:pointer-events-none'
                    )}
                  />
                </div>
              </Tree.ItemContent>

              {children.map((file) => (
                <Tree.Item
                  id={file.id}
                  key={file.id}
                  textValue={getEntityName(file)}>
                  <Tree.ItemContent
                    className="tw:ml-7!"
                    showExpandIcon={false}>
                    <FileIcon
                      className="tw:size-4 tw:shrink-0"
                      theme="light"
                      type={file.fileExtension ?? ''}
                      variant="default"
                    />
                    <Typography
                      ellipsis
                      className="tw:truncate tw:text-secondary"
                      size="text-sm">
                      {getEntityName(file)}
                    </Typography>
                  </Tree.ItemContent>
                </Tree.Item>
              ))}
            </Tree.Item>
          );
        })}
      </Tree>
    </ContextSimplePillarCard>
  );
};

export default DashboardFoldersCard;
