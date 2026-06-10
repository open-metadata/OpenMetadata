/*
 *  Copyright 2025 Collate.
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

import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { isNull, isUndefined } from 'lodash';
import type { ArticleCardItem } from '../components/ContextCenter/ArticleCard/ArticleCard.interface';
import type { DocFile } from '../components/ContextCenter/DocumentsView/DocumentsView.interface';
import type { UploadedDocumentItem } from '../components/ContextCenter/UploadedDocumentCard/UploadedDocumentCard.interface';
import { CREATE_PAGE_HASH } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import type { Asset } from '../generated/attachments/asset';
import { AssetType } from '../generated/attachments/asset';
import type { ContextFile } from '../generated/entity/data/contextFile';
import type {
  CreateKnowledgePage,
  QuickLink,
} from '../interface/knowledge-center.interface';
import { PageType } from '../interface/knowledge-center.interface';
import {
  downloadDriveFile,
  listAssetsByFqn,
  type ListAssetsByFqnParams,
} from '../rest/assetAPI';
import { postKnowledgePage } from '../rest/knowledgeCenterAPI';
import contextCenterClassBase from './ContextCenterClassBase';
import EntityLink from './EntityLink';
import { getEntityName } from './EntityNameUtils';
import { showErrorToast } from './ToastUtils';

export const CONTEXT_CENTER_DOCUMENTS_FQN = 'contextCenter.documents';

export const CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK = EntityLink.getEntityLink(
  EntityType.KNOWLEDGE_PAGE,
  CONTEXT_CENTER_DOCUMENTS_FQN
);

export const formatBytes = (bytes?: number): string => {
  if (isUndefined(bytes) || isNull(bytes)) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const assetToDocumentItem = (
  asset: ContextFile
): UploadedDocumentItem => ({
  fileExtension: asset.fileExtension ?? '',
  id: asset.id,
  name: getEntityName(asset) ?? '',
  sizeLabel: formatBytes(asset.fileSize),
  status: asset.processingStatus,
  updatedBy: asset.updatedBy ?? '',
  updatedAt: asset.updatedAt ?? 0,
});

export const contextFileToDocumentItem = (file: ContextFile): DocFile => ({
  driveFileId: file.id,
  folderId: file.folder?.id,
  folderFqn: file.folder?.fullyQualifiedName,
  id: file.assetId ?? file.id,
  name: file.displayName ?? file.name,
  sizeLabel: formatBytes(file.fileSize),
  status: file.processingStatus,
  fileExtension: file.fileExtension ?? '',
  updatedAt: file.updatedAt,
  updatedBy: file.updatedBy,
});

export const contextFileToUploadedDocumentItem = (
  file: ContextFile
): UploadedDocumentItem => ({
  driveFileId: file.id,
  id: file.assetId ?? file.id,
  name: file.displayName ?? file.name,
  sizeLabel: formatBytes(file.fileSize),
  status: file.processingStatus,
  updatedAt: file.updatedAt ?? 0,
  updatedBy: file.updatedBy ?? '',
  fileExtension: file.fileExtension ?? '',
});

export const knowledgePageToArticleItem = (
  data: {
    id: string;
    displayName?: string;
    description?: string;
    updatedAt: number;
    tags?: { tagFQN: string }[];
    fullyQualifiedName?: string;
    pageType?: PageType;
    page?: QuickLink | unknown;
  },
  untitledLabel: string
): ArticleCardItem => ({
  description: data.description ?? '',
  href:
    data.pageType === PageType.QUICK_LINK
      ? (data.page as QuickLink)?.url
      : data.fullyQualifiedName
      ? contextCenterClassBase.getArticlePath(data.fullyQualifiedName)
      : undefined,
  id: data.id,
  lastEditedAt: data.updatedAt,
  tags: (data.tags ?? []).map((tag) => ({
    label: tag.tagFQN.split('.').pop() ?? tag.tagFQN,
  })),
  title: getEntityName(data) || untitledLabel,
});

export const fetchContextCenterDocuments = async (
  params?: ListAssetsByFqnParams
): Promise<Asset[]> => {
  return listAssetsByFqn(
    CONTEXT_CENTER_DOCUMENTS_FQN,
    AssetType.External,
    params
  );
};

export const createArticleKnowledgePage = async (
  userId: string,
  navigate: (to: { hash: string; pathname: string }) => void,
  onResourceLimit?: () => void
): Promise<void> => {
  try {
    const data: CreateKnowledgePage = {
      description: '',
      displayName: '',
      name: `${PageType.ARTICLE}_${cryptoRandomString({
        length: 8,
        type: 'alphanumeric',
      })}`,
      owners: [{ id: userId, type: 'user' }],
      page: { publicationDate: new Date(), relatedArticles: [] },
      pageType: PageType.ARTICLE,
    };
    const response = await postKnowledgePage(data);
    onResourceLimit?.();
    navigate({
      hash: CREATE_PAGE_HASH,
      pathname: contextCenterClassBase.getArticlePath(
        response.fullyQualifiedName
      ),
    });
  } catch (error) {
    showErrorToast(error as AxiosError);
  }
};

export const handleAssetDownload = async (file: DocFile) => {
  let url: string | undefined;
  let element: HTMLAnchorElement | undefined;

  try {
    const blob = await downloadDriveFile(file.driveFileId ?? file.id);
    url = URL.createObjectURL(blob);
    element = document.createElement('a');
    element.href = url;
    element.download = file.name;
    document.body.appendChild(element);
    element.click();
  } catch (err) {
    showErrorToast(err as AxiosError);
  } finally {
    element?.remove();

    if (url) {
      URL.revokeObjectURL(url);
    }
  }
};
