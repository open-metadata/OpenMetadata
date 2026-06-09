/*
 *  Copyright 2024 Collate.
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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.ShapeCanary;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

@Execution(ExecutionMode.SAME_THREAD)
class EntityShapeSpikeIT {

  private static ShapeCanary canary;

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
    final SearchRepository searchRepository = Entity.getSearchRepository();
    canary = new ShapeCanary(searchRepository, new SearchClient(OssTestServer.defaultHandle()));
  }

  @Test
  void minimalTableRoundTrips() {
    final Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("shapeSpike")
            .withFullyQualifiedName("shapeSpikeSvc.db.schema." + UUID.randomUUID())
            .withColumns(List.of(new Column().withName("c0").withDataType(ColumnDataType.STRING)));

    final Outcome outcome = canary.index(Entity.TABLE, table, null);

    assertEquals(Outcome.OK, outcome, "A minimal in-memory table must build, PUT, and retrieve");
  }
}
