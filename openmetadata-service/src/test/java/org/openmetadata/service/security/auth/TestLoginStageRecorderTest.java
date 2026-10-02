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
package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageResult;
import org.openmetadata.schema.system.TestLoginStageStatus;

class TestLoginStageRecorderTest {

  @Test
  void reportsInapplicableStagesAsSkippedAndUnreachedStagesAsPending() {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(TestLoginProtocol.LDAP);
    recorder.pass(TestLoginStage.STARTED);

    Map<TestLoginStage, TestLoginStageStatus> statuses = statusesOf(recorder);

    assertEquals(TestLoginStageStatus.PASSED, statuses.get(TestLoginStage.STARTED));
    assertEquals(TestLoginStageStatus.SKIPPED, statuses.get(TestLoginStage.REDIRECTED));
    assertEquals(TestLoginStageStatus.SKIPPED, statuses.get(TestLoginStage.TOKEN_RECEIVED));
    assertEquals(TestLoginStageStatus.SKIPPED, statuses.get(TestLoginStage.TOKEN_VALIDATED));
    assertEquals(TestLoginStageStatus.PENDING, statuses.get(TestLoginStage.CREDENTIALS_VERIFIED));
    assertEquals(TestLoginStageStatus.PENDING, statuses.get(TestLoginStage.DOMAIN_CHECKED));
  }

  @Test
  void skipsTheCredentialStageForBrowserRedirectProtocols() {
    for (TestLoginProtocol protocol : List.of(TestLoginProtocol.OIDC, TestLoginProtocol.SAML)) {
      Map<TestLoginStage, TestLoginStageStatus> statuses =
          statusesOf(TestLoginStageRecorder.forProtocol(protocol));

      assertEquals(
          TestLoginStageStatus.SKIPPED,
          statuses.get(TestLoginStage.CREDENTIALS_VERIFIED),
          protocol.value());
      assertEquals(
          TestLoginStageStatus.PENDING,
          statuses.get(TestLoginStage.TOKEN_VALIDATED),
          protocol.value());
    }
  }

  @Test
  void listsEveryStageExactlyOnceInDeclarationOrder() {
    List<TestLoginStage> order =
        TestLoginStageRecorder.forProtocol(TestLoginProtocol.OIDC).toStageResults().stream()
            .map(TestLoginStageResult::getStage)
            .toList();

    assertEquals(List.of(TestLoginStage.values()), order);
  }

  @Test
  void furthestReachedIsTheLastRecordedStageEvenWhenItFailed() {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(TestLoginProtocol.OIDC);
    assertEquals(TestLoginStage.STARTED, recorder.furthestReached());

    recorder.pass(TestLoginStage.STARTED);
    recorder.fail(TestLoginStage.TOKEN_VALIDATED, "Signature does not match");

    assertEquals(TestLoginStage.TOKEN_VALIDATED, recorder.furthestReached());
  }

  @Test
  void failureMessagesAndHasFailureAgreeWithTheTimeline() {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(TestLoginProtocol.OIDC);
    recorder.pass(TestLoginStage.IDENTITY_RESOLVED, "alice@example.com");

    assertFalse(recorder.hasFailure());
    assertTrue(recorder.failureMessages().isEmpty());

    recorder.fail(TestLoginStage.DOMAIN_CHECKED, "Domain 'partner.io' is not allowed");

    assertTrue(recorder.hasFailure());
    assertEquals(List.of("Domain 'partner.io' is not allowed"), recorder.failureMessages());
  }

  private static Map<TestLoginStage, TestLoginStageStatus> statusesOf(
      TestLoginStageRecorder recorder) {
    return recorder.toStageResults().stream()
        .collect(Collectors.toMap(TestLoginStageResult::getStage, TestLoginStageResult::getStatus));
  }
}
