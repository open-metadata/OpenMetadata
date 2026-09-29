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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.ontology.RelationshipTypeService;

/** CRUD, history, and typed-field integration coverage for relationship definitions. */
@Execution(ExecutionMode.CONCURRENT)
public class RelationshipTypeResourceIT
    extends BaseEntityIT<RelationshipType, CreateRelationshipType> {

  public RelationshipTypeResourceIT() {
    supportsCustomExtension = false;
    supportsDataProducts = false;
    supportsDomains = false;
    supportsFollowers = false;
    supportsOwners = true;
    supportsPatch = true;
    supportsSearchIndex = false;
    supportsSoftDelete = true;
    supportsTags = false;
  }

  @Override
  protected CreateRelationshipType createMinimalRequest(TestNamespace ns) {
    return request(ns.prefix("semanticRelation"));
  }

  @Override
  protected CreateRelationshipType createRequest(String name, TestNamespace ns) {
    return request(name);
  }

  private static CreateRelationshipType request(String name) {
    URI predicateIri =
        URI.create(
            "https://example.org/ontology/"
                + UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8)));
    return new CreateRelationshipType()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Governed ontology relationship " + name)
        .withIri(predicateIri)
        .withRdfPredicate(predicateIri)
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE))
        .withCrossGlossaryAllowed(true)
        .withPaletteKey(RelationshipPaletteKey.VIOLET);
  }

  @Override
  protected RelationshipType createEntity(CreateRelationshipType request) {
    return service().create(request);
  }

  @Override
  protected RelationshipType getEntity(String id) {
    return service().get(id);
  }

  @Override
  protected RelationshipType getEntityByName(String fqn) {
    return service().getByName(fqn);
  }

  @Override
  protected RelationshipType patchEntity(String id, RelationshipType entity) {
    return service().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    service().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    service().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    service().delete(id, true);
  }

  @Override
  protected String getEntityType() {
    return "relationshipType";
  }

  @Override
  protected void validateCreatedEntity(RelationshipType entity, CreateRelationshipType request) {
    assertEquals(request.getName(), entity.getName());
    assertEquals(request.getRdfPredicate(), entity.getRdfPredicate());
    assertEquals(request.getCategory(), entity.getCategory());
    assertEquals(request.getCharacteristics(), entity.getCharacteristics());
    assertFalse(entity.getSystemDefined());
  }

  @Override
  protected ListResponse<RelationshipType> listEntities(ListParams params) {
    return service().list(params);
  }

  @Override
  protected RelationshipType getEntityWithFields(String id, String fields) {
    return service().get(id, fields);
  }

  @Override
  protected RelationshipType getEntityByNameWithFields(String fqn, String fields) {
    return service().getByName(fqn, fields);
  }

  @Override
  protected RelationshipType getEntityIncludeDeleted(String id) {
    return service().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return service().getVersionList(id);
  }

  @Override
  protected RelationshipType getVersion(UUID id, Double version) {
    return service().getVersion(id.toString(), version);
  }

  private static RelationshipTypeService service() {
    return SdkClients.adminClient().relationshipTypes();
  }
}
