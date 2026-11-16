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
  EXTRACTION_UNAVAILABLE_MESSAGE_KEYS,
  MemoryExtractionAction,
} from '../../../constants/ContextCenter.constants';
import {
  ExtractionAvailability,
  Reason,
} from '../../../generated/api/context/extractionAvailability';
import {
  ContextFile,
  ProcessingStatus,
} from '../../../generated/entity/data/contextFile';
import { PageProcessingStatus } from '../../../generated/entity/data/page';
import { User } from '../../../generated/entity/teams/user';
import { EntityReference } from '../../../generated/entity/type';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import { hasEditAccess } from '../../EntityPermissionUtils';

type ExtractionState = Pick<
  KnowledgePage,
  'id' | 'neverExtracted' | 'processingError' | 'processingStatus'
>;

/**
 * Extract while the server reports the file never extracted, Retry once it failed. A file with no
 * content snapshot, such as a Collate chat attachment, has nothing the server can retry.
 */
export const getFileExtractionAction = (
  file: Pick<
    ContextFile,
    'headContentId' | 'neverExtracted' | 'processingStatus'
  >
): MemoryExtractionAction | undefined => {
  if (file.neverExtracted) {
    return MemoryExtractionAction.Extract;
  }

  return file.processingStatus === ProcessingStatus.Failed && file.headContentId
    ? MemoryExtractionAction.Retry
    : undefined;
};

/** The same for an article; an archived one is restored before anything runs on it. */
export const getArticleExtractionAction = (
  page: Pick<KnowledgePage, 'deleted' | 'neverExtracted' | 'processingStatus'>
): MemoryExtractionAction | undefined => {
  if (page.deleted) {
    return undefined;
  }
  if (page.neverExtracted) {
    return MemoryExtractionAction.Extract;
  }

  return page.processingStatus === PageProcessingStatus.Failed
    ? MemoryExtractionAction.Retry
    : undefined;
};

/**
 * An admin, or an owner of the document, owning teams' members included, as the server decides. No
 * policy grants it, and owners a read did not load deny a non-admin rather than guess.
 */
export const canRequestMemoryExtraction = (
  currentUser: User | undefined,
  owners?: EntityReference[]
): boolean =>
  currentUser !== undefined &&
  (Boolean(currentUser.isAdmin) || hasEditAccess(owners ?? [], currentUser));

/**
 * Why Extract and Retry are disabled. An unread availability disables nothing, as the server checks
 * every request; a reason newer than this UI reads as the service being unavailable.
 */
export const getExtractionUnavailableMessageKey = (
  availability?: ExtractionAvailability
): string | undefined => {
  if (availability?.available !== false) {
    return undefined;
  }

  return (
    EXTRACTION_UNAVAILABLE_MESSAGE_KEYS[
      availability.reason ?? Reason.ProviderUnavailable
    ] ?? EXTRACTION_UNAVAILABLE_MESSAGE_KEYS[Reason.ProviderUnavailable]
  );
};

/** The article with the extraction state a read of it returned, when it is the same article. */
export const withExtractionState = (
  page: KnowledgePage | undefined,
  read: ExtractionState
): KnowledgePage | undefined =>
  page?.id === read.id
    ? {
        ...page,
        neverExtracted: read.neverExtracted,
        processingError: read.processingError,
        processingStatus: read.processingStatus,
      }
    : page;
