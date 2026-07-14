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
import lombok.extern.slf4j.Slf4j;
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

  TermRelationMetadata create(
      String relationType, RelationProvenance provenance, EntityStatus status) {
    return normalize(
        new TermRelationMetadata()
            .withRelationType(relationType)
            .withProvenance(provenance)
            .withStatus(status));
  }

  private TermRelationMetadata normalize(TermRelationMetadata metadata) {
    TermRelationMetadata source =
        Objects.requireNonNullElseGet(metadata, TermRelationMetadata::new);
    return new TermRelationMetadata()
        .withRelationType(
            Objects.requireNonNullElse(source.getRelationType(), DEFAULT_RELATION_TYPE))
        .withProvenance(Objects.requireNonNullElse(source.getProvenance(), DEFAULT_PROVENANCE))
        .withStatus(Objects.requireNonNullElse(source.getStatus(), DEFAULT_STATUS));
  }

  private TermRelationMetadata defaults() {
    return normalize(null);
  }
}
