package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.STORED_FIELDS;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.glossary;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.op;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.patch;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.property;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.regulatoryScope;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.removeOp;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.retentionDays;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.stored;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.term;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.withEffective;
import static org.openmetadata.it.tests.GlossaryTermPropertyFixtures.withStored;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EffectiveGlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Write rules and resolution of glossary term properties, over the fixture of the design:
 * Customer declares an inheritable multi-valued enum and a local integer, Email and Email.Work
 * store nothing, Phone overrides, and Phone.Mobile clears.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
class GlossaryTermPropertiesIT {
  private final OpenMetadataClient admin = SdkClients.adminClient();

  private record Tree(
      Glossary glossary,
      GlossaryTerm customer,
      GlossaryTerm email,
      GlossaryTerm work,
      GlossaryTerm phone,
      GlossaryTerm mobile) {}

  private Tree tree(TestNamespace ns) {
    Glossary glossary = glossary(ns, "props", null);
    GlossaryTerm customer =
        term(
            glossary,
            null,
            "Customer",
            List.of(regulatoryScope(), retentionDays()),
            Map.of("regulatoryScope", List.of("GDPR"), "retentionDays", List.of("365")));
    GlossaryTerm email = term(glossary, customer, "Email", null, null);
    GlossaryTerm work = term(glossary, email, "Work", null, null);
    GlossaryTerm phone =
        term(glossary, customer, "Phone", null, Map.of("regulatoryScope", List.of("CCPA")));
    GlossaryTerm mobile =
        term(glossary, phone, "Mobile", null, Map.of("regulatoryScope", List.of()));
    return new Tree(glossary, customer, email, work, phone, mobile);
  }

  private static EffectiveGlossaryTermProperty effective(GlossaryTerm term, String name) {
    return term.getEffectiveProperties().stream()
        .filter(entry -> entry.getProperty().getName().equals(name))
        .findFirst()
        .orElse(null);
  }

  @Test
  void termInheritsTheNearestEntryAndNonInheritablePropertiesStayLocal(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm work = withEffective(admin, tree.work());
    EffectiveGlossaryTermProperty scope = effective(work, "regulatoryScope");

    assertEquals(1, work.getEffectiveProperties().size());
    assertTrue(scope.getInherited());
    assertEquals(List.of("GDPR"), scope.getValues());
    assertEquals(
        tree.customer().getFullyQualifiedName(), scope.getDeclaredBy().getFullyQualifiedName());
    assertEquals(
        tree.customer().getFullyQualifiedName(), scope.getValuesFrom().getFullyQualifiedName());
    assertNull(effective(work, "retentionDays"));
  }

  @Test
  void ownEntryOverridesAndEmptyListClears(TestNamespace ns) {
    Tree tree = tree(ns);

    EffectiveGlossaryTermProperty phone =
        effective(withEffective(admin, tree.phone()), "regulatoryScope");
    EffectiveGlossaryTermProperty mobile =
        effective(withEffective(admin, tree.mobile()), "regulatoryScope");

    assertEquals(List.of("CCPA"), phone.getValues());
    assertEquals(
        tree.phone().getFullyQualifiedName(), phone.getValuesFrom().getFullyQualifiedName());
    assertEquals(List.of(), mobile.getValues());
    assertEquals(
        tree.mobile().getFullyQualifiedName(), mobile.getValuesFrom().getFullyQualifiedName());
  }

  @Test
  void defaultReadCarriesNoPropertyFieldsAndAskedFieldsDo(TestNamespace ns) {
    Tree tree = tree(ns);
    String id = tree.customer().getId().toString();

    JsonNode plain = JsonUtils.readTree(rawGet("/v1/glossaryTerms/" + id));
    JsonNode asked =
        JsonUtils.readTree(rawGet("/v1/glossaryTerms/" + id + "?fields=" + STORED_FIELDS));

    assertFalse(
        plain.has("propertyDefinitions")
            || plain.has("propertyValues")
            || plain.has("effectiveProperties"));
    assertEquals(2, asked.get("propertyDefinitions").size());
    assertEquals("365", asked.get("propertyValues").get("retentionDays").get(0).asText());
    assertFalse(asked.has("effectiveProperties"));
  }

  private String rawGet(String path) {
    return admin.getHttpClient().executeForString(HttpMethod.GET, path, null);
  }

  @Test
  void termWithoutPropertiesStoresNoneOfTheFields(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm bare = tree.email();

    String json = GlossaryTermPropertyFixtures.storedJson(bare.getId());

    assertFalse(json.contains("propertyDefinitions"), json);
    assertFalse(json.contains("propertyValues"), json);
    assertFalse(json.contains("effectiveProperties"), json);
    assertNull(withStored(bare).getPropertyDefinitions());
    assertNull(withStored(bare).getPropertyValues());
  }

  @Test
  void invalidValuesAreRejectedWithBadRequest(TestNamespace ns) {
    Tree tree = tree(ns);

    assertThrows(
        InvalidRequestException.class,
        () ->
            patch(
                admin, tree.email(), op("add", "/propertyValues", "{\"retentionDays\":[\"5\"]}")));
    assertThrows(
        InvalidRequestException.class,
        () ->
            patch(admin, tree.customer(), op("add", "/propertyValues/retentionDays", "[\"abc\"]")));
    assertThrows(
        InvalidRequestException.class,
        () ->
            patch(
                admin,
                tree.customer(),
                op("add", "/propertyValues/regulatoryScope", "[\"HIPAA\"]")));
    assertThrows(
        InvalidRequestException.class,
        () ->
            patch(
                admin,
                tree.customer(),
                op("add", "/propertyValues/retentionDays", "[\"1\",\"2\"]")));
  }

  @Test
  void definitionsAndValuesPastTheStoredSizeCapAreRejectedOnCreateAndPatch(TestNamespace ns) {
    Tree tree = tree(ns);
    List<GlossaryTermProperty> oversized = oversizedDefinitions();

    assertThrows(
        InvalidRequestException.class, () -> term(tree.glossary(), null, "Big", oversized, null));
    InvalidRequestException patched =
        assertThrows(
            InvalidRequestException.class,
            () ->
                patch(
                    admin,
                    tree.email(),
                    op("add", "/propertyDefinitions", JsonUtils.pojoToJson(oversized))));
    assertTrue(patched.getMessage().contains("at most 262144 bytes"), patched.getMessage());
    assertNull(withStored(tree.email()).getPropertyDefinitions());
  }

  private static List<GlossaryTermProperty> oversizedDefinitions() {
    List<GlossaryTermProperty> definitions = new ArrayList<>();
    for (int index = 0; index < 20; index++) {
      LinkedHashSet<String> values = new LinkedHashSet<>();
      for (int value = 0; value < 1000; value++) {
        values.add("padding-value-%04d".formatted(value));
      }
      definitions.add(
          new GlossaryTermProperty()
              .withName("big" + index)
              .withDatatype(GlossaryTermPropertyDatatype.ENUM)
              .withEnumValues(values));
    }
    return definitions;
  }

  @Test
  void createRejectsAKeyNoPropertyCoversAndABadPropertyName(TestNamespace ns) {
    Tree tree = tree(ns);

    assertThrows(
        InvalidRequestException.class,
        () -> term(tree.glossary(), tree.customer(), "Stray", null, Map.of("nope", List.of("x"))));
    assertThrows(
        InvalidRequestException.class,
        () ->
            term(
                tree.glossary(),
                null,
                "BadName",
                List.of(property("a/b", GlossaryTermPropertyDatatype.STRING)),
                null));
  }

  @Test
  void datatypeCannotChange(TestNamespace ns) {
    Tree tree = tree(ns);

    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () ->
                patch(
                    admin,
                    tree.customer(),
                    op("replace", "/propertyDefinitions/1/datatype", "\"decimal\"")));

    assertTrue(error.getMessage().contains("cannot change from integer to decimal"));
  }

  @Test
  void urlValuesMustBeAbsoluteHttpOrHttps(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm withUrl =
        term(
            tree.glossary(),
            null,
            "Docs",
            List.of(property("wiki", GlossaryTermPropertyDatatype.URL)),
            Map.of("wiki", List.of("https://wiki.example.com/gdpr")));

    assertEquals(
        List.of("https://wiki.example.com/gdpr"),
        withStored(withUrl).getPropertyValues().get("wiki"));
    for (String bad : List.of("wiki.example.com", "ftp://files.example.com/a", "https://")) {
      assertThrows(
          InvalidRequestException.class,
          () -> patch(admin, withUrl, op("add", "/propertyValues/wiki", "[\"" + bad + "\"]")));
    }
  }

  @Test
  void booleanDateAndDecimalValuesAreChecked(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm typed =
        term(
            tree.glossary(),
            null,
            "Typed",
            List.of(
                property("active", GlossaryTermPropertyDatatype.BOOLEAN),
                property("reviewedOn", GlossaryTermPropertyDatatype.DATE),
                property("score", GlossaryTermPropertyDatatype.DECIMAL)),
            Map.of(
                "active", List.of("true"),
                "reviewedOn", List.of("2026-11-12"),
                "score", List.of("99.95")));

    assertEquals(List.of("true"), withStored(typed).getPropertyValues().get("active"));
    assertThrows(
        InvalidRequestException.class,
        () -> patch(admin, typed, op("add", "/propertyValues/active", "[\"yes\"]")));
    assertThrows(
        InvalidRequestException.class,
        () -> patch(admin, typed, op("add", "/propertyValues/reviewedOn", "[\"12/11/2026\"]")));
  }

  @Test
  void nameClashIgnoringCaseWithAnInheritableAncestorPropertyIsAConflict(TestNamespace ns) {
    Tree tree = tree(ns);

    ConflictException error =
        assertThrows(
            ConflictException.class,
            () ->
                patch(
                    admin,
                    tree.email(),
                    op(
                        "add",
                        "/propertyDefinitions",
                        "[{\"name\":\"RegulatoryScope\",\"datatype\":\"string\"}]")));

    assertTrue(error.getMessage().contains(tree.customer().getFullyQualifiedName()));
  }

  @Test
  void declaringANameATermBelowDeclaresIsAConflictNamingThatTerm(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm email =
        patch(
            admin,
            tree.email(),
            op("add", "/propertyDefinitions", "[{\"name\":\"Local\",\"datatype\":\"string\"}]"));

    ConflictException error =
        assertThrows(
            ConflictException.class,
            () ->
                patch(
                    admin,
                    tree.customer(),
                    op(
                        "add",
                        "/propertyDefinitions/-",
                        "{\"name\":\"local\",\"datatype\":\"string\"}")));

    assertTrue(error.getMessage().contains(email.getFullyQualifiedName()));
  }

  @Test
  void turningInheritanceOnWhileATermBelowDeclaresTheNameIsAConflict(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm email =
        patch(
            admin,
            tree.email(),
            op(
                "add",
                "/propertyDefinitions",
                "[{\"name\":\"retentionDays\",\"datatype\":\"integer\",\"inheritable\":false}]"));

    ConflictException error =
        assertThrows(
            ConflictException.class,
            () ->
                patch(
                    admin,
                    tree.customer(),
                    op("replace", "/propertyDefinitions/1/inheritable", "true")));

    assertTrue(error.getMessage().contains(email.getFullyQualifiedName()));
  }

  @Test
  void removingAnEnumValueThatATermStoresIsAConflictNamingTheTerm(TestNamespace ns) {
    Tree tree = tree(ns);

    ConflictException error =
        assertThrows(
            ConflictException.class,
            () ->
                patch(
                    admin,
                    tree.customer(),
                    op("replace", "/propertyDefinitions/0/enumValues", "[\"GDPR\",\"HIPAA\"]")));

    assertTrue(error.getMessage().contains(tree.phone().getFullyQualifiedName()));
    assertEquals(
        new LinkedHashSet<>(List.of("GDPR", "CCPA")),
        withStored(tree.customer()).getPropertyDefinitions().getFirst().getEnumValues());
  }

  @Test
  void addingAnEnumValueAlwaysPasses(TestNamespace ns) {
    Tree tree = tree(ns);

    GlossaryTerm updated =
        patch(
            admin,
            tree.customer(),
            op("replace", "/propertyDefinitions/0/enumValues", "[\"GDPR\",\"CCPA\",\"HIPAA\"]"));

    assertEquals(
        new LinkedHashSet<>(List.of("GDPR", "CCPA", "HIPAA")),
        withStored(updated).getPropertyDefinitions().getFirst().getEnumValues());
  }

  @Test
  void narrowingMultiValuedWhileATermStoresTwoValuesIsAConflict(TestNamespace ns) {
    Tree tree = tree(ns);
    patch(
        admin,
        tree.email(),
        op("add", "/propertyValues", "{\"regulatoryScope\":[\"GDPR\",\"CCPA\"]}"));

    ConflictException error =
        assertThrows(
            ConflictException.class,
            () ->
                patch(
                    admin,
                    tree.customer(),
                    op("replace", "/propertyDefinitions/0/multiValued", "false")));

    assertTrue(error.getMessage().contains(tree.email().getFullyQualifiedName()));
  }

  @Test
  void patchingOnlyValuesBumpsTheVersionAndSavesThem(TestNamespace ns) {
    Tree tree = tree(ns);
    Double before = admin.glossaryTerms().get(tree.phone().getId().toString()).getVersion();

    GlossaryTerm updated =
        patch(admin, tree.phone(), op("add", "/propertyValues/regulatoryScope", "[\"GDPR\"]"));

    assertTrue(updated.getVersion() > before);
    assertEquals(List.of("GDPR"), withStored(updated).getPropertyValues().get("regulatoryScope"));
  }

  @Test
  void deletingAPropertyRemovesItsValuesBelowIncludingSoftDeletedTerms(TestNamespace ns) {
    Tree tree = tree(ns);
    Double phoneVersion = admin.glossaryTerms().get(tree.phone().getId().toString()).getVersion();
    admin.glossaryTerms().delete(tree.mobile().getId().toString());
    Double mobileVersion = stored(tree.mobile().getId()).getVersion();

    GlossaryTerm customer =
        patch(
            admin,
            tree.customer(),
            op("test", "/propertyDefinitions/0/name", "\"regulatoryScope\""),
            removeOp("/propertyDefinitions/0"));

    GlossaryTerm storedCustomer = withStored(customer);
    assertEquals(
        List.of("retentionDays"),
        storedCustomer.getPropertyDefinitions().stream()
            .map(GlossaryTermProperty::getName)
            .toList());
    assertEquals(Map.of("retentionDays", List.of("365")), storedCustomer.getPropertyValues());
    assertNull(stored(tree.phone().getId()).getPropertyValues());
    assertNull(stored(tree.mobile().getId()).getPropertyValues());
    assertEquals(
        phoneVersion, admin.glossaryTerms().get(tree.phone().getId().toString()).getVersion());
    assertEquals(mobileVersion, stored(tree.mobile().getId()).getVersion());
    assertNull(effective(withEffective(admin, tree.work()), "regulatoryScope"));
    assertTrue(deletionIsRecorded(customer));
  }

  private boolean deletionIsRecorded(GlossaryTerm customer) {
    GlossaryTerm version =
        admin.glossaryTerms().getVersion(customer.getId(), customer.getVersion());
    List<String> deleted =
        version.getChangeDescription().getFieldsDeleted().stream()
            .map(change -> change.getName())
            .toList();
    return deleted.contains("propertyDefinitions");
  }

  @Test
  void turningInheritanceOffKeepsOwnValuesAndRemovesTheEntriesBelow(TestNamespace ns) {
    Tree tree = tree(ns);

    GlossaryTerm customer =
        patch(admin, tree.customer(), op("replace", "/propertyDefinitions/0/inheritable", "false"));

    assertEquals(List.of("GDPR"), withStored(customer).getPropertyValues().get("regulatoryScope"));
    assertNull(stored(tree.phone().getId()).getPropertyValues());
    assertNull(stored(tree.mobile().getId()).getPropertyValues());
    assertNull(effective(withEffective(admin, tree.work()), "regulatoryScope"));
  }

  @Test
  void declaringAnInheritablePropertyRemovesStaleEntriesBelow(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm email = stored(tree.email().getId());
    email.setPropertyValues(new LinkedHashMap<>(Map.of("slaTier", List.of("Gold"))));
    Entity.getCollectionDAO()
        .glossaryTermDAO()
        .update(email.getId(), email.getFullyQualifiedName(), JsonUtils.pojoToJson(email));

    patch(
        admin,
        tree.customer(),
        op(
            "add",
            "/propertyDefinitions/-",
            "{\"name\":\"slaTier\",\"datatype\":\"string\",\"inheritable\":true}"));

    assertNull(stored(tree.email().getId()).getPropertyValues());
    assertEquals(List.of(), effective(withEffective(admin, tree.email()), "slaTier").getValues());
  }

  @Test
  void movingATermUnderAnAncestorThatDoesNotCoverItsValuesIsAConflict(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm bare = term(tree.glossary(), null, "Bare", null, null);

    assertThrows(
        ConflictException.class,
        () -> patch(admin, tree.phone(), op("replace", "/parent", parentReference(bare))));
    assertThrows(ConflictException.class, () -> moveAsync(tree.phone(), bare));
    assertEquals(
        tree.customer().getFullyQualifiedName(),
        admin
            .glossaryTerms()
            .get(tree.phone().getId().toString(), "parent")
            .getParent()
            .getFullyQualifiedName());
  }

  @Test
  void movingATermUnderAnAncestorWithACompatiblePropertyKeepsItsValues(TestNamespace ns) {
    Tree tree = tree(ns);
    GlossaryTerm other = term(tree.glossary(), null, "Other", List.of(regulatoryScope()), null);

    GlossaryTerm moved =
        patch(admin, tree.phone(), op("replace", "/parent", parentReference(other)));

    assertEquals(other.getFullyQualifiedName() + ".Phone", moved.getFullyQualifiedName());
    assertEquals(List.of("CCPA"), withStored(moved).getPropertyValues().get("regulatoryScope"));
    EffectiveGlossaryTermProperty mobile =
        effective(withEffective(admin, tree.mobile()), "regulatoryScope");
    assertEquals(other.getFullyQualifiedName(), mobile.getDeclaredBy().getFullyQualifiedName());
  }

  private static String parentReference(GlossaryTerm parent) {
    return "{\"id\":\"%s\",\"type\":\"glossaryTerm\"}".formatted(parent.getId());
  }

  private void moveAsync(GlossaryTerm term, GlossaryTerm newParent) {
    String body = "{\"parent\":" + parentReference(newParent) + "}";
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + term.getId() + "/moveAsync",
            JsonUtils.readTree(body));
  }
}
