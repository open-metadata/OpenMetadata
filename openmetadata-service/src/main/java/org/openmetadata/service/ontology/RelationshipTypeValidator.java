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

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.Set;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.RelationshipCardinality;
import org.openmetadata.schema.type.RelationshipCharacteristic;

public final class RelationshipTypeValidator {
  private RelationshipTypeValidator() {}

  public static void validate(final RelationshipType relationshipType) {
    validatePredicate(relationshipType.getRdfPredicate());
    validateCharacteristics(relationshipType.getCharacteristics());
    validateCardinality(relationshipType);
    validateInverse(relationshipType);
    validateReplacement(relationshipType);
  }

  private static void validatePredicate(final URI predicate) {
    if (predicate == null || !predicate.isAbsolute()) {
      throw new BadRequestException("A relationship type requires an absolute RDF predicate IRI");
    }
  }

  private static void validateCharacteristics(
      final Set<RelationshipCharacteristic> characteristics) {
    rejectCombination(
        characteristics,
        RelationshipCharacteristic.SYMMETRIC,
        RelationshipCharacteristic.ASYMMETRIC);
    rejectCombination(
        characteristics,
        RelationshipCharacteristic.REFLEXIVE,
        RelationshipCharacteristic.IRREFLEXIVE);
  }

  private static void rejectCombination(
      final Set<RelationshipCharacteristic> characteristics,
      final RelationshipCharacteristic first,
      final RelationshipCharacteristic second) {
    if (characteristics.contains(first) && characteristics.contains(second)) {
      throw new BadRequestException(
          "Relationship characteristics '" + first + "' and '" + second + "' are incompatible");
    }
  }

  private static void validateCardinality(final RelationshipType relationshipType) {
    final RelationshipCardinality cardinality = relationshipType.getCardinality();
    validateFunctionalLimit(relationshipType, cardinality);
    validateInverseFunctionalLimit(relationshipType, cardinality);
  }

  private static void validateFunctionalLimit(
      final RelationshipType relationshipType, final RelationshipCardinality cardinality) {
    if (has(relationshipType, RelationshipCharacteristic.FUNCTIONAL)
        && (cardinality == null || !Integer.valueOf(1).equals(cardinality.getSourceMax()))) {
      throw new BadRequestException("A functional relationship must have sourceMax set to 1");
    }
  }

  private static void validateInverseFunctionalLimit(
      final RelationshipType relationshipType, final RelationshipCardinality cardinality) {
    if (has(relationshipType, RelationshipCharacteristic.INVERSE_FUNCTIONAL)
        && (cardinality == null || !Integer.valueOf(1).equals(cardinality.getTargetMax()))) {
      throw new BadRequestException(
          "An inverse-functional relationship must have targetMax set to 1");
    }
  }

  private static void validateInverse(final RelationshipType relationshipType) {
    final boolean hasInvalidSymmetricInverse =
        has(relationshipType, RelationshipCharacteristic.SYMMETRIC)
            && (relationshipType.getInverse() == null
                || !relationshipType.getId().equals(relationshipType.getInverse().getId()));
    if (hasInvalidSymmetricInverse) {
      throw new BadRequestException("A symmetric relationship must be its own inverse");
    }
  }

  private static void validateReplacement(final RelationshipType relationshipType) {
    if (relationshipType.getReplacedBy() != null
        && relationshipType.getId().equals(relationshipType.getReplacedBy().getId())) {
      throw new BadRequestException("A relationship type cannot replace itself");
    }
  }

  private static boolean has(
      final RelationshipType relationshipType, final RelationshipCharacteristic characteristic) {
    return relationshipType.getCharacteristics().contains(characteristic);
  }
}
