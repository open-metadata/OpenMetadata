/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelationMetadata;
import org.openmetadata.schema.utils.JsonUtils;

class TermRelationMetadataCodecTest {
  private final TermRelationMetadataCodec codec = new TermRelationMetadataCodec();

  @Test
  void decodeReturnsTypedMetadata() {
    TermRelationMetadata metadata =
        codec.decode(
            """
            {
              "relationType": "broader",
              "provenance": "Imported",
              "status": "Approved"
            }
            """);

    assertEquals("broader", metadata.getRelationType());
    assertEquals(RelationProvenance.IMPORTED, metadata.getProvenance());
    assertEquals(EntityStatus.APPROVED, metadata.getStatus());
  }

  @Test
  void decodeAppliesDefaultsToLegacyMetadata() {
    TermRelationMetadata metadata = codec.decode("{}");

    assertEquals(TermRelationMetadataCodec.DEFAULT_RELATION_TYPE, metadata.getRelationType());
    assertEquals(RelationProvenance.MANUAL, metadata.getProvenance());
    assertEquals(EntityStatus.UNPROCESSED, metadata.getStatus());
  }

  @Test
  void decodeAppliesDefaultsToMissingAndMalformedMetadata() {
    TermRelationMetadata missing = codec.decode(null);
    TermRelationMetadata malformed = codec.decode("not-json");

    assertEquals(missing, malformed);
    assertEquals(TermRelationMetadataCodec.DEFAULT_RELATION_TYPE, malformed.getRelationType());
    assertEquals(RelationProvenance.MANUAL, malformed.getProvenance());
    assertEquals(EntityStatus.UNPROCESSED, malformed.getStatus());
  }

  @Test
  void encodeWritesTheSchemaBackedPersistenceShape() {
    String json = codec.encode("narrower", RelationProvenance.INFERRED, EntityStatus.IN_REVIEW);
    TermRelationMetadata metadata = JsonUtils.readValue(json, TermRelationMetadata.class);

    assertEquals("narrower", metadata.getRelationType());
    assertEquals(RelationProvenance.INFERRED, metadata.getProvenance());
    assertEquals(EntityStatus.IN_REVIEW, metadata.getStatus());
  }

  @Test
  void createPreservesStableIdentityAndAuditMetadata() {
    UUID relationshipId = UUID.randomUUID();
    UUID relationshipTypeId = UUID.randomUUID();
    UUID sourceTermId = UUID.randomUUID();
    RelationshipType relationshipType =
        new RelationshipType().withId(relationshipTypeId).withName("broader");
    TermRelationMetadata requested =
        new TermRelationMetadata()
            .withId(relationshipId)
            .withRelationType("broader")
            .withProvenance(RelationProvenance.IMPORTED)
            .withStatus(EntityStatus.APPROVED)
            .withCreatedBy("importer")
            .withCreatedAt(42L);

    TermRelationMetadata metadata =
        codec.create(requested, relationshipType, sourceTermId, "editor", 100L);

    assertEquals(relationshipId, metadata.getId());
    assertEquals(relationshipTypeId, metadata.getRelationshipTypeId());
    assertEquals(sourceTermId, metadata.getSourceTermId());
    assertEquals("importer", metadata.getCreatedBy());
    assertEquals(42L, metadata.getCreatedAt());
  }
}
