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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.ai.AIGovernanceAssetSummary;
import org.openmetadata.service.Entity;

class DashboardRollupTest {

  @Test
  void topByStatusBreaksSameSeverityTiesByImpact() {
    List<DashboardRollup.RolledAsset> assets =
        List.of(
            asset("low", "Unregistered", "High", 5),
            asset("approved", "Approved", "High", 1000),
            asset("mid", "Unregistered", "High", 50),
            asset("high", "Unregistered", "High", 500),
            asset("top", "Unregistered", "High", 1000),
            asset("fifth", "Unregistered", "High", 100),
            asset("sixth", "Unregistered", "High", 1),
            asset("second", "Unregistered", "High", 700));

    List<AIGovernanceAssetSummary> top =
        DashboardRollup.topByStatus(assets, "Unregistered", DashboardRollup.shadowRanking());

    assertEquals(List.of("top", "second", "high", "fifth", "mid"), names(top));
    assertEquals(List.of(1000, 700, 500, 100, 50), affectedUsers(top));
  }

  @Test
  void topShadowRanksBySeverityThenRecency() {
    List<DashboardRollup.RolledAsset> assets =
        List.of(
            shadow("minimalManyUsers", "Minimal", 1000, 100L),
            shadow("unacceptableFewUsers", "Unacceptable", 1, 100L),
            shadow("highOld", "High", 0, 100L),
            shadow("highRecent", "High", 0, 200L));

    List<AIGovernanceAssetSummary> top =
        DashboardRollup.topByStatus(assets, "Unregistered", DashboardRollup.shadowRanking());

    assertEquals(
        List.of("unacceptableFewUsers", "highRecent", "highOld", "minimalManyUsers"), names(top));
  }

  @Test
  void topApprovalsRanksLongestWaitingFirstWithinSeverity() {
    List<DashboardRollup.RolledAsset> assets =
        List.of(approval("newer", "High", 200L), approval("older", "High", 100L));

    List<AIGovernanceAssetSummary> top =
        DashboardRollup.topByStatus(assets, "PendingApproval", DashboardRollup.approvalRanking());

    assertEquals(List.of("older", "newer"), names(top));
  }

  private DashboardRollup.RolledAsset asset(
      String name, String registrationStatus, String euRisk, int affectedUsers) {
    return baseAsset(name, registrationStatus, euRisk, affectedUsers).build();
  }

  private DashboardRollup.RolledAsset shadow(
      String name, String euRisk, int affectedUsers, Long detectedAt) {
    return baseAsset(name, "Unregistered", euRisk, affectedUsers).detectedAt(detectedAt).build();
  }

  private DashboardRollup.RolledAsset approval(String name, String euRisk, Long registeredAt) {
    return baseAsset(name, "PendingApproval", euRisk, 0).registeredAt(registeredAt).build();
  }

  private DashboardRollup.RolledAsset.RolledAssetBuilder baseAsset(
      String name, String registrationStatus, String euRisk, int affectedUsers) {
    return DashboardRollup.RolledAsset.builder()
        .entityType(Entity.AI_APPLICATION)
        .id(name)
        .name(name)
        .displayName(name)
        .fqn(name)
        .registrationStatus(registrationStatus)
        .euRisk(euRisk)
        .affectedUsers(affectedUsers)
        .frameworkStatuses(List.of());
  }

  private List<String> names(List<AIGovernanceAssetSummary> assets) {
    return assets.stream().map(AIGovernanceAssetSummary::getName).toList();
  }

  private List<Integer> affectedUsers(List<AIGovernanceAssetSummary> assets) {
    return assets.stream().map(AIGovernanceAssetSummary::getAffectedUsers).toList();
  }
}
