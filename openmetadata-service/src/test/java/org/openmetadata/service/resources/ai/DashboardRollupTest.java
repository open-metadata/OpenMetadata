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
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class DashboardRollupTest {

  @Test
  void topByStatusReturnsHighestImpactAssets() {
    List<DashboardRollup.RolledAsset> assets =
        List.of(
            asset("low", "Unregistered", 5),
            asset("approved", "Approved", 1000),
            asset("mid", "Unregistered", 50),
            asset("high", "Unregistered", 500),
            asset("top", "Unregistered", 1000),
            asset("fifth", "Unregistered", 100),
            asset("sixth", "Unregistered", 1),
            asset("second", "Unregistered", 700));

    List<Map<String, Object>> top = DashboardRollup.topByStatus(assets, "Unregistered");

    assertEquals(List.of("top", "second", "high", "fifth", "mid"), names(top));
    assertEquals(List.of(1000, 700, 500, 100, 50), affectedUsers(top));
  }

  private DashboardRollup.RolledAsset asset(
      String name, String registrationStatus, int affectedUsers) {
    return DashboardRollup.RolledAsset.builder()
        .entityType(Entity.AI_APPLICATION)
        .id(name)
        .name(name)
        .displayName(name)
        .fqn(name)
        .registrationStatus(registrationStatus)
        .euRisk("High")
        .affectedUsers(affectedUsers)
        .frameworkStatuses(Map.of())
        .build();
  }

  private List<Object> names(List<Map<String, Object>> assets) {
    return assets.stream().map(asset -> asset.get("name")).toList();
  }

  private List<Object> affectedUsers(List<Map<String, Object>> assets) {
    return assets.stream().map(asset -> asset.get("affectedUsers")).toList();
  }
}
