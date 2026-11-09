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
import { isNil } from 'lodash';
import {
  ContextFile,
  ProcessingStatus,
} from '../generated/entity/data/contextFile';
import {
  KnowledgePage,
  PageType,
} from '../interface/knowledge-center.interface';

/**
 * Mirrors the server's MemoryExtractionState: Processed with no extraction run on record. A Collate
 * chat attachment has no content snapshot and is deliberately never extracted, so it stays Processed.
 */
export const isFileNeverExtracted = (
  file: Pick<
    ContextFile,
    'extractionStats' | 'headContentId' | 'processingStatus'
  >
): boolean =>
  file.processingStatus === ProcessingStatus.Processed &&
  isNil(file.extractionStats) &&
  !isNil(file.headContentId);

/** Mirrors the server's MemoryExtractionState: an article with a body never queued for extraction. */
export const isArticleNeverExtracted = (
  page: Pick<KnowledgePage, 'description' | 'pageType' | 'processingStatus'>
): boolean =>
  page.pageType === PageType.ARTICLE &&
  isNil(page.processingStatus) &&
  Boolean(page.description?.trim());
