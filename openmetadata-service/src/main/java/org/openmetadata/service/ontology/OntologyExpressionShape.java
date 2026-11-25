package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.function.Consumer;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;

/** Rejects fields the RDF projection would otherwise silently discard. */
final class OntologyExpressionShape {
  private OntologyExpressionShape() {}

  static void validate(
      final OntologyExpression value, final String path, final Consumer<String> invalid) {
    final var kind = value.getKind();
    final boolean restriction = kind == OntologyExpressionKind.RESTRICTION;
    final boolean operands =
        kind == OntologyExpressionKind.UNION || kind == OntologyExpressionKind.INTERSECTION;
    if ((value.getClassIri() != null && kind != OntologyExpressionKind.NAMED_CLASS)
        || (!nullOrEmpty(value.getOperands()) && !operands)
        || (!nullOrEmpty(value.getIndividualIris()) && kind != OntologyExpressionKind.ONE_OF)
        || (!restriction && hasRestrictionFields(value))
        || (restriction && hasUnusedRestrictionFields(value))) {
      invalid.accept("Fields do not match the expression kind or restriction operator at " + path);
    }
  }

  private static boolean hasRestrictionFields(final OntologyExpression value) {
    return value.getPropertyIri() != null
        || value.getRestrictionKind() != null
        || value.getFiller() != null
        || value.getCardinality() != null
        || value.getIndividualIri() != null
        || value.getLiteral() != null;
  }

  private static boolean hasUnusedRestrictionFields(final OntologyExpression value) {
    final var kind = value.getRestrictionKind();
    final boolean cardinality =
        kind == OntologyRestrictionKind.MIN
            || kind == OntologyRestrictionKind.MAX
            || kind == OntologyRestrictionKind.EXACT;
    return (value.getCardinality() != null && !cardinality)
        || (value.getFiller() != null && kind == OntologyRestrictionKind.VALUE)
        || ((value.getIndividualIri() != null || value.getLiteral() != null)
            && kind != OntologyRestrictionKind.VALUE);
  }
}
