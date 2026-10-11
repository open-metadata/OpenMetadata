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

package org.openmetadata.service.resources.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.service.Entity;

class OntologyChangeSetResourceTest {

  @Test
  void collectsOnlyActiveBindingAssetsForTheSharedPermissionGate() {
    final EntityReference table =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);
    final EntityReference column =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TABLE_COLUMN)
            .withFullyQualifiedName("service.db.schema.table.column");
    final EntityReference undoneDashboard =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DASHBOARD);
    final OntologyChangeSet changeSet =
        new OntologyChangeSet()
            .withOperations(
                List.of(
                    binding(OntologyChangeOperationType.BIND_ASSET, table),
                    binding(OntologyChangeOperationType.UNBIND_ASSET, column),
                    binding(OntologyChangeOperationType.BIND_ASSET, undoneDashboard)))
            .withUndoCursor(2);

    final List<EntityReference> permissionAssets =
        OntologyChangeSetResource.permissionAssetsForBindings(changeSet);

    assertEquals(
        List.of(Entity.TABLE, Entity.TABLE),
        permissionAssets.stream().map(EntityReference::getType).toList());
    assertEquals(
        "service.db.schema.table.column", permissionAssets.getLast().getFullyQualifiedName());
  }

  private static OntologyChangeOperation binding(
      final OntologyChangeOperationType type, final EntityReference asset) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(type)
        .withAssetBinding(new AssetRealization().withAsset(asset));
  }
}
