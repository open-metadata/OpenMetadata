package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.shacl.ValidationReport;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RdfShaclValidatorTest {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String BASE = "https://open-metadata.org/";

  @Test
  @DisplayName("A column-lineage edge whose om:fromColumn is a string literal violates the shape")
  void testColumnLineageRejectsLiteralFromColumn() {
    Model model = ModelFactory.createDefaultModel();
    Resource lineage = model.createResource(BASE + "lineageDetails/x/y/colLineage/1");
    lineage.addProperty(RDF.type, model.createResource(OM_NS + "ColumnLineage"));
    // Wrong: literal where the shape requires om:Column.
    lineage.addProperty(model.createProperty(OM_NS, "fromColumn"), "service.db.s.t.col_a");
    lineage.addProperty(
        model.createProperty(OM_NS, "toColumn"),
        model.createResource(BASE + "entity/column/service.db.s.target.col_b"));

    ValidationReport report = RdfShaclValidator.validate(model);
    assertFalse(
        report.conforms(),
        "Literal om:fromColumn should violate ColumnLineageShape (om:Column class constraint)");
  }

  @Test
  @DisplayName("Properly-shaped column-lineage with URI references conforms")
  void testColumnLineageAcceptsUriReferences() {
    Model model = ModelFactory.createDefaultModel();
    Resource fromCol = model.createResource(BASE + "entity/column/service.db.s.t.col_a");
    fromCol.addProperty(RDF.type, model.createResource(OM_NS + "Column"));
    fromCol.addProperty(model.createProperty(OM_NS, "fullyQualifiedName"), "service.db.s.t.col_a");
    fromCol.addProperty(RDFS.label, "col_a");

    Resource toCol = model.createResource(BASE + "entity/column/service.db.s.target.col_b");
    toCol.addProperty(RDF.type, model.createResource(OM_NS + "Column"));
    toCol.addProperty(
        model.createProperty(OM_NS, "fullyQualifiedName"), "service.db.s.target.col_b");
    toCol.addProperty(RDFS.label, "col_b");

    Resource lineage = model.createResource(BASE + "lineageDetails/x/y/colLineage/1");
    lineage.addProperty(RDF.type, model.createResource(OM_NS + "ColumnLineage"));
    lineage.addProperty(model.createProperty(OM_NS, "fromColumn"), fromCol);
    lineage.addProperty(model.createProperty(OM_NS, "toColumn"), toCol);
    lineage.addProperty(model.createProperty(OM_NS, "fromColumnFqn"), "service.db.s.t.col_a");
    lineage.addProperty(model.createProperty(OM_NS, "toColumnFqn"), "service.db.s.target.col_b");

    ValidationReport report = RdfShaclValidator.validate(model);
    assertTrue(
        report.conforms(),
        "URI-based column lineage with both endpoints typed as om:Column should conform: "
            + reportSummary(report));
  }

  @Test
  @DisplayName("A TableConstraint missing constraintType violates TableConstraintShape")
  void testTableConstraintRequiresType() {
    Model model = ModelFactory.createDefaultModel();
    Resource constraint = model.createResource(BASE + "entity/table/t/constraint/0");
    constraint.addProperty(RDF.type, model.createResource(OM_NS + "TableConstraint"));
    Resource col = model.createResource(BASE + "entity/column/service.db.s.t.id");
    col.addProperty(RDF.type, model.createResource(OM_NS + "Column"));
    col.addProperty(model.createProperty(OM_NS, "fullyQualifiedName"), "service.db.s.t.id");
    col.addProperty(RDFS.label, "id");
    constraint.addProperty(model.createProperty(OM_NS, "hasConstrainedColumn"), col);

    ValidationReport report = RdfShaclValidator.validate(model);
    assertFalse(
        report.conforms(),
        "TableConstraint without om:constraintType should violate TableConstraintShape minCount=1");
  }

  @Test
  @DisplayName("GlossaryTerm without skos:inScheme violates GlossaryTermShape")
  void testGlossaryTermRequiresInScheme() {
    Model model = ModelFactory.createDefaultModel();
    Resource term = model.createResource(BASE + "entity/glossaryTerm/123");
    term.addProperty(RDF.type, model.createResource(OM_NS + "GlossaryTerm"));
    term.addProperty(RDFS.label, "Customer");
    term.addProperty(model.createProperty(OM_NS, "fullyQualifiedName"), "BusinessTerms.Customer");

    ValidationReport report = RdfShaclValidator.validate(model);
    assertFalse(
        report.conforms(),
        "GlossaryTerm missing skos:inScheme must be flagged so we surface broken glossary memberships");
  }

  private static String reportSummary(ValidationReport report) {
    StringBuilder sb = new StringBuilder();
    report.getEntries().forEach(e -> sb.append(e).append("\n"));
    return sb.toString();
  }
}
