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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateType;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Guards the freshness marker that the multi-replica stale-hit fix depends on. In a multi-pod
 * deployment a custom property edited or deleted on one replica is a cache hit on its peers, so the
 * registry only self-heals if the peer can cheaply detect the change. That detection keys on the
 * owning type's {@code updatedAt}/{@code version}, so these tests assert — through the real API,
 * database, and {@code EntityUpdater} — that add, edit (including enum config), and delete each bump
 * that marker, for both entity-level and column-level custom properties.
 *
 * <p>The stale-hit reload logic itself is unit-tested in {@code TypeRegistryTest}; a single-instance
 * IT cannot reproduce a two-pod desync, so it validates the load-bearing fact the fix rests on
 * rather than re-testing the gate. Entity-level assertions use a fresh per-test entity type for
 * determinism under concurrency; the shared {@code tableColumn} case uses a monotonic assertion,
 * which holds regardless of concurrent bumps.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class CustomPropertyVersionMarkerIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String TABLE_COLUMN = "tableColumn";

  @Test
  void addCustomProperty_bumpsOwningTypeVersionAndUpdatedAt(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type entityType = createEntityType(client, ns, "addBump");
    Double versionBefore = entityType.getVersion();
    Long updatedAtBefore = entityType.getUpdatedAt();

    Type afterAdd =
        addCustomProperty(client, entityType.getId(), stringProperty(ns.prefix("p"), null));

    assertTrue(
        afterAdd.getVersion() > versionBefore,
        "Adding a custom property must bump the owning type's version");
    assertTrue(
        afterAdd.getUpdatedAt() > updatedAtBefore,
        "Adding a custom property must bump the owning type's updatedAt");
  }

  @Test
  void editCustomPropertyConfig_bumpsOwningTypeVersion(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type entityType = createEntityType(client, ns, "editBump");
    String propertyName = ns.prefix("enumProp");

    Type afterAdd =
        addCustomProperty(
            client, entityType.getId(), enumProperty(propertyName, List.of("A", "B")));
    Type afterEdit =
        addCustomProperty(
            client, entityType.getId(), enumProperty(propertyName, List.of("A", "B", "C")));

    assertTrue(
        afterEdit.getVersion() > afterAdd.getVersion(),
        "Editing an enum config must bump the owning type's version");
  }

  @Test
  void deleteCustomProperty_bumpsOwningTypeVersionAndDropsProperty(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type entityType = createEntityType(client, ns, "deleteBump");
    String propertyName = ns.prefix("doomed");

    Type afterAdd =
        addCustomProperty(client, entityType.getId(), stringProperty(propertyName, null));
    Type afterDelete = removeAllCustomProperties(client, afterAdd.getId());

    assertTrue(
        afterDelete.getVersion() > afterAdd.getVersion(),
        "Deleting a custom property must bump the owning type's version");
    assertFalse(hasProperty(afterDelete, propertyName), "The deleted custom property must be gone");
  }

  @Test
  void columnCustomProperty_bumpsColumnTypeAndIsKeyedThere(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type columnTypeBefore = getTypeByName(client, TABLE_COLUMN);
    String propertyName = ns.prefix("colProp");

    Type afterAdd =
        addCustomProperty(client, columnTypeBefore.getId(), stringProperty(propertyName, null));

    assertTrue(
        afterAdd.getVersion() > columnTypeBefore.getVersion(),
        "A column custom property must bump the tableColumn type's version, not the parent table's");
    assertTrue(
        hasProperty(afterAdd, propertyName),
        "The column custom property must be registered on the tableColumn type");
  }

  private CustomProperty stringProperty(String name, String description) throws Exception {
    Type stringType = getTypeByName(SdkClients.adminClient(), "string");
    return new CustomProperty()
        .withName(name)
        .withDescription(description)
        .withPropertyType(stringType.getEntityReference());
  }

  private CustomProperty enumProperty(String name, List<String> values) throws Exception {
    Type enumType = getTypeByName(SdkClients.adminClient(), "enum");
    CustomPropertyConfig config =
        new CustomPropertyConfig().withConfig(new EnumConfig().withValues(values));
    return new CustomProperty()
        .withName(name)
        .withPropertyType(enumType.getEntityReference())
        .withCustomPropertyConfig(config);
  }

  private static boolean hasProperty(Type type, String propertyName) {
    return type.getCustomProperties() != null
        && type.getCustomProperties().stream().anyMatch(cp -> propertyName.equals(cp.getName()));
  }

  private static Type createEntityType(OpenMetadataClient client, TestNamespace ns, String label)
      throws Exception {
    CreateType request =
        new CreateType()
            .withName(ns.prefix(label))
            .withCategory(Category.Entity)
            .withDescription("Per-test entity type for custom-property version-marker IT")
            .withNameSpace("data")
            .withSchema("{}");
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/metadata/types", request, Type.class);
  }

  private static Type addCustomProperty(
      OpenMetadataClient client, UUID typeId, CustomProperty customProperty) throws Exception {
    return client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + typeId, customProperty, Type.class);
  }

  private static Type removeAllCustomProperties(OpenMetadataClient client, UUID typeId)
      throws Exception {
    String patchJson = "[{\"op\":\"replace\",\"path\":\"/customProperties\",\"value\":[]}]";
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/metadata/types/" + typeId,
            patchJson,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
    return getTypeById(client, typeId);
  }

  private static Type getTypeById(OpenMetadataClient client, UUID typeId) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/metadata/types/" + typeId + "?fields=customProperties", null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }
}
