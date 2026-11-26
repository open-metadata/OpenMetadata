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
package org.openmetadata.service.governance.workflows.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.slf4j.LoggerFactory;

class ApprovalCycleHistoryTest {
  private static final UUID TERM_ID = UUID.randomUUID();
  private static final String REVIEWER = "reviewer";
  private static final String AUTHOR = "author";

  private final Map<Double, EntityInterface<?>> rows = new HashMap<>();
  private final List<Double> reads = new ArrayList<>();
  private final ApprovalCycleHistory history =
      new ApprovalCycleHistory(
          (id, version) -> {
            reads.add(version);
            return Optional.ofNullable(rows.get(version));
          });

  @Test
  void changesSince_stopsAtTheBaseAndListsTheChangesOldestFirst() {
    store(term(0.2, 0.1, description("D0", "D1")));
    GlossaryTerm inReview =
        store(term(0.3, 0.2, status(EntityStatus.APPROVED, EntityStatus.IN_REVIEW)));
    GlossaryTerm current = term(0.4, 0.3, description("D1", "D2"));

    List<ChangeDescription> changes = history.changesSince(current, 0.2);

    assertEquals(changesOf(inReview, current), changes);
    assertEquals(List.of(0.3), reads);
  }

  // A major change moves the version by 1.0, and the history list sorts 10.0 before 9.0, so the
  // walk follows each change's recorded previous version instead of counting down.
  @Test
  void changesSince_followsTheRecordedPreviousVersionPastVersionTen() {
    GlossaryTerm minor = store(term(9.9, 9.8, description("D0", "D1")));
    GlossaryTerm major = store(term(10.9, 9.9, description("D1", "D2")));
    GlossaryTerm current = term(11.0, 10.9, description("D2", "D3"));

    List<ChangeDescription> changes = history.changesSince(current, 9.8);

    assertEquals(changesOf(minor, major, current), changes);
  }

  @Test
  void changesSince_aBaseAtTheCurrentVersionListsNothing() {
    GlossaryTerm current = term(0.4, 0.3, description("D1", "D2"));

    assertTrue(history.changesSince(current, 0.4).isEmpty());
    assertTrue(reads.isEmpty());
  }

  @Test
  void changesSince_aCreateBaseListsEveryChangeAfterTheCreate() {
    store(term(0.1, 0.0, null));
    GlossaryTerm inReview =
        store(term(0.2, 0.1, status(EntityStatus.DRAFT, EntityStatus.IN_REVIEW)));
    GlossaryTerm current = term(0.3, 0.2, description("D0", "D1"));

    List<ChangeDescription> changes = history.changesSince(current, 0.0);

    assertEquals(changesOf(inReview, current), changes);
  }

  @Test
  void changesSince_pastTheCapListsTheNewestAndWarns() {
    GlossaryTerm current = chainOf(ApprovalCycleHistory.MAX_VERSIONS + 5);
    Logger logger = (Logger) LoggerFactory.getLogger(ApprovalCycleHistory.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      List<ChangeDescription> changes = history.changesSince(current, 0.0);

      assertEquals(ApprovalCycleHistory.MAX_VERSIONS, changes.size());
      assertEquals(current.getChangeDescription(), changes.getLast());
      assertTrue(appender.list.stream().anyMatch(event -> event.getLevel() == Level.WARN));
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  @Test
  void changesSince_aMissingVersionEndsTheWalkAfterIt() {
    store(term(0.2, 0.1, description("D0", "D1")));
    GlossaryTerm current = term(0.4, 0.3, description("D1", "D2"));

    assertEquals(changesOf(current), history.changesSince(current, 0.1));
  }

  @Test
  void approvedBaseline_skipsAnEditThatInheritedApprovedAndFindsTheApproval() {
    store(reviewedTerm(0.2, 0.1, REVIEWER, status(EntityStatus.IN_REVIEW, EntityStatus.APPROVED)));
    store(reviewedTerm(0.3, 0.2, AUTHOR, description("D0", "D1")));
    GlossaryTerm current =
        reviewedTerm(0.4, 0.3, AUTHOR, status(EntityStatus.APPROVED, EntityStatus.IN_REVIEW))
            .withEntityStatus(EntityStatus.IN_REVIEW);

    assertEquals(OptionalDouble.of(0.2), history.approvedBaseline(current));
  }

  @Test
  void approvedBaseline_neverReturnsTheCurrentVersion() {
    store(reviewedTerm(0.1, 0.0, AUTHOR, null).withEntityStatus(EntityStatus.DRAFT));
    GlossaryTerm current =
        reviewedTerm(0.2, 0.1, REVIEWER, status(EntityStatus.DRAFT, EntityStatus.APPROVED));

    assertEquals(OptionalDouble.empty(), history.approvedBaseline(current));
  }

  @Test
  void lastApprovalOrLatestChange_withoutAnApprovalIsWhereTheLatestChangeWasMade() {
    store(reviewedTerm(0.1, 0.0, AUTHOR, null).withEntityStatus(EntityStatus.DRAFT));
    GlossaryTerm current =
        reviewedTerm(0.3, 0.1, AUTHOR, description("D0", "D1"))
            .withEntityStatus(EntityStatus.IN_REVIEW);

    assertEquals(0.1, history.lastApprovalOrLatestChange(current));
  }

  @Test
  void previousVersion_usesTheRecordedVersionElseTheOneBefore() {
    assertEquals(
        0.9,
        ApprovalCycleHistory.previousVersion(
            1.9, new ChangeDescription().withPreviousVersion(0.9)));
    assertEquals(0.3, ApprovalCycleHistory.previousVersion(0.4, null));
    assertEquals(
        0.3,
        ApprovalCycleHistory.previousVersion(
            0.4, new ChangeDescription().withPreviousVersion(0.4)));
  }

  private GlossaryTerm store(GlossaryTerm version) {
    rows.put(version.getVersion(), version);
    return version;
  }

  private static List<ChangeDescription> changesOf(GlossaryTerm... versions) {
    return Arrays.stream(versions).map(GlossaryTerm::getChangeDescription).toList();
  }

  private GlossaryTerm chainOf(int versions) {
    GlossaryTerm newest = null;
    for (int step = 1; step <= versions; step++) {
      newest =
          store(term(step / 10.0, (step - 1) / 10.0, description("D" + (step - 1), "D" + step)));
    }
    return newest;
  }

  private static GlossaryTerm term(double version, double previous, ChangeDescription change) {
    return new GlossaryTerm()
        .withId(TERM_ID)
        .withName("term")
        .withFullyQualifiedName("glossary.term")
        .withVersion(version)
        .withEntityStatus(EntityStatus.APPROVED)
        .withChangeDescription(change == null ? null : change.withPreviousVersion(previous));
  }

  private static GlossaryTerm reviewedTerm(
      double version, double previous, String updatedBy, ChangeDescription change) {
    return term(version, previous, change)
        .withUpdatedBy(updatedBy)
        .withReviewers(
            List.of(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(Entity.USER)
                    .withName(REVIEWER)));
  }

  private static ChangeDescription description(String oldValue, String newValue) {
    return new ChangeDescription()
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_DESCRIPTION)
                    .withOldValue(oldValue)
                    .withNewValue(newValue)));
  }

  private static ChangeDescription status(EntityStatus oldStatus, EntityStatus newStatus) {
    return new ChangeDescription()
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName(Entity.FIELD_ENTITY_STATUS)
                    .withOldValue(oldStatus.value())
                    .withNewValue(newStatus.value())));
  }
}
