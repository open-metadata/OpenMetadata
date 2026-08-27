/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.type.SemanticsRule;

class MigrationUtilTest {

  private SemanticsRule rule(String name, String... ignored) {
    return new SemanticsRule()
        .withName(name)
        .withIgnoredEntities(new ArrayList<>(List.of(ignored)));
  }

  private long queryCount(SemanticsRule rule) {
    return rule.getIgnoredEntities().stream().filter("query"::equals).count();
  }

  @Test
  void addsQueryToBothDomainRulesOnly() {
    SemanticsRule multiDomain = rule("Multiple Domains are not allowed", "user", "team");
    SemanticsRule dpDomain = rule("Data Product Domain Validation", "user", "team");
    SemanticsRule unrelated = rule("Tables can only have a single Glossary Term", "user");
    EntityRulesSettings settings =
        new EntityRulesSettings()
            .withEntitySemantics(new ArrayList<>(List.of(multiDomain, dpDomain, unrelated)));

    assertTrue(MigrationUtil.addQueryDomainRuleExemption(settings));

    assertTrue(multiDomain.getIgnoredEntities().contains("query"));
    assertTrue(dpDomain.getIgnoredEntities().contains("query"));
    // Unrelated rule must be left untouched.
    assertFalse(unrelated.getIgnoredEntities().contains("query"));
    // Existing exemptions preserved.
    assertTrue(multiDomain.getIgnoredEntities().contains("user"));
  }

  @Test
  void isIdempotent() {
    SemanticsRule multiDomain = rule("Multiple Domains are not allowed", "user", "team", "query");
    EntityRulesSettings settings =
        new EntityRulesSettings().withEntitySemantics(new ArrayList<>(List.of(multiDomain)));

    // Already exempt -> no change, and no duplicate entry.
    assertFalse(MigrationUtil.addQueryDomainRuleExemption(settings));
    assertEquals(1, queryCount(multiDomain));
  }

  @Test
  void handlesMissingOrNullSemantics() {
    assertFalse(MigrationUtil.addQueryDomainRuleExemption(null));
    assertFalse(MigrationUtil.addQueryDomainRuleExemption(new EntityRulesSettings()));
  }
}
