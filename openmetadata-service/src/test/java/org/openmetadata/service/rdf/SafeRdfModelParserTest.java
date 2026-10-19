package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Collections;
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
}
