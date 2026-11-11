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

import java.util.EnumSet;
import java.util.Set;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.service.resources.context.ContextMemoryWriteAccess;

/**
 * Which value may be a person's decision in other words, so it must not ground unreviewed
 * (ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values): re-extraction
 * holds it for review, and approving a document's memories leaves it for a decision.
 */
public final class MemoryReviewHolds {
  /** Stages a review leaves a pill in once a person decided it; Draft still awaits a decision. */
  static final Set<ContextMemoryStatus> DECIDED_STAGES =
      EnumSet.of(
          ContextMemoryStatus.REJECTED,
          ContextMemoryStatus.SUPERSEDED,
          ContextMemoryStatus.INVALIDATED,
          ContextMemoryStatus.DEPRECATED,
          ContextMemoryStatus.ARCHIVED);

  private MemoryReviewHolds() {}

  /**
   * Whether a person decided {@code pill}: a review retired it, or a person corrected it (Manual).
   * Nothing records who approved an Approved pill, so approval alone is no decision here.
   */
  public static boolean isDecided(ContextMemory pill) {
    return pill.getSourceType() == ContextMemorySourceType.MANUAL
        || DECIDED_STAGES.contains(pill.getEntityStatus());
  }

  /**
   * Whether a person's decision on {@code decided} holds {@code value} for review across documents:
   * the value replaces a number of the same question, as re-extraction pairs them, or may be the
   * figure a correction replaced.
   */
  public static boolean holdsAcrossDocuments(ContextMemory decided, ContextMemory value) {
    return isDecided(decided)
        && haveConflictingNumbers(decided, value)
        && (askTheSameQuestion(decided, value) || mayBeTheReplacedFigure(decided, value));
  }

  /** As beside an edit-modal correction on re-extraction; another year is still another fact. */
  private static boolean mayBeTheReplacedFigure(ContextMemory correction, ContextMemory value) {
    return mayHaveBeenReplaced(correction, value)
        && !MemoryTextSimilarity.hasConflictingNumbers(
            correction.getQuestion(), value.getQuestion());
  }

  /** Only a value stating a number can replace one, so only such a value can be held. */
  public static boolean statesANumber(ContextMemory value) {
    return MemoryTextSimilarity.hasNumbers(factText(value));
  }

  /** A replaced number, by value, in the question or the answer: never the same fact. */
  public static boolean haveConflictingNumbers(ContextMemory a, ContextMemory b) {
    return MemoryTextSimilarity.hasConflictingNumbers(factText(a), factText(b));
  }

  /**
   * How re-extraction pairs a value with a decided pill: the same question, the whole pair clearing
   * the identity bar. A question for another year is another question.
   */
  static boolean askTheSameQuestion(ContextMemory a, ContextMemory b) {
    return sameQuestion(a, b)
        && MemoryTextSimilarity.weighted(
                a.getQuestion(), a.getAnswer(), b.getQuestion(), b.getAnswer())
            >= MemoryTextSimilarity.IDENTITY_THRESHOLD;
  }

  private static String factText(ContextMemory pill) {
    return pill.getQuestion() + " " + pill.getAnswer();
  }

  /**
   * The engine maintains the pills extraction creates, Approved or awaiting review (Unprocessed).
   * Draft awaits a review too, but is never rewritten; any other stage was a reviewer's decision.
   */
  public static boolean isEngineManaged(ContextMemory pill) {
    return ContextMemoryWriteAccess.isAutomatedSource(pill.getSourceType())
        && (pill.getEntityStatus() == ContextMemoryStatus.APPROVED
            || pill.getEntityStatus() == ContextMemoryStatus.UNPROCESSED);
  }

  /**
   * Whether {@code value} may be {@code pill} reworded while a person decided the pill or a review
   * awaits it: it clears the identity bar with no conflicting number or, beside a correction, its
   * number conflicts and its question alone clears the bar, however the rest scores.
   */
  public static boolean holds(ContextMemory pill, ContextMemory value) {
    return !isEngineManaged(pill) && (agrees(pill, value) || mayHaveBeenReplaced(pill, value));
  }

  /** One question in other words: "What's" is "What is", and "UK" is not "US". */
  public static boolean sameQuestion(ContextMemory a, ContextMemory b) {
    return MemoryTextSimilarity.sameQuestion(a.getQuestion(), b.getQuestion());
  }

  private static boolean agrees(ContextMemory pill, ContextMemory value) {
    return MemoryTextSimilarity.weighted(
                pill.getQuestion(), pill.getAnswer(), value.getQuestion(), value.getAnswer())
            >= MemoryTextSimilarity.IDENTITY_THRESHOLD
        && !MemoryTextSimilarity.hasConflictingNumbers(pill.getAnswer(), value.getAnswer());
  }

  /** The edit modal stores a correction's text as question and answer alike. */
  private static boolean mayHaveBeenReplaced(ContextMemory correction, ContextMemory value) {
    return correction.getSourceType() == ContextMemorySourceType.MANUAL
        && MemoryTextSimilarity.hasConflictingNumbers(correction.getAnswer(), value.getAnswer())
        && MemoryTextSimilarity.questionSimilarity(correction.getQuestion(), value.getQuestion())
            >= MemoryTextSimilarity.IDENTITY_THRESHOLD;
  }
}
