package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RdfIriValidatorTest {

  @Test
  @DisplayName("A well-formed http(s) entity IRI is accepted and returned trimmed")
  void acceptsHierarchicalHttpIri() {
    String iri = "https://open-metadata.org/entity/table/1a2b";
    assertEquals(iri, RdfIriValidator.validateEntityIri(iri));
    assertEquals(iri, RdfIriValidator.validateEntityIri("  " + iri + "  "));
    assertEquals(
        "http://host/entity/table/1a2b",
        RdfIriValidator.validateEntityIri("http://host/entity/table/1a2b"));
  }

  @Test
  @DisplayName("An opaque http(s) URI without an authority/host is rejected")
  void rejectsOpaqueHttpIri() {
    assertNull(RdfIriValidator.validateEntityIri("https:foo"));
    assertNull(RdfIriValidator.validateEntityIri("http:some/path"));
  }

  @Test
  @DisplayName("Non-http schemes and relative references are rejected")
  void rejectsNonHttpAndRelative() {
    assertNull(RdfIriValidator.validateEntityIri("urn:example:foo"));
    assertNull(RdfIriValidator.validateEntityIri("ftp://host/x"));
    assertNull(RdfIriValidator.validateEntityIri("/entity/table/1a2b"));
    assertNull(RdfIriValidator.validateEntityIri("open-metadata.org/entity/table/1a2b"));
  }

  @Test
  @DisplayName("SPARQL-breaking characters and blanks are rejected")
  void rejectsUnsafeAndBlank() {
    assertNull(RdfIriValidator.validateEntityIri(null));
    assertNull(RdfIriValidator.validateEntityIri("   "));
    assertNull(RdfIriValidator.validateEntityIri("https://host/x>y"));
    assertNull(RdfIriValidator.validateEntityIri("https://host/x y"));
    assertNull(RdfIriValidator.validateEntityIri("https://host/a\"b"));
  }

  @Test
  @DisplayName("sanitizeStoredIri allows non-http schemes but still blocks unsafe characters")
  void sanitizeStoredIriAllowsUrn() {
    assertEquals("urn:example:foo", RdfIriValidator.sanitizeStoredIri("urn:example:foo"));
    assertNull(RdfIriValidator.sanitizeStoredIri("urn:example:foo>"));
  }
}
