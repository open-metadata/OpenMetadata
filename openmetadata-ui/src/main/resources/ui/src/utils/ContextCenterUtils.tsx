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

import { File06 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { ReactComponent as DOCIcon } from '../assets/svg/ic-doc.svg';
import { ReactComponent as ImageIcon } from '../assets/svg/ic-image.svg';
import { ReactComponent as PDFIcon } from '../assets/svg/ic-pdf.svg';
import { ReactComponent as XLSIcon } from '../assets/svg/ic-xls.svg';
import { ArticleCardItem } from '../components/ContextCenter/ArticleCard/ArticleCard.interface';
import { UploadedDocumentItem } from '../components/ContextCenter/UploadedDocumentCard/UploadedDocumentCard.interface';
import { CREATE_PAGE_HASH, ROUTES } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { Asset, AssetType } from '../generated/attachments/asset';
import {
  CreateKnowledgePage,
  PageType,
} from '../interface/knowledge-center.interface';
import { listAssetsByFqn } from '../rest/assetAPI';
import { postKnowledgePage } from '../rest/knowledgeCenterAPI';
import EntityLink from './EntityLink';
import { getContextCenterArticlePath } from './KnowledgePageUtils';
import { showErrorToast } from './ToastUtils';

export const CONTEXT_CENTER_DOCUMENTS_FQN = 'contextCenter.documents';

export const CONTEXT_CENTER_DOCUMENTS_ENTITY_LINK = EntityLink.getEntityLink(
  EntityType.KNOWLEDGE_PAGE,
  CONTEXT_CENTER_DOCUMENTS_FQN
);

export const extensionToFileType = (
  fileName: string
): UploadedDocumentItem['fileType'] => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (['doc', 'docx'].includes(ext)) {
    return 'doc';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return 'xls';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return 'image';
  }

  return 'other';
};

export const getFileTypeIcon = (fileType: string) => {
  const commonProps = {
    width: 32,
    height: 32,
  };
  switch (fileType) {
    case 'doc':
      return <DOCIcon {...commonProps} />;
    case 'pdf':
      return <PDFIcon {...commonProps} />;
    case 'xls':
      return <XLSIcon {...commonProps} />;
    case 'image':
      return <ImageIcon {...commonProps} />;
    default:
      return <File06 {...commonProps} className="tw:text-gray-500" />;
  }
};

export const formatBytes = (bytes?: number): string => {
  if (!bytes) {
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

export const assetToDocumentItem = (asset: Asset): UploadedDocumentItem => ({
  fileType: extensionToFileType(asset.fileName),
  id: asset.id,
  name: asset.fileName,
  sizeLabel: formatBytes(asset.size),
  status: 'processed',
});

export const knowledgePageToArticleItem = (
  page: {
    id: string;
    displayName?: string;
    description?: string;
    updatedAt: number;
    tags?: { tagFQN: string }[];
    fullyQualifiedName?: string;
  },
  untitledLabel: string
): ArticleCardItem => ({
  description: page.description ?? '',
  href: page.fullyQualifiedName
    ? `${ROUTES.CONTEXT_CENTER_ARTICLES}/${page.fullyQualifiedName}`
    : undefined,
  id: page.id,
  lastEditedAt: page.updatedAt,
  tags: (page.tags ?? []).map((tag) => ({
    label: tag.tagFQN.split('.').pop() ?? tag.tagFQN,
  })),
  title: page.displayName || untitledLabel,
});

export const fetchContextCenterDocuments = async (): Promise<Asset[]> => {
  return listAssetsByFqn(CONTEXT_CENTER_DOCUMENTS_FQN, AssetType.External);
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
      pathname: getContextCenterArticlePath(response.fullyQualifiedName),
    });
  } catch (error) {
    showErrorToast(error as AxiosError);
  }
};
