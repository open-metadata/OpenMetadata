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
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Reads and writes the realization payload carried on a concept-to-asset relationship row. The
 * asset itself is the row's target, so it is resolved from the relationship rather than stored in
 * the payload.
 */
@Slf4j
final class AssetRealizationCodec {
  private static final AssetRealizationRole DEFAULT_ROLE = AssetRealizationRole.PRIMARY_STORE;
  private static final RelationProvenance DEFAULT_PROVENANCE = RelationProvenance.MANUAL;

  AssetRealization decode(String json, EntityReference asset) {
    AssetRealization realization = new AssetRealization();
    if (!nullOrEmpty(json)) {
      try {
        realization = JsonUtils.readValue(json, AssetRealization.class);
      } catch (JsonParsingException exception) {
        LOG.debug("Unable to parse concept realization metadata; using defaults", exception);
      }
    }
    return normalize(realization).withAsset(asset);
  }

  String encode(AssetRealization realization) {
    return JsonUtils.pojoToJson(normalize(realization).withAsset(null));
  }

  AssetRealization normalize(AssetRealization realization) {
    AssetRealization source = Objects.requireNonNullElseGet(realization, AssetRealization::new);

    return new AssetRealization()
        .withId(source.getId())
        .withAsset(source.getAsset())
        .withRole(Objects.requireNonNullElse(source.getRole(), DEFAULT_ROLE))
        .withDescription(source.getDescription())
        .withProvenance(Objects.requireNonNullElse(source.getProvenance(), DEFAULT_PROVENANCE));
  }
}
