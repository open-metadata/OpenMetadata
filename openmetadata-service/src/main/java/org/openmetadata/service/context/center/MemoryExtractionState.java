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
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.ProcessingStatus;

/**
 * Whether a document's current content was never extracted, so it reads "Not processed". Files and
 * pages serve it as their {@value #NEVER_EXTRACTED} field, computed on read and never stored.
 */
public final class MemoryExtractionState {
  public static final String NEVER_EXTRACTED = "neverExtracted";

  private MemoryExtractionState() {}

  /**
   * Processed with text and no extraction run on record. A file's snapshot is fixed at upload, so
   * stats always describe its current content. A Collate chat attachment has no snapshot.
   */
  public static boolean neverExtracted(ContextFile file) {
    return file.getProcessingStatus() == ProcessingStatus.Processed
        && file.getExtractionStats() == null
        && file.getHeadContentId() != null
        && hasText(file.getExtractedText());
  }

  /**
   * An article whose body no run has read: never queued, or edited while extraction was off, which
   * keeps the earlier run's status and stats. A run waiting, in flight or failed keeps its status.
   */
  public static boolean neverExtracted(Page page) {
    return page.getPageType() == PageType.ARTICLE
        && hasText(page.getDescription())
        && isSettled(page.getProcessingStatus())
        && !wasExtractedFrom(page.getExtractionStats(), page.getDescription());
  }

  private static boolean isSettled(PageProcessingStatus status) {
    return status == null || status == PageProcessingStatus.Processed;
  }

  /** The same comparison the engine makes before it skips an unchanged body. */
  private static boolean wasExtractedFrom(ExtractionStats stats, String body) {
    return stats != null
        && PageContextProcessingEngine.sourceHash(body).equals(stats.getSourceHash());
  }

  static boolean hasText(String text) {
    return !nullOrEmpty(text) && !text.isBlank();
  }
}
