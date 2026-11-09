package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyPropertyKind;

class OntologyPropertyRulesTest {
  private static final URI PROPERTY = URI.create("https://example.org/knows");
  private static final URI PARENT = URI.create("https://example.org/relatedTo");

  @Test
  void superpropertiesAreDistinctAbsoluteIrisOtherThanThePropertyItself() {
    assertNull(violation(List.of(PARENT, URI.create("https://example.org/linkedTo"))));
    assertEquals(
        new OntologyPropertyRules.Violation(
            "superProperties", "Ontology superProperties must be an absolute IRI"),
        violation(List.of(URI.create("relative"))));
    assertEquals(
        new OntologyPropertyRules.Violation(
            "superProperties", "superProperties requires unique IRIs"),
        violation(List.of(PARENT, PARENT)));
    assertEquals(
        new OntologyPropertyRules.Violation(
            "superProperties", "A property cannot be its own superproperty"),
        violation(List.of(PARENT, PROPERTY)));
  }

  @Test
  void everyPropertyKindMayNameSuperproperties() {
    for (final OntologyPropertyKind kind : OntologyPropertyKind.values()) {
      final OntologyProperty property =
          new OntologyProperty()
              .withIri(PROPERTY)
              .withKind(kind)
              .withSuperProperties(List.of(PARENT));
      assertNull(OntologyPropertyRules.firstViolation(property, () -> false), kind.toString());
    }
  }

  private static OntologyPropertyRules.Violation violation(final List<URI> superProperties) {
    return OntologyPropertyRules.firstViolation(
        new OntologyProperty()
            .withIri(PROPERTY)
            .withKind(OntologyPropertyKind.OBJECT)
            .withSuperProperties(superProperties),
        () -> false);
  }
}
