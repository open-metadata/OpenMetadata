package org.openmetadata.service.rdf.extension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.CustomOntology;
import org.openmetadata.schema.api.configuration.rdf.CustomOntologyClass;
import org.openmetadata.schema.api.configuration.rdf.CustomOntologyProperty;

class CustomOntologyValidatorTest {

  private static final String EXT_NS = "https://open-metadata.org/ontology-extension/";

  private static CustomOntologyClass cls(String localName, String... parents) {
    return new CustomOntologyClass()
        .withUri(EXT_NS + localName)
        .withSubClassOf(java.util.List.of(parents));
  }

  private static CustomOntologyProperty objProp(String localName, String domain, String range) {
    return new CustomOntologyProperty()
        .withUri(EXT_NS + localName)
        .withType(CustomOntologyProperty.Type.OBJECT_PROPERTY)
        .withDomain(domain)
        .withRange(range);
  }

  private static CustomOntologyProperty datatypeProp(
      String localName, String domain, String range) {
    return new CustomOntologyProperty()
        .withUri(EXT_NS + localName)
        .withType(CustomOntologyProperty.Type.DATATYPE_PROPERTY)
        .withDomain(domain)
        .withRange(range);
  }

  private static CustomOntology ext(String name) {
    return new CustomOntology().withName(name);
  }

  @Nested
  @DisplayName("Required fields and shape")
  class RequiredFieldsAndShape {

    @Test
    @DisplayName("Null extension is rejected")
    void nullExtension() {
      assertTrue(
          CustomOntologyValidator.validate(null).stream()
              .anyMatch(e -> e.contains("must not be null")));
    }

    @Test
    @DisplayName("Blank name is rejected")
    void blankName() {
      assertTrue(
          CustomOntologyValidator.validate(ext("")).stream()
              .anyMatch(e -> e.contains("'name' must not be blank")));
    }

    @Test
    @DisplayName("Name with uppercase is rejected")
    void uppercaseName() {
      assertTrue(
          CustomOntologyValidator.validate(ext("MyExtension")).stream()
              .anyMatch(e -> e.contains("name") && e.contains("lowercase")));
    }

    @Test
    @DisplayName("Extension with no classes and no properties is rejected")
    void emptyExtension() {
      List<String> errors = CustomOntologyValidator.validate(ext("empty-ext"));
      assertTrue(errors.stream().anyMatch(e -> e.contains("at least one class or property")));
    }
  }

  @Nested
  @DisplayName("Namespace enforcement")
  class NamespaceEnforcement {

    @Test
    @DisplayName("Class URI in canonical om: namespace is rejected (cannot redefine)")
    void canonicalNamespaceClassRejected() {
      CustomOntology e =
          ext("redefine-table")
              .withClasses(
                  List.of(
                      new CustomOntologyClass()
                          .withUri("https://open-metadata.org/ontology/Table")
                          .withSubClassOf(List.of("https://open-metadata.org/ontology/Entity"))));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(
                  err -> err.contains("om-extension namespace") && err.contains("ontology/Table")));
    }

    @Test
    @DisplayName("Property URI outside om-extension namespace is rejected")
    void canonicalNamespacePropertyRejected() {
      CustomOntology e =
          ext("bad-prop")
              .withClasses(List.of(cls("Foo", "om:Entity")))
              .withProperties(
                  List.of(
                      new CustomOntologyProperty()
                          .withUri("https://example.org/somewhere")
                          .withType(CustomOntologyProperty.Type.OBJECT_PROPERTY)
                          .withDomain(EXT_NS + "Foo")
                          .withRange("om:Entity")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("om-extension namespace")));
    }
  }

  @Nested
  @DisplayName("Class hierarchy checks")
  class ClassHierarchy {

    @Test
    @DisplayName("Class without subClassOf is rejected")
    void classNeedsParent() {
      CustomOntologyClass orphan = new CustomOntologyClass().withUri(EXT_NS + "Orphan");
      CustomOntology e = ext("orphan-ext").withClasses(List.of(orphan));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("must declare at least one subClassOf parent")));
    }

    @Test
    @DisplayName("Class referencing unknown canonical parent is rejected")
    void unknownCanonicalParentRejected() {
      CustomOntology e =
          ext("unknown-parent")
              .withClasses(
                  List.of(cls("Widget", "https://open-metadata.org/ontology/NonexistentClass")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("unknown parent class")));
    }

    @Test
    @DisplayName("Class referencing canonical om: short-form parent is accepted")
    void shortFormCanonicalParent() {
      CustomOntology e = ext("short-form").withClasses(List.of(cls("Widget", "om:DataAsset")));
      assertTrue(CustomOntologyValidator.validate(e).isEmpty());
    }

    @Test
    @DisplayName("Class referencing another class in the same extension is accepted")
    void siblingExtensionClassReference() {
      CustomOntology e =
          ext("siblings")
              .withClasses(List.of(cls("Parent", "om:Entity"), cls("Child", EXT_NS + "Parent")));
      List<String> errors = CustomOntologyValidator.validate(e);
      assertTrue(errors.isEmpty(), "Got: " + errors);
    }

    @Test
    @DisplayName("Forward reference to a sibling declared later in the list is accepted")
    void forwardSiblingReferenceAccepted() {
      // Child is declared BEFORE Parent — parent-existence must not depend on declaration order.
      CustomOntology e =
          ext("forward-ref")
              .withClasses(List.of(cls("Child", EXT_NS + "Parent"), cls("Parent", "om:Entity")));
      List<String> errors = CustomOntologyValidator.validate(e);
      assertTrue(errors.isEmpty(), "Forward references must be accepted; got: " + errors);
    }

    @Test
    @DisplayName("Cycle in class hierarchy is detected (A → B → A)")
    void hierarchyCycleDetected() {
      CustomOntology e =
          ext("cycle").withClasses(List.of(cls("A", EXT_NS + "B"), cls("B", EXT_NS + "A")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("contains a cycle")),
          "Validator must detect 2-node hierarchy cycles");
    }

    @Test
    @DisplayName("Self-referencing class is detected as a cycle")
    void selfCycleDetected() {
      CustomOntology e = ext("self-cycle").withClasses(List.of(cls("Self", EXT_NS + "Self")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("contains a cycle")));
    }

    @Test
    @DisplayName("3-node cycle (A → B → C → A) is detected")
    void threeNodeCycleDetected() {
      CustomOntology e =
          ext("3-cycle")
              .withClasses(
                  List.of(cls("A", EXT_NS + "B"), cls("B", EXT_NS + "C"), cls("C", EXT_NS + "A")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("contains a cycle")));
    }

    @Test
    @DisplayName("Duplicate class URI within the same extension is rejected")
    void duplicateClassUriRejected() {
      CustomOntology e =
          ext("dupes").withClasses(List.of(cls("Same", "om:Entity"), cls("Same", "om:Entity")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("duplicate class URI")));
    }
  }

  @Nested
  @DisplayName("Property checks")
  class PropertyChecks {

    @Test
    @DisplayName("ObjectProperty with unknown domain is rejected")
    void unknownDomainRejected() {
      CustomOntology e =
          ext("unknown-domain")
              .withClasses(List.of(cls("Foo", "om:Entity")))
              .withProperties(
                  List.of(
                      objProp(
                          "rel", "https://open-metadata.org/ontology/NoSuchClass", "om:Entity")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("domain") && err.contains("not a known")));
    }

    @Test
    @DisplayName("ObjectProperty with non-class range is rejected")
    void objectPropertyRangeMustBeClass() {
      CustomOntology e =
          ext("bad-range")
              .withClasses(List.of(cls("Foo", "om:Entity")))
              .withProperties(
                  List.of(
                      objProp("rel", EXT_NS + "Foo", "http://www.w3.org/2001/XMLSchema#string")));
      // ObjectProperty range that is an xsd type is rejected because it's not a known class.
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("range") && err.contains("not a known")));
    }

    @Test
    @DisplayName("DatatypeProperty range must be an xsd: datatype URI")
    void datatypePropertyRequiresXsdRange() {
      CustomOntology e =
          ext("bad-dt-range")
              .withClasses(List.of(cls("Foo", "om:Entity")))
              .withProperties(List.of(datatypeProp("score", EXT_NS + "Foo", EXT_NS + "Foo")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(
                  err -> err.contains("DatatypeProperty") && err.contains("xsd: datatype URI")));
    }

    @Test
    @DisplayName("Valid DatatypeProperty with xsd:string range is accepted")
    void validDatatypeProperty() {
      CustomOntology e =
          ext("valid-dt")
              .withClasses(List.of(cls("Foo", "om:Entity")))
              .withProperties(
                  List.of(
                      datatypeProp(
                          "score", EXT_NS + "Foo", "http://www.w3.org/2001/XMLSchema#string")));
      List<String> errors = CustomOntologyValidator.validate(e);
      assertTrue(errors.isEmpty(), "Got: " + errors);
    }

    @Test
    @DisplayName("Duplicate property URI within the same extension is rejected")
    void duplicatePropertyUri() {
      CustomOntology e =
          ext("dupe-props")
              .withClasses(List.of(cls("Foo", "om:Entity")))
              .withProperties(
                  List.of(
                      objProp("rel", EXT_NS + "Foo", "om:Entity"),
                      objProp("rel", EXT_NS + "Foo", "om:Entity")));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("duplicate property URI")));
    }

    @Test
    @DisplayName("Property with no domain is rejected")
    void missingDomain() {
      CustomOntologyProperty p =
          new CustomOntologyProperty()
              .withUri(EXT_NS + "rel")
              .withType(CustomOntologyProperty.Type.OBJECT_PROPERTY)
              .withRange("om:Entity");
      CustomOntology e =
          ext("no-domain").withClasses(List.of(cls("Foo", "om:Entity"))).withProperties(List.of(p));
      assertTrue(
          CustomOntologyValidator.validate(e).stream()
              .anyMatch(err -> err.contains("missing 'domain'")));
    }
  }

  @Nested
  @DisplayName("Happy path")
  class HappyPath {

    @Test
    @DisplayName("Full valid extension passes validation cleanly")
    void fullValidExtension() {
      CustomOntology e =
          ext("regulatory-controls")
              .withDescription("SOX compliance controls")
              .withClasses(
                  List.of(
                      cls("RegulatoryControl", "om:Entity"),
                      cls("SoxControl", EXT_NS + "RegulatoryControl")))
              .withProperties(
                  List.of(
                      objProp("hasControl", "om:DataAsset", EXT_NS + "RegulatoryControl"),
                      datatypeProp(
                          "controlOwnerEmail",
                          EXT_NS + "RegulatoryControl",
                          "http://www.w3.org/2001/XMLSchema#string")));
      List<String> errors = CustomOntologyValidator.validate(e);
      assertTrue(errors.isEmpty(), "Expected no errors but got: " + errors);
      assertTrue(CustomOntologyValidator.isValid(e));
    }

    @Test
    @DisplayName("Property-only extension (no classes) is accepted")
    void propertyOnlyExtension() {
      CustomOntology e =
          ext("annotations")
              .withProperties(
                  List.of(
                      datatypeProp(
                          "soxRelevant",
                          "om:DataAsset",
                          "http://www.w3.org/2001/XMLSchema#boolean")));
      assertTrue(CustomOntologyValidator.validate(e).isEmpty());
    }
  }

  @Test
  @DisplayName("isValid wrapper returns boolean and logs on failure")
  void isValidWrapper() {
    assertFalse(CustomOntologyValidator.isValid(null));
    assertFalse(CustomOntologyValidator.isValid(ext("empty-test")));
  }
}
