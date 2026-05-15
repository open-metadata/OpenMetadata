/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.policyAgent.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;

class PolicyAgentPayloadBuilderTest {

  // ---- structure ----

  @Test
  void testBuildPoliciesProducesOneEntryPerTable() {
    List<Map<String, Object>> policies =
        PolicyAgentPayloadBuilder.buildPolicies(
            List.of(table("orders"), table("customers")),
            createdBy("alice"),
            Map.of("accessType", "FullAccess"));

    assertEquals(2, policies.size());
  }

  @Test
  void testEachPolicyEntryHasUniqueId() {
    List<Map<String, Object>> policies =
        PolicyAgentPayloadBuilder.buildPolicies(
            List.of(table("orders"), table("customers")), createdBy("alice"), null);

    String id1 = (String) policies.get(0).get("id");
    String id2 = (String) policies.get(1).get("id");
    assertNotEquals(id1, id2);
    UUID.fromString(id1);
    UUID.fromString(id2);
  }

  @Test
  void testBuildPoliciesMapsTableFieldsCorrectly() {
    Table t =
        new Table()
            .withName("orders")
            .withDatabase(new EntityReference().withName("mydb"))
            .withDatabaseSchema(new EntityReference().withName("myschema"))
            .withService(new EntityReference().withName("snowflake_prod"));

    Map<?, ?> config =
        config(PolicyAgentPayloadBuilder.buildPolicies(List.of(t), createdBy("alice"), null));

    assertEquals("USER", config.get("principalType"));
    assertEquals("alice", config.get("principal"));
    assertEquals("mydb", config.get("databaseName"));
    assertEquals("myschema", config.get("schemaName"));
    assertEquals("orders", config.get("tableName"));
  }

  // ---- privilege mapping ----

  @Test
  void testFullAccessMapsToAll() {
    assertEquals("ALL", privilege(Map.of("accessType", "FullAccess")));
  }

  @Test
  void testReadOnlyMapsToSelect() {
    assertEquals("SELECT", privilege(Map.of("accessType", "ReadOnly")));
  }

  @Test
  void testColumnLevelMapsToSelect() {
    assertEquals("SELECT", privilege(Map.of("accessType", "ColumnLevel")));
  }

  @Test
  void testMaskedMapsToSelect() {
    assertEquals("SELECT", privilege(Map.of("accessType", "Masked")));
  }

  @Test
  void testUnknownAccessTypeDefaultsToAll() {
    assertEquals("ALL", privilege(Map.of("accessType", "WriteOnly")));
  }

  @Test
  void testNullPayloadDefaultsPrivilegeToAll() {
    assertEquals("ALL", privilege(null));
  }

  @Test
  void testPayloadAsJsonStringIsHandled() {
    assertEquals("SELECT", privilege("{\"accessType\":\"ReadOnly\"}"));
  }

  @Test
  void testNonStringAccessTypeValueDefaultsToAll() {
    assertEquals("ALL", privilege(Map.of("accessType", 42)));
  }

  @Test
  void testEmptyMapDefaultsPrivilegeToAll() {
    assertEquals("ALL", privilege(Map.of()));
  }

  // ---- principal validation ----

  @Test
  void testNullCreatedByThrows() {
    assertThrows(
        IllegalArgumentException.class,
        () -> PolicyAgentPayloadBuilder.buildPolicies(List.of(table("t")), null, null));
  }

  @Test
  void testBlankPrincipalNameThrows() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            PolicyAgentPayloadBuilder.buildPolicies(
                List.of(table("t")),
                new EntityReference().withId(UUID.randomUUID()).withName("  "),
                null));
  }

  @Test
  void testPrincipalWithSemicolonThrows() {
    assertThrowsForPrincipal("user;drop");
  }

  @Test
  void testPrincipalWithSingleQuoteThrows() {
    assertThrowsForPrincipal("user'name");
  }

  @Test
  void testPrincipalWithDoubleQuoteThrows() {
    assertThrowsForPrincipal("user\"name");
  }

  @Test
  void testPrincipalWithSpaceThrows() {
    assertThrowsForPrincipal("user name");
  }

  @Test
  void testValidDotSeparatedPrincipalIsAccepted() {
    assertEquals(
        "ram.balaji",
        config(
                PolicyAgentPayloadBuilder.buildPolicies(
                    List.of(table("t")),
                    new EntityReference().withId(UUID.randomUUID()).withName("ram.balaji"),
                    null))
            .get("principal"));
  }

  // ---- helpers ----

  private static Table table(String name) {
    return new Table()
        .withName(name)
        .withDatabase(new EntityReference().withName("db"))
        .withDatabaseSchema(new EntityReference().withName("schema"))
        .withService(new EntityReference().withName("svc"));
  }

  private static EntityReference createdBy(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withName(name);
  }

  private static String privilege(Object taskPayload) {
    return (String)
        config(
                PolicyAgentPayloadBuilder.buildPolicies(
                    List.of(table("t")), createdBy("alice"), taskPayload))
            .get("privilege");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> config(List<Map<String, Object>> policies) {
    return (Map<String, Object>) policies.get(0).get("config");
  }

  private static void assertThrowsForPrincipal(String name) {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            PolicyAgentPayloadBuilder.buildPolicies(
                List.of(table("t")),
                new EntityReference().withId(UUID.randomUUID()).withName(name),
                null));
  }
}
