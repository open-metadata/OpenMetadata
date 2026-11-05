package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.ontology.NativeOntologyCsvCodec.CELL_FORMAT;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.jena.datatypes.TypeMapper;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.riot.out.NodeFmtLib;
import org.apache.jena.shared.JenaException;
import org.apache.jena.sparql.util.NodeFactoryExtra;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyCsvCodec.Column;

/** The syntax of one cell, read and written the same way for every column that uses it. */
final class NativeOntologyCsvCells {
  static final String LITERAL_SYNTAX =
      "a literal uses N-Triples syntax, for example \"red\" or \"4\"^^<"
          + XSD.integer.getURI()
          + ">";
  private static final String XSD_STRING = XSD.xstring.getURI();
  private static final char MAPPING_SEPARATOR = ':';
  private static final ObjectReader EXPRESSIONS_READER =
      JsonUtils.getObjectMapper()
          .readerFor(new TypeReference<List<OntologyExpression>>() {})
          .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
          .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

  private NativeOntologyCsvCells() {}

  record Cell(int row, Column column, String text) {
    BadRequestException invalid(final String reason) {
      return new BadRequestException(
          "CSV row " + row + ", column " + column.header() + ": " + reason);
    }
  }

  /** The items of a multi-value cell, which is one {@code ;}-delimited RFC 4180 record. */
  static List<String> items(final Cell cell) {
    if (cell.text().isEmpty()) {
      return List.of();
    }
    final List<CSVRecord> records = records(cell);
    if (records.size() != 1) {
      throw cell.invalid(
          "a multi-value cell is one line; quote an item that contains a line break");
    }
    final List<String> items = records.getFirst().toList();
    if (items.stream().anyMatch(String::isEmpty)) {
      throw cell.invalid("an empty item is not allowed");
    }
    return items;
  }

  private static List<CSVRecord> records(final Cell cell) {
    try (CSVParser parser = CSVParser.parse(cell.text(), CELL_FORMAT)) {
      return parser.getRecords();
    } catch (IOException exception) {
      throw cell.invalid("malformed quoting: " + exception.getMessage());
    } catch (UncheckedIOException exception) {
      throw cell.invalid("malformed quoting: " + exception.getCause().getMessage());
    }
  }

  static String join(final List<String> items) {
    return items.isEmpty() ? "" : CELL_FORMAT.format(items.toArray());
  }

  static URI iri(final Cell cell) {
    return iri(cell, cell.text());
  }

  static URI iri(final Cell cell, final String text) {
    try {
      final URI iri = new URI(text);
      if (!iri.isAbsolute()) {
        throw cell.invalid("'" + text + "' is not an absolute IRI");
      }
      return iri;
    } catch (java.net.URISyntaxException exception) {
      throw cell.invalid("'" + text + "' is not an absolute IRI");
    }
  }

  /** Enums use their schema names, which the generated {@code toString()} returns. */
  static <E extends Enum<E>> E enumValue(final Cell cell, final String text, final Class<E> type) {
    return Arrays.stream(type.getEnumConstants())
        .filter(value -> value.toString().equals(text))
        .findFirst()
        .orElseThrow(
            () ->
                cell.invalid(
                    "unknown value '"
                        + text
                        + "'; expected one of "
                        + Arrays.toString(type.getEnumConstants())));
  }

  static ConceptMapping mapping(final Cell cell, final String item) {
    final int separator = item.indexOf(MAPPING_SEPARATOR);
    if (separator < 0) {
      throw cell.invalid("mapping '" + item + "' must be TYPE:iri");
    }
    return new ConceptMapping()
        .withMappingType(
            enumValue(cell, item.substring(0, separator), ConceptMapping.ConceptMappingType.class))
        .withConceptIri(iri(cell, item.substring(separator + 1)));
  }

  static String mapping(final ConceptMapping mapping) {
    return mapping.getMappingType() + String.valueOf(MAPPING_SEPARATOR) + mapping.getConceptIri();
  }

  static OntologyLiteral literal(final Cell cell, final String text) {
    if (!text.startsWith("\"")) {
      throw cell.invalid(LITERAL_SYNTAX);
    }
    final Node node = node(cell, text);
    if (!node.getLiteralLanguage().isEmpty()) {
      throw cell.invalid("language-tagged literals cannot be represented in native ontologies");
    }
    final String datatype = node.getLiteralDatatypeURI();
    return new OntologyLiteral()
        .withValue(node.getLiteralLexicalForm())
        .withDatatypeIri(
            datatype == null || XSD_STRING.equals(datatype) ? null : iri(cell, datatype));
  }

  private static Node node(final Cell cell, final String text) {
    try {
      return NodeFactoryExtra.parseNode(text);
    } catch (JenaException exception) {
      throw cell.invalid("malformed N-Triples literal: " + exception.getMessage());
    }
  }

  static String literal(final OntologyLiteral literal) {
    final Node node =
        literal.getDatatypeIri() == null
            ? NodeFactory.createLiteralString(literal.getValue())
            : NodeFactory.createLiteralDT(
                literal.getValue(),
                TypeMapper.getInstance().getSafeTypeByName(literal.getDatatypeIri().toString()));
    return NodeFmtLib.strNT(node);
  }

  static List<OntologyExpression> expressions(final Cell cell) {
    try {
      final List<OntologyExpression> expressions = EXPRESSIONS_READER.readValue(cell.text());
      if (expressions == null) {
        throw cell.invalid("malformed JSON: expected an array of expressions");
      }
      expressions.forEach(NativeOntologyCsvCells::normalizeLiterals);
      return expressions;
    } catch (UnrecognizedPropertyException exception) {
      throw cell.invalid("unknown expression property '" + exception.getPropertyName() + "'");
    } catch (JsonProcessingException exception) {
      throw cell.invalid("malformed JSON: " + exception.getOriginalMessage());
    }
  }

  /** The RDF reader drops {@code xsd:string} datatypes, so the CSV reader must too. */
  private static void normalizeLiterals(final OntologyExpression expression) {
    if (expression == null) {
      return;
    }
    final OntologyLiteral literal = expression.getLiteral();
    if (literal != null
        && literal.getDatatypeIri() != null
        && XSD_STRING.equals(literal.getDatatypeIri().toString())) {
      literal.setDatatypeIri(null);
    }
    listOrEmpty(expression.getOperands()).forEach(NativeOntologyCsvCells::normalizeLiterals);
    normalizeLiterals(expression.getFiller());
  }

  static String expressions(final List<OntologyExpression> expressions) {
    final JsonNode tree = JsonUtils.getObjectMapper().valueToTree(expressions);
    pruneEmptyArrays(tree);
    return tree.toString();
  }

  /** Generated expressions hold empty operand lists; the canonical JSON leaves them out. */
  private static void pruneEmptyArrays(final JsonNode node) {
    if (node instanceof ObjectNode object) {
      final List<String> empty = new ArrayList<>();
      object
          .fieldNames()
          .forEachRemaining(
              name -> {
                final JsonNode value = object.get(name);
                if (value.isArray() && value.isEmpty()) {
                  empty.add(name);
                } else {
                  pruneEmptyArrays(value);
                }
              });
      object.remove(empty);
    } else if (node instanceof ArrayNode array) {
      array.forEach(NativeOntologyCsvCells::pruneEmptyArrays);
    }
  }
}
