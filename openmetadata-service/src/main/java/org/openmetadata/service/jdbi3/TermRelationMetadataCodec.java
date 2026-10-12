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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelationMetadata;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
final class TermRelationMetadataCodec {
  static final String DEFAULT_RELATION_TYPE = "relatedTo";
  private static final RelationProvenance DEFAULT_PROVENANCE = RelationProvenance.MANUAL;
  private static final EntityStatus DEFAULT_STATUS = EntityStatus.UNPROCESSED;

  TermRelationMetadata decode(String json) {
    TermRelationMetadata metadata = defaults();
    if (!nullOrEmpty(json)) {
      try {
        metadata = normalize(JsonUtils.readValue(json, TermRelationMetadata.class));
      } catch (JsonParsingException exception) {
        LOG.debug("Unable to parse glossary term relation metadata; using defaults", exception);
      }
    }
    return metadata;
  }

  String encode(String relationType, RelationProvenance provenance, EntityStatus status) {
    return JsonUtils.pojoToJson(create(relationType, provenance, status));
  }

  String encode(TermRelationMetadata metadata) {
    return JsonUtils.pojoToJson(normalize(metadata));
  }

  TermRelationMetadata create(
      String relationType, RelationProvenance provenance, EntityStatus status) {
    return normalize(
        new TermRelationMetadata()
            .withRelationType(relationType)
            .withProvenance(provenance)
            .withStatus(status));
  }

  TermRelationMetadata create(
      TermRelationMetadata requested,
      RelationshipType relationshipType,
      UUID sourceTermId,
      String createdBy,
      long createdAt) {
    TermRelationMetadata normalized = normalize(requested);
    return normalized
        .withId(Objects.requireNonNullElseGet(normalized.getId(), UUID::randomUUID))
        .withRelationshipTypeId(relationshipType.getId())
        .withSourceTermId(sourceTermId)
        .withCreatedBy(Objects.requireNonNullElse(normalized.getCreatedBy(), createdBy))
        .withCreatedAt(Objects.requireNonNullElse(normalized.getCreatedAt(), createdAt));
  }

  private TermRelationMetadata normalize(TermRelationMetadata metadata) {
    TermRelationMetadata source =
        Objects.requireNonNullElseGet(metadata, TermRelationMetadata::new);
    return new TermRelationMetadata()
        .withId(source.getId())
        .withRelationshipTypeId(source.getRelationshipTypeId())
        .withSourceTermId(source.getSourceTermId())
        .withRelationType(
            Objects.requireNonNullElse(source.getRelationType(), DEFAULT_RELATION_TYPE))
        .withProvenance(Objects.requireNonNullElse(source.getProvenance(), DEFAULT_PROVENANCE))
        .withStatus(Objects.requireNonNullElse(source.getStatus(), DEFAULT_STATUS))
        .withCreatedBy(source.getCreatedBy())
        .withCreatedAt(source.getCreatedAt());
  }

  private TermRelationMetadata defaults() {
    return normalize(null);
  }
}
