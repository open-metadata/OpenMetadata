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
package org.openmetadata.service.projection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.util.FullyQualifiedName;

class ProjectionOwnerLookupContractTest {
  private final ProjectionOwnerLookup lookup =
      new ProjectionOwnerLookup(Jdbi.create("jdbc:unused"));

  @ParameterizedTest
  @ValueSource(ints = {-1, 0, 1001})
  void invalidPagesDoNotOpenConnections(final int limit) {
    final var source = new ProjectionOwnerLookup.Source("table", "table_entity", "fqnHash", true);
    assertThrows(
        IllegalArgumentException.class,
        () -> lookup.page(source, FullyQualifiedName.buildHash("table"), null, limit));
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"not a hash", "abcd", "foo;drop table catalog"})
  void invalidHashesCannotBecomeUnresolvedSuccess(final String hash) {
    assertThrows(IllegalArgumentException.class, () -> ProjectionOwnerLookup.hashes(hash, true));
  }

  @Test
  void identifiersMustBeDeclaredSqlNames() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new ProjectionOwnerLookup.Source("", "table_entity", "fqnHash", true));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ProjectionOwnerLookup.Source(null, "table_entity", "fqnHash", true));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ProjectionOwnerLookup.Source("x".repeat(129), "table_entity", "fqnHash", true));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ProjectionOwnerLookup.Source("table", "table_entity;DELETE", "fqnHash", true));
    assertThrows(
        IllegalArgumentException.class,
        () -> new ProjectionOwnerLookup.Source("table", "table_entity", null, true));
  }

  @Test
  void prefixRewritesOnlyMatchStrictSegmentAncestors() {
    final String root = FullyQualifiedName.buildHash("service");
    final String child = FullyQualifiedName.buildHash("service.db");
    final String leaf = FullyQualifiedName.buildHash("service.db.table");
    assertEquals(List.of(root, child), ProjectionOwnerLookup.ancestors(leaf));
    assertEquals(List.of(), ProjectionOwnerLookup.ancestors(root));
  }

  @Test
  void quotedDotsDoNotInventExtraOwnershipLevels() {
    final String root = "\"service.name\".db.schema.\"table.name\"";
    final String child = root + ".\"field.name\".nested";
    final var hashes = ProjectionOwnerLookup.hashes(FullyQualifiedName.buildHash(child), true);
    assertEquals(6, hashes.size());
    assertEquals(FullyQualifiedName.buildHash(root), hashes.get(3));
    assertEquals(
        List.of(FullyQualifiedName.buildHash(child)),
        ProjectionOwnerLookup.hashes(FullyQualifiedName.buildHash(child), false));
    assertThrows(UnsupportedOperationException.class, () -> hashes.add("new"));
    assertThrows(
        IllegalArgumentException.class, () -> ProjectionOwnerLookup.hashes("f".repeat(769), true));
  }
}
