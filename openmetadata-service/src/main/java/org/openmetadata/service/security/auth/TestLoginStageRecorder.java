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

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageResult;
import org.openmetadata.schema.system.TestLoginStageStatus;

/**
 * Records the outcome of each stage of a Test Login round-trip so the UI can render a progress
 * timeline instead of a single spinner.
 *
 * <p>Every protocol renders the same ordered stage list. Stages that do not apply to the protocol
 * under test are reported as {@link TestLoginStageStatus#SKIPPED}; applicable stages that were never
 * reached (because an earlier stage failed) stay {@link TestLoginStageStatus#PENDING}.
 */
public final class TestLoginStageRecorder {
  private static final Set<TestLoginStage> BROWSER_REDIRECT_STAGES =
      EnumSet.of(
          TestLoginStage.REDIRECTED, TestLoginStage.TOKEN_RECEIVED, TestLoginStage.TOKEN_VALIDATED);

  private final Set<TestLoginStage> applicableStages;
  private final Map<TestLoginStage, TestLoginStageResult> outcomes =
      new EnumMap<>(TestLoginStage.class);

  private TestLoginStageRecorder(Set<TestLoginStage> applicableStages) {
    this.applicableStages = applicableStages;
  }

  public static TestLoginStageRecorder forProtocol(TestLoginProtocol protocol) {
    return new TestLoginStageRecorder(applicableStagesFor(protocol));
  }

  private static Set<TestLoginStage> applicableStagesFor(TestLoginProtocol protocol) {
    Set<TestLoginStage> stages = EnumSet.allOf(TestLoginStage.class);
    if (isCredentialBased(protocol)) {
      stages.removeAll(BROWSER_REDIRECT_STAGES);
    } else {
      stages.remove(TestLoginStage.CREDENTIALS_VERIFIED);
    }
    return stages;
  }

  static boolean isCredentialBased(TestLoginProtocol protocol) {
    return protocol == TestLoginProtocol.LDAP || protocol == TestLoginProtocol.BASIC;
  }

  public void pass(TestLoginStage stage) {
    record(stage, TestLoginStageStatus.PASSED, null);
  }

  public void pass(TestLoginStage stage, String message) {
    record(stage, TestLoginStageStatus.PASSED, message);
  }

  public void fail(TestLoginStage stage, String message) {
    record(stage, TestLoginStageStatus.FAILED, message);
  }

  /** Marks the stage the round-trip is waiting on, e.g. the admin signing in at the provider. */
  public void running(TestLoginStage stage) {
    record(stage, TestLoginStageStatus.RUNNING, null);
  }

  private void record(TestLoginStage stage, TestLoginStageStatus status, String message) {
    outcomes.put(
        stage, new TestLoginStageResult().withStage(stage).withStatus(status).withMessage(message));
  }

  /** The furthest applicable stage that was actually recorded, or STARTED if none was. */
  public TestLoginStage furthestReached() {
    TestLoginStage furthest = TestLoginStage.STARTED;
    for (TestLoginStage stage : TestLoginStage.values()) {
      if (outcomes.containsKey(stage)) {
        furthest = stage;
      }
    }
    return furthest;
  }

  /** Messages of every stage that failed, so the result's errors and timeline cannot disagree. */
  public List<String> failureMessages() {
    List<String> messages = new ArrayList<>();
    for (TestLoginStageResult outcome : outcomes.values()) {
      if (outcome.getStatus() == TestLoginStageStatus.FAILED && outcome.getMessage() != null) {
        messages.add(outcome.getMessage());
      }
    }
    return List.copyOf(messages);
  }

  public boolean hasFailure() {
    return outcomes.values().stream()
        .anyMatch(outcome -> outcome.getStatus() == TestLoginStageStatus.FAILED);
  }

  /** The full timeline in stage order, with unreached and inapplicable stages filled in. */
  public List<TestLoginStageResult> toStageResults() {
    List<TestLoginStageResult> results = new ArrayList<>();
    for (TestLoginStage stage : TestLoginStage.values()) {
      results.add(outcomes.containsKey(stage) ? outcomes.get(stage) : placeholderFor(stage));
    }
    return List.copyOf(results);
  }

  private TestLoginStageResult placeholderFor(TestLoginStage stage) {
    TestLoginStageStatus status =
        applicableStages.contains(stage)
            ? TestLoginStageStatus.PENDING
            : TestLoginStageStatus.SKIPPED;
    return new TestLoginStageResult().withStage(stage).withStatus(status);
  }
}
