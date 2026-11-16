package org.openmetadata.service.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.enumProperty;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.property;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.term;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EffectiveGlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;

class GlossaryTermPropertyResolverTest {
  private final GlossaryTerm customer =
      term(
          "G.Customer",
          List.of(
              enumProperty("regulatoryScope", true, true, "GDPR", "CCPA"),
              property("retentionDays", GlossaryTermPropertyDatatype.INTEGER)
                  .withInheritable(false)),
          Map.of("regulatoryScope", List.of("GDPR"), "retentionDays", List.of("365")));
  private final GlossaryTerm email = term("G.Customer.Email", null, null);
  private final GlossaryTerm work = term("G.Customer.Email.Work", null, null);
  private final GlossaryTerm phone =
      term("G.Customer.Phone", null, Map.of("regulatoryScope", List.of("CCPA")));
  private final GlossaryTerm mobile =
      term("G.Customer.Phone.Mobile", null, Map.of("regulatoryScope", List.of()));

  @Test
  void termWithNoEntryInheritsTheNearestEntryUpToTheDeclaringTerm() {
    final List<EffectiveGlossaryTermProperty> effective =
        GlossaryTermPropertyResolver.resolve(work, List.of(email, customer));

    assertEquals(1, effective.size());
    final EffectiveGlossaryTermProperty scope = effective.getFirst();
    assertEquals("regulatoryScope", scope.getProperty().getName());
    assertTrue(scope.getInherited());
    assertEquals(List.of("GDPR"), scope.getValues());
    assertEquals("G.Customer", scope.getDeclaredBy().getFullyQualifiedName());
    assertEquals("G.Customer", scope.getValuesFrom().getFullyQualifiedName());
  }

  @Test
  void nonInheritablePropertyStaysOnTheDeclaringTerm() {
    final List<String> onCustomer =
        GlossaryTermPropertyResolver.resolve(customer, List.of()).stream()
            .map(entry -> entry.getProperty().getName())
            .toList();
    final List<String> onEmail =
        GlossaryTermPropertyResolver.resolve(email, List.of(customer)).stream()
            .map(entry -> entry.getProperty().getName())
            .toList();

    assertEquals(List.of("regulatoryScope", "retentionDays"), onCustomer);
    assertEquals(List.of("regulatoryScope"), onEmail);
  }

  @Test
  void ownEntryOverridesTheInheritedOne() {
    final EffectiveGlossaryTermProperty scope =
        GlossaryTermPropertyResolver.resolve(phone, List.of(customer)).getFirst();

    assertEquals(List.of("CCPA"), scope.getValues());
    assertEquals("G.Customer.Phone", scope.getValuesFrom().getFullyQualifiedName());
    assertTrue(scope.getInherited());
  }

  @Test
  void emptyListIsAnEntryThatClearsTheValue() {
    final EffectiveGlossaryTermProperty scope =
        GlossaryTermPropertyResolver.resolve(mobile, List.of(phone, customer)).getFirst();

    assertEquals(List.of(), scope.getValues());
    assertEquals("G.Customer.Phone.Mobile", scope.getValuesFrom().getFullyQualifiedName());
  }

  @Test
  void termBelowAnEmptyListInheritsTheAbsence() {
    final GlossaryTerm leaf = term("G.Customer.Phone.Mobile.Work", null, null);

    final EffectiveGlossaryTermProperty scope =
        GlossaryTermPropertyResolver.resolve(leaf, List.of(mobile, phone, customer)).getFirst();

    assertEquals(List.of(), scope.getValues());
    assertEquals("G.Customer.Phone.Mobile", scope.getValuesFrom().getFullyQualifiedName());
  }

  @Test
  void ownPropertyWithNoEntryHasNoValueAndNoSource() {
    final GlossaryTerm bare =
        term("G.Bare", List.of(property("note", GlossaryTermPropertyDatatype.STRING)), null);

    final EffectiveGlossaryTermProperty note =
        GlossaryTermPropertyResolver.resolve(bare, List.of()).getFirst();

    assertEquals(List.of(), note.getValues());
    assertNull(note.getValuesFrom());
    assertEquals(false, note.getInherited());
  }

  @Test
  void entryOnATermAboveTheDeclaringTermIsIgnored() {
    final GlossaryTerm root = term("G.Root", null, Map.of("regulatoryScope", List.of("CCPA")));
    final GlossaryTerm declaring =
        term(
            "G.Root.Mid",
            List.of(enumProperty("regulatoryScope", true, true, "GDPR", "CCPA")),
            null);
    final GlossaryTerm leaf = term("G.Root.Mid.Leaf", null, null);

    final EffectiveGlossaryTermProperty scope =
        GlossaryTermPropertyResolver.resolve(leaf, List.of(declaring, root)).getFirst();

    assertEquals(List.of(), scope.getValues());
    assertNull(scope.getValuesFrom());
  }

  @Test
  void nearestDefinitionWinsWhenTwoShareAName() {
    final GlossaryTerm farther =
        term("G.A", List.of(property("tier", GlossaryTermPropertyDatatype.STRING)), null);
    final GlossaryTerm nearer =
        term("G.A.B", List.of(property("Tier", GlossaryTermPropertyDatatype.INTEGER)), null);
    final GlossaryTerm leaf = term("G.A.B.C", null, null);

    final List<EffectiveGlossaryTermProperty> effective =
        GlossaryTermPropertyResolver.resolve(leaf, List.of(nearer, farther));

    assertEquals(1, effective.size());
    assertEquals("G.A.B", effective.getFirst().getDeclaredBy().getFullyQualifiedName());
  }

  @Test
  void ownDefinitionsComeFirstInDeclaredOrderThenAncestorsNearestFirst() {
    final GlossaryTerm top =
        term("G.T", List.of(property("fromTop", GlossaryTermPropertyDatatype.STRING)), null);
    final GlossaryTerm middle =
        term("G.T.M", List.of(property("fromMiddle", GlossaryTermPropertyDatatype.STRING)), null);
    final GlossaryTerm own =
        term(
            "G.T.M.L",
            List.of(
                property("z", GlossaryTermPropertyDatatype.STRING),
                property("a", GlossaryTermPropertyDatatype.STRING)),
            null);

    final List<String> names =
        GlossaryTermPropertyResolver.resolve(own, List.of(middle, top)).stream()
            .map(entry -> entry.getProperty().getName())
            .toList();

    assertEquals(List.of("z", "a", "fromMiddle", "fromTop"), names);
  }
}
