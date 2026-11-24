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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.OntologyPatternTermInput;
import org.openmetadata.schema.api.data.OntologyPatternType;
import org.openmetadata.service.ontology.OntologyPatternCatalog.PatternRole;

final class OntologyPatternRequestValidator {
  void validate(final InstantiateOntologyPattern request) {
    requirePatternType(request.getPatternType());
    requireMatchingConfiguration(request);
    requireUniqueTermNames(request);
  }

  OntologyPatternTermInput termInput(
      final InstantiateOntologyPattern request, final PatternRole role) {
    final OntologyPatternTermInput input =
        switch (role) {
          case CONTROL -> request.getRegulatoryControl().getControl();
          case REQUIREMENT -> request.getRegulatoryControl().getRequirement();
          case EVIDENCE -> request.getRegulatoryControl().getEvidence();
          case KPI -> request.getMeasuredKpi().getKpi();
          case METRIC -> request.getMeasuredKpi().getMetric();
          case DIMENSION -> request.getMeasuredKpi().getDimension();
          case PORTFOLIO -> request.getProductHierarchy().getPortfolio();
          case PRODUCT -> request.getProductHierarchy().getProduct();
          case FEATURE -> request.getProductHierarchy().getFeature();
        };
    return requireTermInput(input, role);
  }

  private static void requirePatternType(final OntologyPatternType patternType) {
    if (patternType == null) {
      throw new BadRequestException("Ontology patternType is required");
    }
  }

  private static void requireMatchingConfiguration(final InstantiateOntologyPattern request) {
    final boolean matches =
        configuredPatternCount(request) == 1
            && switch (request.getPatternType()) {
              case REGULATORY_CONTROL -> request.getRegulatoryControl() != null;
              case MEASURED_KPI -> request.getMeasuredKpi() != null;
              case PRODUCT_HIERARCHY -> request.getProductHierarchy() != null;
            };
    if (!matches) {
      throw new BadRequestException(
          "Exactly one pattern configuration matching patternType is required");
    }
  }

  private static int configuredPatternCount(final InstantiateOntologyPattern request) {
    int count = request.getRegulatoryControl() == null ? 0 : 1;
    count += request.getMeasuredKpi() == null ? 0 : 1;
    count += request.getProductHierarchy() == null ? 0 : 1;
    return count;
  }

  private void requireUniqueTermNames(final InstantiateOntologyPattern request) {
    final List<OntologyPatternTermInput> inputs =
        roles(request.getPatternType()).stream().map(role -> termInput(request, role)).toList();
    final Set<String> names = new HashSet<>();
    if (inputs.stream().map(OntologyPatternTermInput::getName).anyMatch(name -> !names.add(name))) {
      throw new BadRequestException("Ontology pattern term names must be unique");
    }
  }

  private static List<PatternRole> roles(final OntologyPatternType patternType) {
    final List<PatternRole> roles =
        switch (patternType) {
          case REGULATORY_CONTROL -> List.of(
              PatternRole.CONTROL, PatternRole.REQUIREMENT, PatternRole.EVIDENCE);
          case MEASURED_KPI -> List.of(PatternRole.KPI, PatternRole.METRIC, PatternRole.DIMENSION);
          case PRODUCT_HIERARCHY -> List.of(
              PatternRole.PORTFOLIO, PatternRole.PRODUCT, PatternRole.FEATURE);
        };
    return roles;
  }

  private static OntologyPatternTermInput requireTermInput(
      final OntologyPatternTermInput input, final PatternRole role) {
    if (input == null
        || nullOrEmpty(input.getName())
        || input.getName().isBlank()
        || nullOrEmpty(input.getDescription())
        || input.getDescription().isBlank()) {
      throw new BadRequestException(
          "Ontology pattern role '" + role.key() + "' requires a name and description");
    }
    return input;
  }
}
