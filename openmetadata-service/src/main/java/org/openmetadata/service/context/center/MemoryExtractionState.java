/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.context.center;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;

/**
 * Whether a document's memories were never extracted, so it reads "Not processed". The UI mirrors
 * these rules in {@code utils/ContextCenterMemoryExtractionPureUtils.ts}.
 */
public final class MemoryExtractionState {
  private MemoryExtractionState() {}

  /**
   * Processed with no extraction run on record. A Collate chat attachment has no content snapshot
   * and is deliberately never extracted, so it stays Processed.
   */
  public static boolean neverExtracted(ContextFile file) {
    return file.getProcessingStatus() == ProcessingStatus.Processed
        && file.getExtractionStats() == null
        && file.getHeadContentId() != null;
  }

  /** An article with a body that was never queued for extraction, since queuing sets a status. */
  public static boolean neverExtracted(Page page) {
    return page.getPageType() == PageType.ARTICLE
        && page.getProcessingStatus() == null
        && hasBody(page.getDescription());
  }

  private static boolean hasBody(String body) {
    return !nullOrEmpty(body) && !body.isBlank();
  }
}
