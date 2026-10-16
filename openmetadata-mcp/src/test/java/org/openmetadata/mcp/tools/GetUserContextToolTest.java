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
package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;

class GetUserContextToolTest {

  @Test
  void ownedFilterParsesCaseInsensitivelyAndDefaultsToNone() {
    assertEquals(
        GetUserContextTool.OwnedFilter.ANY_GAP,
        GetUserContextTool.OwnedFilter.fromValue("any_gap"));
    assertEquals(
        GetUserContextTool.OwnedFilter.MISSING_TIER,
        GetUserContextTool.OwnedFilter.fromValue("  Missing_Tier "));
    assertEquals(
        GetUserContextTool.OwnedFilter.NONE, GetUserContextTool.OwnedFilter.fromValue(null));
    assertEquals(
        GetUserContextTool.OwnedFilter.NONE,
        GetUserContextTool.OwnedFilter.fromValue("not_a_filter"));
  }

  @Test
  void identityProjectsScalarFieldsAndFlags() {
    UUID id = UUID.randomUUID();
    User user =
        new User()
            .withId(id)
            .withName("jdoe")
            .withDisplayName("Jane Doe")
            .withEmail("jane@example.com")
            .withIsAdmin(true);

    Map<String, Object> identity = GetUserContextTool.identity(user);

    assertEquals(id.toString(), identity.get("id"));
    assertEquals("jdoe", identity.get("name"));
    assertEquals("Jane Doe", identity.get("displayName"));
    assertEquals("jane@example.com", identity.get("email"));
    assertEquals(Boolean.TRUE, identity.get("isAdmin"));
    assertEquals(Boolean.FALSE, identity.get("isBot"));
  }

  @Test
  void identityOmitsNullOptionalFields() {
    Map<String, Object> identity =
        GetUserContextTool.identity(new User().withId(UUID.randomUUID()).withName("bot"));

    assertFalse(identity.containsKey("displayName"));
    assertFalse(identity.containsKey("email"));
    assertEquals(Boolean.FALSE, identity.get("isAdmin"));
  }

  @Test
  void namedRefsMapIdNameDisplayName() {
    UUID id = UUID.randomUUID();
    EntityReference ref =
        new EntityReference().withId(id).withName("Data Team").withDisplayName("Data");

    List<Map<String, Object>> refs = GetUserContextTool.namedRefs(List.of(ref));

    assertEquals(1, refs.size());
    assertEquals(id.toString(), refs.getFirst().get("id"));
    assertEquals("Data Team", refs.getFirst().get("name"));
    assertEquals("Data", refs.getFirst().get("displayName"));
  }

  @Test
  void namedRefsHandlesNullList() {
    assertTrue(GetUserContextTool.namedRefs(null).isEmpty());
  }

  @Test
  void domainRefsFallBackToNameWhenFqnMissing() {
    EntityReference withFqn =
        new EntityReference().withName("marketing").withFullyQualifiedName("org.marketing");
    EntityReference withoutFqn = new EntityReference().withName("sales");

    List<Map<String, Object>> refs = GetUserContextTool.domainRefs(List.of(withFqn, withoutFqn));

    assertEquals("org.marketing", refs.get(0).get("fqn"));
    assertEquals("sales", refs.get(1).get("fqn"));
  }

  @Test
  void personaRefReturnsNullWhenAbsent() {
    assertNull(GetUserContextTool.personaRef(null));
  }

  @Test
  void personaRefProjectsNameAndDisplayName() {
    Map<String, Object> ref =
        GetUserContextTool.personaRef(
            new EntityReference().withName("analyst").withDisplayName("Data Analyst"));

    assertEquals("analyst", ref.get("name"));
    assertEquals("Data Analyst", ref.get("displayName"));
  }

  @Test
  void boolParamFailsSafeOnNonBooleanInput() {
    assertTrue(GetUserContextTool.boolParam(Map.of("k", "yes"), "k", true));
    assertTrue(GetUserContextTool.boolParam(Map.of("k", 1), "k", true));
    assertFalse(GetUserContextTool.boolParam(Map.of("k", "false"), "k", true));
    assertTrue(GetUserContextTool.boolParam(Map.of("k", "true"), "k", false));
    assertTrue(GetUserContextTool.boolParam(Map.of(), "k", true));
  }

  @Test
  void resolveOwnedFilterWarnsOnUnrecognizedNonBlankValue() {
    List<String> warnings = new ArrayList<>();
    GetUserContextTool.OwnedFilter filter =
        GetUserContextTool.resolveOwnedFilter(Map.of("ownedFilter", "MISSING_TIERS"), warnings);

    assertEquals(GetUserContextTool.OwnedFilter.NONE, filter);
    assertEquals(1, warnings.size());
    assertTrue(warnings.getFirst().contains("MISSING_TIERS"));
  }

  @Test
  void resolveOwnedFilterDoesNotWarnOnValidOrAbsentValue() {
    List<String> warnings = new ArrayList<>();

    assertEquals(
        GetUserContextTool.OwnedFilter.ANY_GAP,
        GetUserContextTool.resolveOwnedFilter(Map.of("ownedFilter", "any_gap"), warnings));
    assertEquals(
        GetUserContextTool.OwnedFilter.NONE,
        GetUserContextTool.resolveOwnedFilter(Map.of(), warnings));

    assertTrue(warnings.isEmpty());
  }
}
