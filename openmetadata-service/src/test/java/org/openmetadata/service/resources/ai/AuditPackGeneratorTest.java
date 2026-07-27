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
package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.type.EntityReference;

class AuditPackGeneratorTest {

  private static final long NOW = 1_000_000_000L;
  private static final long STALE_MILLIS = 15 * 60 * 1000L;

  @Test
  void isInterrupted_queuedIsAlwaysInterrupted() {
    assertTrue(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Queued, null), NOW));
  }

  @Test
  void isInterrupted_runningIsStaleOnlyPastThreshold() {
    assertFalse(
        AuditPackGenerator.isInterrupted(report(AuditReportStatus.Running, NOW - 60_000L), NOW));
    assertTrue(
        AuditPackGenerator.isInterrupted(
            report(AuditReportStatus.Running, NOW - STALE_MILLIS - 1), NOW));
    assertTrue(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Running, null), NOW));
  }

  @Test
  void isInterrupted_terminalStatesAreNeverInterrupted() {
    assertFalse(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Completed, NOW), NOW));
    assertFalse(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Failed, NOW), NOW));
    assertFalse(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Cancelled, NOW), NOW));
  }

  @Test
  void signatureOf_matchesForSameRequestAndDiffersOtherwise() {
    UUID domainId = UUID.randomUUID();
    assertEquals(
        AuditPackGenerator.signatureOf(domainReport(domainId)),
        AuditPackGenerator.signatureOf(domainReport(domainId)));

    assertNotEquals(
        AuditPackGenerator.signatureOf(domainReport(domainId)),
        AuditPackGenerator.signatureOf(domainReport(UUID.randomUUID())));
  }

  @Test
  void signatureOf_differsByRequester() {
    UUID domainId = UUID.randomUUID();
    AuditReport first = domainReport(domainId).withUpdatedBy("alice");
    AuditReport second = domainReport(domainId).withUpdatedBy("bob");

    assertNotEquals(AuditPackGenerator.signatureOf(first), AuditPackGenerator.signatureOf(second));
  }

  @Test
  void stampRequestSignature_isDeterministicAndRequestSpecific() {
    UUID domainId = UUID.randomUUID();
    AuditReport first = domainReport(domainId).withUpdatedBy("alice");
    AuditReport second = domainReport(domainId).withUpdatedBy("alice");
    AuditPackGenerator.stampRequestSignature(first);
    AuditPackGenerator.stampRequestSignature(second);
    assertNotNull(first.getRequestSignature());
    assertEquals(first.getRequestSignature(), second.getRequestSignature());

    AuditReport different = domainReport(UUID.randomUUID());
    AuditPackGenerator.stampRequestSignature(different);
    assertNotEquals(first.getRequestSignature(), different.getRequestSignature());

    AuditReport differentRequester = domainReport(domainId).withUpdatedBy("bob");
    AuditPackGenerator.stampRequestSignature(differentRequester);
    assertNotEquals(first.getRequestSignature(), differentRequester.getRequestSignature());
  }

  private AuditReport report(AuditReportStatus status, Long startedAt) {
    return new AuditReport().withStatus(status).withStartedAt(startedAt);
  }

  private AuditReport domainReport(UUID domainId) {
    return new AuditReport()
        .withScope(AuditReportScope.Domain)
        .withScopeTarget(new EntityReference().withId(domainId))
        .withFormat(AuditReportFormat.Json)
        .withAsOfDate(500L)
        .withIncludeRedacted(false);
  }
}
