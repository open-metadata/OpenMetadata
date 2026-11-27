package org.openmetadata.service.rdf.translator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Projects a table's keys. Each declared constraint, and a primary key stated only through
 * column-level PRIMARY_KEY markers on several columns, is one {@code om:TableConstraint} whose
 * {@code om:ConstraintMember}s carry their position, so a composite key keeps its column order and
 * a composite foreign key pairs each column with its referred column. A column is {@code
 * om:isUnique} only when it is unique on its own
 * (ADR:2026-11-13-column-uniqueness-means-the-column-alone-is-unique).
 */
final class RdfTableKeyMapper {
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PRIMARY_KEY = "PRIMARY_KEY";
  private static final String UNIQUE = "UNIQUE";
  private static final String FOREIGN_KEY = "FOREIGN_KEY";
  private static final String CONSTRAINT_TYPE = "constraintType";
  private static final String TABLE_CONSTRAINTS = "tableConstraints";
  private static final String MEMBER_SEGMENT = "/member/";

  private final String baseUri;

  RdfTableKeyMapper(final String baseUri) {
    this.baseUri = baseUri;
  }

  /** A constraint with its column FQNs resolved, as the JSON declares it. */
  private record Key(
      String type, List<String> columns, List<String> referredColumns, String relationshipType) {
    static Key of(final JsonNode constraint, final String tableFqn) {
      return new Key(
          constraint.get(CONSTRAINT_TYPE).asText(),
          texts(constraint.get("columns")).stream()
              .map(name -> FullyQualifiedName.add(tableFqn, name))
              .toList(),
          texts(constraint.get("referredColumns")),
          constraint.hasNonNull("relationshipType")
              ? constraint.get("relationshipType").asText()
              : null);
    }

    boolean isPrimaryKey() {
      return PRIMARY_KEY.equals(type);
    }

    boolean isKey() {
      return isPrimaryKey() || UNIQUE.equals(type);
    }
  }

  void emitDeclared(
      final JsonNode constraints, final String tableFqn, final Resource table, final Model model) {
    if (!nullOrEmpty(tableFqn)) {
      int index = 0;
      for (final JsonNode constraint : constraints) {
        if (isDeclaration(constraint)) {
          final Key key = Key.of(constraint, tableFqn);
          emitKey(key, constraintUri(table, key.type(), index), table, model);
        }
        index++;
      }
    }
  }

  /**
   * A table has one primary key, so PRIMARY_KEY markers on several columns state one composite key
   * over them, in column order, unless a table constraint declares the primary key. A member of a
   * composite primary key keeps the uniqueness its column-level marker gave it only when a key of
   * its own also makes it unique.
   */
  void emitColumnLevelKey(
      final JsonNode entityJson, final String tableFqn, final Resource table, final Model model) {
    if (!nullOrEmpty(tableFqn)) {
      final List<Key> declared = declaredKeys(entityJson, tableFqn);
      final List<String> markedPrimary = markedColumns(entityJson, PRIMARY_KEY);
      if (markedPrimary.size() > 1 && declared.stream().noneMatch(Key::isPrimaryKey)) {
        emitKey(
            new Key(PRIMARY_KEY, markedPrimary, List.of(), null),
            constraintUri(table, PRIMARY_KEY, declarationCount(entityJson)),
            table,
            model);
      }
      retractSharedUniqueness(entityJson, declared, markedPrimary, model);
    }
  }

  private void emitKey(final Key key, final String uri, final Resource table, final Model model) {
    final Resource constraint = model.createResource(uri);
    constraint.addProperty(RDF.type, model.createResource(OM_NS + "TableConstraint"));
    constraint.addProperty(model.createProperty(OM_NS, "constraintType"), key.type());
    table.addProperty(model.createProperty(OM_NS, "hasConstraint"), constraint);
    if (key.relationshipType() != null) {
      constraint.addProperty(
          model.createProperty(OM_NS, "relationshipType"), key.relationshipType());
    }
    final List<Resource> columns = columnResources(key.columns(), model, true);
    final List<Resource> referred =
        FOREIGN_KEY.equals(key.type())
            ? columnResources(key.referredColumns(), model, false)
            : List.of();
    columns.forEach(
        column ->
            constraint.addProperty(model.createProperty(OM_NS, "hasConstrainedColumn"), column));
    referred.forEach(
        column -> constraint.addProperty(model.createProperty(OM_NS, "hasReferredColumn"), column));
    final List<Resource> pairedColumns = columns.size() == referred.size() ? referred : List.of();
    emitMembers(constraint, columns, pairedColumns, model);
    flagColumns(key, columns, model);
  }

  /** Members are numbered from 1 in declared order. Only complete pairings state join edges. */
  private static void emitMembers(
      final Resource constraint,
      final List<Resource> columns,
      final List<Resource> referred,
      final Model model) {
    final Property hasMember = model.createProperty(OM_NS, "hasConstraintMember");
    final Property references = model.createProperty(OM_NS, "references");
    for (int index = 0; index < columns.size(); index++) {
      final Resource member =
          model.createResource(constraint.getURI() + MEMBER_SEGMENT + (index + 1));
      member.addProperty(RDF.type, model.createResource(OM_NS + "ConstraintMember"));
      member.addProperty(
          model.createProperty(OM_NS, "memberPosition"), model.createTypedLiteral(index + 1));
      final Resource column = columns.get(index);
      member.addProperty(model.createProperty(OM_NS, "memberColumn"), column);
      if (!referred.isEmpty()) {
        final Resource target = referred.get(index);
        member.addProperty(model.createProperty(OM_NS, "memberReferredColumn"), target);
        column.addProperty(references, target);
      }
      constraint.addProperty(hasMember, member);
    }
  }

  private static void flagColumns(final Key key, final List<Resource> columns, final Model model) {
    for (final Resource column : columns) {
      if (key.isPrimaryKey()) {
        column.addLiteral(model.createProperty(OM_NS, "isPrimaryKey"), true);
        column.addLiteral(model.createProperty(OM_NS, "isNullable"), false);
      }
      if (columns.size() == 1 && key.isKey()) {
        column.addLiteral(model.createProperty(OM_NS, "isUnique"), true);
      }
    }
  }

  private void retractSharedUniqueness(
      final JsonNode entityJson,
      final List<Key> declared,
      final List<String> markedPrimary,
      final Model model) {
    final Set<String> shared = new HashSet<>(markedPrimary.size() > 1 ? markedPrimary : List.of());
    declared.stream()
        .filter(key -> key.isPrimaryKey() && key.columns().size() > 1)
        .forEach(key -> shared.addAll(key.columns()));
    shared.removeAll(markedColumns(entityJson, UNIQUE));
    declared.stream()
        .filter(key -> key.isKey() && key.columns().size() == 1)
        .forEach(key -> shared.removeAll(key.columns()));
    final Property isUnique = model.createProperty(OM_NS, "isUnique");
    shared.forEach(
        fqn ->
            model.removeAll(
                model.createResource(RdfUtils.columnUri(baseUri, fqn)), isUnique, null));
  }

  private List<Resource> columnResources(
      final List<String> fqns, final Model model, final boolean declare) {
    return fqns.stream()
        .map(fqn -> columnResource(fqn, model, declare))
        .filter(Objects::nonNull)
        .toList();
  }

  private Resource columnResource(
      final String columnFqn, final Model model, final boolean declare) {
    final String columnUri = RdfUtils.columnUri(baseUri, columnFqn);
    final Resource column = columnUri == null ? null : model.createResource(columnUri);
    if (column != null && declare) {
      column.addProperty(RDF.type, model.createResource(OM_NS + "Column"));
      column.addProperty(model.createProperty(OM_NS, "fullyQualifiedName"), columnFqn);
    }
    return column;
  }

  private static List<Key> declaredKeys(final JsonNode entityJson, final String tableFqn) {
    final List<Key> keys = new ArrayList<>();
    RdfJsonNode.array(entityJson, TABLE_CONSTRAINTS)
        .ifPresent(
            constraints ->
                constraints.forEach(
                    constraint -> {
                      if (isDeclaration(constraint)) {
                        keys.add(Key.of(constraint, tableFqn));
                      }
                    }));
    return keys;
  }

  private static int declarationCount(final JsonNode entityJson) {
    return RdfJsonNode.array(entityJson, TABLE_CONSTRAINTS).map(JsonNode::size).orElse(0);
  }

  /** The FQNs of the top-level columns carrying the column-level {@code constraint}, in order. */
  private static List<String> markedColumns(final JsonNode entityJson, final String constraint) {
    final List<String> fqns = new ArrayList<>();
    RdfJsonNode.array(entityJson, "columns")
        .ifPresent(
            columns ->
                columns.forEach(
                    column -> {
                      if (constraint.equals(column.path("constraint").asText())
                          && column.hasNonNull("fullyQualifiedName")) {
                        fqns.add(column.get("fullyQualifiedName").asText());
                      }
                    }));
    return fqns;
  }

  private static boolean isDeclaration(final JsonNode constraint) {
    return constraint.isObject() && constraint.has(CONSTRAINT_TYPE);
  }

  private static List<String> texts(final JsonNode values) {
    final List<String> texts = new ArrayList<>();
    if (values != null && values.isArray()) {
      values.forEach(
          value -> {
            if (value.isTextual()) {
              texts.add(value.asText());
            }
          });
    }
    return texts;
  }

  private static String constraintUri(final Resource table, final String type, final int index) {
    return table.getURI() + "/constraint/" + type + "/" + index;
  }
}
