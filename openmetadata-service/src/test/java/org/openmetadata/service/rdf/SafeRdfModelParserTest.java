package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.BadRequestException;

class SafeRdfModelParserTest {
  private final SafeRdfModelParser parser = new SafeRdfModelParser();

  @Test
  void rejectsRelativeJsonLdIdEvenWhenAnotherNodeIsValid() {
    assertThrows(
        BadRequestException.class,
        () ->
            parser.parse(
                """
                [{"@id":"https://example.org/valid","https://example.org/name":"ok"},
                 {"@id":"relative","https://example.org/name":"lost"}]
                """,
                RdfSerializationFormat.JSON_LD));
  }

  @Test
  void rejectsExplicitJsonLdTextDirection() {
    final BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                parser.parse(
                    """
                    {"@id":"urn:example:C","@type":"http://www.w3.org/2002/07/owl#Class",
                     "http://www.w3.org/2000/01/rdf-schema#label":
                       {"@value":"Customer","@language":"en","@direction":"rtl"}}
                    """,
                    RdfSerializationFormat.JSON_LD));
    assertTrue(exception.getMessage().contains("@direction"));
  }

  @Test
  void rejectsContextInheritedJsonLdTextDirection() {
    final BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                parser.parse(
                    """
                    {"@context":{"label":{"@id":"http://www.w3.org/2000/01/rdf-schema#label",
                                          "@language":"en","@direction":"rtl"}},
                     "@id":"urn:example:C","@type":"http://www.w3.org/2002/07/owl#Class",
                     "label":"Customer"}
                    """,
                    RdfSerializationFormat.JSON_LD));
    assertTrue(exception.getMessage().contains("@direction"));
  }

  @Test
  void rejectsLongContextPrefixBeforeJsonLdExpansion() {
    final String data =
        "{\"@context\":{\"p\":\"https://example.org/"
            + "x".repeat(2048)
            + "\"},\"@id\":\"https://example.org/C\",\"p:name\":\"value\"}";
    assertThrows(
        BadRequestException.class, () -> parser.parse(data, RdfSerializationFormat.JSON_LD));
  }

  @Test
  void rejectsChainedContextExpansionBeforeMaterializingIt() {
    final StringBuilder context = new StringBuilder("{\"p0\":\"https://example.org/\"");
    for (int index = 1; index <= 10; index++) {
      context
          .append(",\"p")
          .append(index)
          .append("\":\"p")
          .append(index - 1)
          .append(":")
          .append("x".repeat(1800))
          .append("\"");
    }
    context.append("}");
    final String data =
        "{\"@context\":"
            + context
            + ",\"@graph\":["
            + String.join(",", Collections.nCopies(1000, "{\"@id\":\"p10:x\"}"))
            + "]}";
    assertThrows(
        BadRequestException.class, () -> parser.parse(data, RdfSerializationFormat.JSON_LD));
  }

  @Test
  void rejectsReferencedContextDuringNativeImport() {
    assertThrows(
        BadRequestException.class,
        () ->
            parser.parse(
                "{\"@context\":\"https://open-metadata.org/rdf/contexts/base.jsonld\",\"@id\":\"https://example.org/C\"}",
                RdfSerializationFormat.JSON_LD));
  }

  @Test
  void refusesXmlExternalEntities() {
    assertThrows(
        BadRequestException.class,
        () ->
            parser.parse(
                "<!DOCTYPE rdf:RDF [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><rdf:RDF/>",
                RdfSerializationFormat.RDF_XML));
  }

  @Test
  void parsesAPlainLocalGraph() {
    final var model =
        parser.parse(
            "<https://example.org/a> <https://example.org/p> <https://example.org/b> .",
            RdfSerializationFormat.N_TRIPLES);
    try {
      assertEquals(1, model.size());
    } finally {
      model.close();
    }
  }

  @Test
  void rejectsRelativeTurtleIriWithoutDeclaredBase() {
    assertThrows(
        BadRequestException.class,
        () ->
            parser.parse(
                "<relative> <https://example.org/p> <https://example.org/o> .",
                RdfSerializationFormat.TURTLE));
  }

  @Test
  void rejectsRdfBeyondTheSourceSizeLimit() {
    final String oversized = "x".repeat(SafeRdfModelParser.MAX_INPUT_BYTES + 1);
    final BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () -> parser.parse(oversized, RdfSerializationFormat.TURTLE));
    assertEquals("Native ontology RDF must contain at most 10 MiB of data", exception.getMessage());
  }

  @Test
  void trustedParsingAcceptsChecksummedContentBeyondTheUploadLimits() {
    final String large = triples(250_000);
    assertTrue(large.length() > SafeRdfModelParser.MAX_INPUT_BYTES);
    assertThrows(
        BadRequestException.class, () -> parser.parse(large, RdfSerializationFormat.N_TRIPLES));

    final var model =
        parser.parseTrusted(large, RdfSerializationFormat.N_TRIPLES, DigestUtils.sha256Hex(large));
    try {
      assertEquals(250_000, model.size());
    } finally {
      model.close();
    }
  }

  @Test
  void trustedParsingRefusesContentThatDoesNotMatchItsChecksum() {
    final String data = triples(3);

    final IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                parser.parseTrusted(
                    data, RdfSerializationFormat.N_TRIPLES, DigestUtils.sha256Hex("other")));
    assertEquals("Bundled ontology content does not match its checksum", exception.getMessage());
    assertThrows(
        IllegalStateException.class,
        () -> parser.parseTrusted(data, RdfSerializationFormat.N_TRIPLES, null));
  }

  @Test
  void trustedParsingStillRefusesRelativeIrisDoctypesAndOversizedBundles() {
    final String relative = "<relative> <https://example.org/p> <https://example.org/o> .";
    assertThrows(
        BadRequestException.class,
        () ->
            parser.parseTrusted(
                relative, RdfSerializationFormat.TURTLE, DigestUtils.sha256Hex(relative)));
    final String doctype =
        "<!DOCTYPE rdf:RDF [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><rdf:RDF/>";
    assertThrows(
        BadRequestException.class,
        () ->
            parser.parseTrusted(
                doctype, RdfSerializationFormat.RDF_XML, DigestUtils.sha256Hex(doctype)));
    final String oversized = "x".repeat(SafeRdfModelParser.TRUSTED_MAX_INPUT_BYTES + 1);
    final BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                parser.parseTrusted(
                    oversized, RdfSerializationFormat.TURTLE, DigestUtils.sha256Hex(oversized)));
    assertEquals(
        "Bundled ontology RDF must contain at most 64 MiB of data", exception.getMessage());
  }

  private static String triples(final int count) {
    return IntStream.range(0, count)
        .mapToObj(
            index ->
                "<https://example.org/subject/%d> <https://example.org/predicate> \"value-%d\" ."
                    .formatted(index, index))
        .collect(Collectors.joining("\n"));
  }
}
