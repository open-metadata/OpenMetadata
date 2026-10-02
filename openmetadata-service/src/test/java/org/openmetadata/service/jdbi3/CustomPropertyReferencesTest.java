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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.CustomPropertyReferenceDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceRow;
import org.openmetadata.service.jdbi3.CustomPropertyReferences.Scope;

class CustomPropertyReferencesTest {
  private static final UUID HOLDER = UUID.randomUUID();
  private static final String LIVE = UUID.randomUUID().toString();
  private static final String KEPT = UUID.randomUUID().toString();
  private static final String GONE = UUID.randomUUID().toString();
  private static final Scope SCOPE =
      new Scope(Entity.DOMAIN, HOLDER, CustomPropertyReferences.ENTITY_LEVEL);

  private CustomPropertyReferenceDAO dao;
  private EntityDAO<?> teamDao;
  private CustomPropertyReferences references;
  private MockedStatic<Entity> entity;
  private MockedStatic<TypeRegistry> registry;

  @BeforeEach
  void setUp() {
    CollectionDAO collection = mock(CollectionDAO.class);
    dao = mock(CustomPropertyReferenceDAO.class);
    when(collection.customPropertyReferenceDAO()).thenReturn(dao);
    teamDao = mock(EntityDAO.class);
    when(teamDao.getTableName()).thenReturn("team_entity");
    EntityRepository<?> teamRepository = mock(EntityRepository.class);
    when(teamRepository.getDao()).thenAnswer(ignored -> teamDao);
    entity = mockStatic(Entity.class);
    entity.when(() -> Entity.hasEntityRepository(Entity.TEAM)).thenReturn(true);
    entity.when(() -> Entity.getEntityRepository(Entity.TEAM)).thenAnswer(i -> teamRepository);
    registry = mockStatic(TypeRegistry.class);
    registry
        .when(() -> TypeRegistry.getCustomPropertyType(anyString(), eq("owningTeams")))
        .thenReturn(CustomPropertyReferences.ENTITY_REFERENCE_LIST);
    registry
        .when(() -> TypeRegistry.getCustomPropertyType(anyString(), eq("steward")))
        .thenReturn(CustomPropertyReferences.ENTITY_REFERENCE);
    references = new CustomPropertyReferences(collection);
  }

  @AfterEach
  void tearDown() {
    entity.close();
    registry.close();
  }

  @Test
  void addedTargetsAreInsertedOnlyWhenTheyStillExist() {
    when(dao.findEntityLevel(anyList())).thenReturn(List.of());
    when(teamDao.lockExistingIds(eq("team_entity"), anyList())).thenReturn(List.of(LIVE));

    references.write(SCOPE, values("{\"owningTeams\":[%s,%s]}", LIVE, GONE));

    assertEquals(List.of(LIVE), targets(captureInserted()));
  }

  @Test
  void removedTargetsAreDeletedAndRetainedOnesAreNotReProven() {
    when(dao.findEntityLevel(anyList()))
        .thenReturn(List.of(row("owningTeams", KEPT, 0), row("owningTeams", GONE, 1)));

    references.write(SCOPE, values("{\"owningTeams\":[%s]}", KEPT));

    assertEquals(List.of(GONE), targets(captureDeleted()));
    assertTrue(captureInserted().isEmpty());
  }

  @Test
  void aRetainedTargetThatMovedIsUpdatedInPlace() {
    when(dao.findEntityLevel(anyList()))
        .thenReturn(List.of(row("owningTeams", KEPT, 0), row("owningTeams", LIVE, 1)));

    references.write(SCOPE, values("{\"owningTeams\":[%s,%s]}", LIVE, KEPT));

    ArgumentCaptor<List<ReferenceRow>> updated = rowsCaptor();
    verify(dao).updateMany(updated.capture());
    assertEquals(List.of(LIVE, KEPT), targets(updated.getValue()));
  }

  @Test
  void aPropertyNoLongerSetLosesAllItsRows() {
    when(dao.findEntityLevel(anyList())).thenReturn(List.of(row("owningTeams", KEPT, 0)));

    references.write(SCOPE, JsonUtils.getObjectNode());

    assertEquals(List.of(KEPT), targets(captureDeleted()));
  }

  @Test
  void aRepeatedTargetKeepsItsFirstPosition() {
    when(dao.findEntityLevel(anyList())).thenReturn(List.of());
    when(teamDao.lockExistingIds(eq("team_entity"), anyList())).thenReturn(List.of(LIVE, KEPT));

    references.write(SCOPE, values("{\"owningTeams\":[%s,%s,%s]}", LIVE, KEPT, LIVE));

    List<ReferenceRow> inserted = captureInserted();
    assertEquals(List.of(LIVE, KEPT), targets(inserted));
    assertEquals(List.of(0, 1), inserted.stream().map(ReferenceRow::position).toList());
  }

  @Test
  void readsRebuildAnObjectForASingleReferenceAndAListOtherwise() {
    when(dao.findEntityLevel(anyList()))
        .thenReturn(
            List.of(
                row("owningTeams", KEPT, 0), row("owningTeams", LIVE, 1), row("steward", LIVE, 0)));

    ObjectNode read = references.read(Entity.DOMAIN, List.of(HOLDER)).get(HOLDER);

    assertTrue(read.get("owningTeams").isArray());
    assertEquals(2, read.get("owningTeams").size());
    assertEquals(LIVE, read.get("steward").get("id").asText());
  }

  @Test
  void withReferencesReplacesAStaleInlineCopy() {
    Object stale =
        JsonUtils.readValue(
            values("{\"owningTeams\":[%s],\"tier\":\"gold\"}", GONE).toString(), Object.class);

    JsonNode merged =
        JsonUtils.valueToTree(
            CustomPropertyReferences.withReferences(
                stale, values("{\"owningTeams\":[%s]}", KEPT), "owningTeams"::equals));

    assertEquals(KEPT, merged.get("owningTeams").get(0).get("id").asText());
    assertEquals("gold", merged.get("tier").asText());
  }

  @Test
  void withReferencesDropsReferencesWhenNoneAreStored() {
    Object stale =
        JsonUtils.readValue(values("{\"owningTeams\":[%s]}", GONE).toString(), Object.class);

    assertNull(CustomPropertyReferences.withReferences(stale, null, "owningTeams"::equals));
  }

  @Test
  void extractReferencesLeavesOtherPropertiesBehind() {
    ObjectNode extension = values("{\"owningTeams\":[%s],\"tier\":\"gold\"}", KEPT);

    ObjectNode extracted =
        CustomPropertyReferences.extractReferences(extension, "owningTeams"::equals);

    assertTrue(extracted.has("owningTeams"));
    assertFalse(extension.has("owningTeams"));
    assertTrue(extension.has("tier"));
  }

  private static ObjectNode values(String template, String... ids) {
    Object[] refs = new Object[ids.length];
    for (int i = 0; i < ids.length; i++) {
      refs[i] = String.format("{\"id\":\"%s\",\"type\":\"team\"}", ids[i]);
    }
    return (ObjectNode) JsonUtils.readTree(String.format(template, refs));
  }

  private static ReferenceRow row(String property, String target, int position) {
    return new ReferenceRow(
        HOLDER.toString(),
        CustomPropertyReferences.ENTITY_LEVEL,
        property,
        target,
        Entity.DOMAIN,
        Entity.TEAM,
        position,
        String.format("{\"id\":\"%s\",\"type\":\"team\"}", target));
  }

  private List<ReferenceRow> captureInserted() {
    ArgumentCaptor<List<ReferenceRow>> captor = rowsCaptor();
    verify(dao).insertMany(captor.capture());
    return captor.getValue();
  }

  private List<ReferenceRow> captureDeleted() {
    ArgumentCaptor<List<ReferenceRow>> captor = rowsCaptor();
    verify(dao).deleteMany(captor.capture());
    return captor.getValue();
  }

  @SuppressWarnings("unchecked")
  private static ArgumentCaptor<List<ReferenceRow>> rowsCaptor() {
    return ArgumentCaptor.forClass((Class<List<ReferenceRow>>) (Class<?>) List.class);
  }

  private static List<String> targets(List<ReferenceRow> rows) {
    return rows.stream().map(ReferenceRow::targetId).toList();
  }
}
