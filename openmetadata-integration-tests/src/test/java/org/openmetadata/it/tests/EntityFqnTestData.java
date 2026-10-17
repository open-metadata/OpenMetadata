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

package org.openmetadata.it.tests;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

final class EntityFqnTestData {
  private EntityFqnTestData() {}

  static EntityCaptureFixture fixture(
      final RdfTestDatabase.Backend backend, final boolean capture) {
    final var fixture = new EntityCaptureFixture(backend, capture);
    for (final String table : List.of("chart_entity", "storage_container_entity")) {
      ProjectionTestSchema.create(fixture.jdbi(), backend, table);
    }
    return fixture;
  }

  static void seedCharts(final Jdbi jdbi, final int count) {
    jdbi.useTransaction(
        handle -> {
          final var batch =
              handle.prepareBatch(
                  "INSERT INTO chart_entity (json, fqnHash) VALUES (CAST(:json AS JSON), :hash)");
          for (int index = 0; index < count; index++) {
            final Chart chart = chart(index, "service.before.child" + index);
            batch
                .bind("json", JsonUtils.pojoToJson(chart))
                .bind("hash", FullyQualifiedName.buildHash(chart.getFullyQualifiedName()))
                .add();
          }
          batch.execute();
        });
  }

  static void seed(final Jdbi jdbi, final EntityInterface<?> entity, final String table) {
    jdbi.useHandle(
        handle ->
            handle
                .createUpdate(
                    "INSERT INTO <table> (json, fqnHash) VALUES (CAST(:json AS JSON), :hash)")
                .define("table", table)
                .bind("json", JsonUtils.pojoToJson(entity))
                .bind("hash", FullyQualifiedName.buildHash(entity.getFullyQualifiedName()))
                .execute());
  }

  static Chart chart(final int index, final String fqn) {
    return new Chart()
        .withId(id(index))
        .withName("child" + index)
        .withFullyQualifiedName(fqn)
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUpdatedBy("test")
        .withDeleted(false);
  }

  static UUID id(final int index) {
    return new UUID(0, index + 1L);
  }
}
