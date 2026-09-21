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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;

final class OntologySubsetValidator {
  void validate(final Glossary source, final Glossary target, final BuildOntologySubset request) {
    requireDistinctModels(source, target);
    requireWritableTarget(target);
    requireCompatibleLayers(source, target);
    requirePinnedVersions(source, target);
    requireUniqueSelection(request.getSourceTermIds());
  }

  private static void requireDistinctModels(final Glossary source, final Glossary target) {
    if (source.getId().equals(target.getId())) {
      throw new BadRequestException("Ontology subset source and target must be different models");
    }
  }

  private static void requireWritableTarget(final Glossary target) {
    final OntologyConfiguration configuration = target.getOntologyConfiguration();
    if (configuration != null && Boolean.TRUE.equals(configuration.getReadOnly())) {
      throw new BadRequestException(
          "Application ontology target '" + target.getName() + "' is read-only");
    }
  }

  private static void requireCompatibleLayers(final Glossary source, final Glossary target) {
    final OntologyLayer sourceLayer = layer(source);
    final OntologyLayer targetLayer = layer(target);
    if (rank(sourceLayer) > rank(targetLayer)) {
      throw new BadRequestException(
          "Application ontology '"
              + target.getName()
              + "' in "
              + targetLayer
              + " cannot subset less foundational ontology '"
              + source.getName()
              + "' in "
              + sourceLayer);
    }
  }

  private static OntologyLayer layer(final Glossary glossary) {
    final OntologyConfiguration configuration = glossary.getOntologyConfiguration();
    final OntologyLayer layer =
        configuration == null || configuration.getLayer() == null
            ? OntologyLayer.L_3
            : configuration.getLayer();
    return layer;
  }

  private static int rank(final OntologyLayer layer) {
    final int rank =
        switch (layer) {
          case L_1 -> 1;
          case L_2 -> 2;
          case L_3 -> 3;
        };
    return rank;
  }

  private static void requirePinnedVersions(final Glossary source, final Glossary target) {
    if (source.getVersion() == null || target.getVersion() == null) {
      throw new BadRequestException("Ontology subset models require persisted entity versions");
    }
  }

  private static void requireUniqueSelection(final Set<UUID> selectedTermIds) {
    final boolean isInvalid =
        nullOrEmpty(selectedTermIds)
            || selectedTermIds.size() > 100
            || selectedTermIds.stream().anyMatch(id -> id == null);
    if (isInvalid) {
      throw new BadRequestException(
          "Ontology subsets require between 1 and 100 unique source term ids");
    }
  }
}
