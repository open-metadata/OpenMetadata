package org.openmetadata.mcp.tools;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * The contract of the merged create tool.
 *
 * <p>The first test is the reason the registry exists at all: eight separate create tools could
 * advertise a field one of them did not accept, and nothing caught it. With one advertised list and
 * one dispatch table, a type that is offered but cannot be built fails the build instead.
 */
class CreateEntityToolTest {

  private static final String TOOLS = "json/data/mcp/tools.json";

  // --- advertised == dispatchable ---------------------------------------------------------------

  @Test
  void everyTypeCreateEntityAdvertisesCanActuallyBeCreated() throws IOException {
    assertEquals(
        CreatableEntityRegistry.names(),
        advertisedTypes("create_entity"),
        "a type in the tool's enum that the registry cannot build is a call that always fails, "
            + "and a type the registry builds but the enum omits is unreachable");
  }

  @Test
  void describeEntityTypeOffersTheSameTypesAsCreateEntity() throws IOException {
    assertEquals(
        advertisedTypes("create_entity"),
        advertisedTypes("describe_entity_type"),
        "looking a type up must be possible for exactly the types that can be created");
  }

  @Test
  void theReplacedToolsAreGone() throws IOException {
    Set<String> names = toolNames();
    List<String> replaced =
        List.of(
            "create_glossary",
            "create_glossary_term",
            "create_classification",
            "create_tag",
            "create_domain",
            "create_data_product",
            "create_metric",
            "create_context_memory");
    replaced.forEach(
        name ->
            assertTrue(
                !names.contains(name),
                name + " is still advertised - it was replaced by create_entity"));
    assertTrue(names.contains("create_test_case"), "create_test_case deliberately stays separate");
  }

  // --- corrective errors, so a wrong guess costs one retry ---------------------------------------

  @Test
  void anUnknownTypeIsRejectedWithTheOnesThatWouldHaveWorked() {
    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class, () -> CreatableEntityRegistry.require("glosary"));

    assertTrue(
        failure.getMessage().contains("glossary"),
        "the valid names must be in the error, or the caller has to spend a call finding them");
    assertTrue(
        failure.getMessage().contains("create_test_case"),
        "test cases are creatable, just not here - say so rather than looking unsupported");
  }

  @Test
  void anAttributeTheTypeDoesNotAcceptIsRejectedBeforeAnythingIsWritten() {
    Map<String, Object> params = params("glossary", "Finance");
    params.put("attributes", Map.of("classification", "PII"));

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(failure.getMessage().contains("classification"), "name the offending attribute");
    assertTrue(
        failure.getMessage().contains("Nothing was created"),
        "the caller must know the call had no effect before it retries");
  }

  @Test
  void aSharedFieldIsRejectedInsideAttributes() {
    Map<String, Object> params = params("glossary", "Finance");
    params.put("attributes", Map.of("description", "shadowed"));

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("top-level parameters"),
        "silently accepting it would let one description shadow the other");
  }

  @Test
  void aTypesOwnRequiredFieldsAreEnforcedEvenThoughTheSchemaOnlyRequiresName() {
    Map<String, Object> params = params("dataProduct", "Churn");

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("domains") && failure.getMessage().contains("description"),
        "create_data_product required both; one shared schema must not quietly relax that. Was: "
            + failure.getMessage());
  }

  @Test
  void everyMissingRequiredFieldIsNamedAtOnce() {
    Map<String, Object> params = params("glossaryTerm", "Revenue");

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("description") && failure.getMessage().contains("glossary"),
        "reporting one field per retry turns a single mistake into several calls. Was: "
            + failure.getMessage());
  }

  @Test
  void aRejectedEnumValueIsExplainedWithTheOnesThatWouldWork() {
    Map<String, Object> params = params("domain", "Marketing");
    params.put("description", "a domain");
    params.put("attributes", Map.of("domainType", "Nonsense"));

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("Aggregate"),
        "the generated enums bind through a fromValue creator that throws, so the failure arrives "
            + "as a ValueInstantiationException naming the enclosing class - matching only "
            + "InvalidFormatException left the caller with a raw Jackson message and no valid "
            + "values. Was: "
            + failure.getMessage());
    assertTrue(
        failure.getMessage().contains("domainType"),
        "name the field, not the Java type that failed to construct");
  }

  @Test
  void aRejectedEnumNestedInsideAnAttributeIsExplainedToo() {
    Map<String, Object> params = params("metric", "Orders");
    params.put(
        "attributes",
        Map.of("metricExpression", Map.of("language", "Klingon", "code", "SELECT 1")));

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("SQL"),
        "metricExpression.language belongs to MetricExpression, not to CreateMetric, so looking "
            + "the field up on the request class finds nothing - the values have to come off the "
            + "type the exception says failed. Was: "
            + failure.getMessage());
    assertTrue(
        failure.getMessage().contains("metricExpression.language"),
        "report the path, not just the leaf name, or 'language' is ambiguous");
  }

  // --- tag classification derivation, carried over from create_tag -------------------------------

  @Test
  void aTagsClassificationIsDerivedFromItsParent() {
    assertEquals(
        "PII",
        CreatePreparers.resolveClassification(null, "PII.PersonalData"),
        "naming the parent is enough - the classification is its root segment");
  }

  @Test
  void aClassificationThatContradictsTheParentIsRejected() {
    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () -> CreatePreparers.resolveClassification("Tier", "PII.PersonalData"));

    assertTrue(
        failure.getMessage().contains("PII"),
        "preferring either one silently would file the tag somewhere it was not asked to go");
  }

  @Test
  void aTagWithNeitherClassificationNorParentSaysWhatToSupply() {
    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () -> CreatePreparers.resolveClassification(null, null));

    assertTrue(failure.getMessage().contains("classification"));
  }

  // --- describe_entity_type ----------------------------------------------------------------------

  @Test
  void describingATypeListsItsAttributesAndTheirAllowedValues() {
    Map<String, Object> described =
        new DescribeEntityTypeTool()
            .execute(null, null, new HashMap<>(Map.of("entityType", "domain")));

    assertEquals("domain", described.get("entityType"));
    assertEquals(List.of("description"), described.get("alsoRequired"));
    Map<String, Object> domainType = attribute(described, "domainType");
    assertTrue(
        domainType.get("allowedValues").toString().contains("Aggregate"),
        "the enum values belong here, fetched once, instead of in eight tool descriptions "
            + "shipped on every request. Was: "
            + domainType);
  }

  @Test
  void describingATypeNeverRepeatsTheSharedParameters() {
    Map<String, Object> described =
        new DescribeEntityTypeTool()
            .execute(null, null, new HashMap<>(Map.of("entityType", "glossaryTerm")));

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> attributes = (List<Map<String, Object>>) described.get("attributes");
    assertTrue(
        attributes.stream().noneMatch(attribute -> "owners".equals(attribute.get("name"))),
        "owners is a top-level parameter; listing it here would tell the caller to pass it twice");
    assertTrue(
        attributes.stream().anyMatch(attribute -> "glossary".equals(attribute.get("name"))),
        "the type-specific fields are exactly what this call is for");
  }

  // --- helpers -----------------------------------------------------------------------------------

  private static Map<String, Object> attribute(Map<String, Object> described, String name) {
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> attributes = (List<Map<String, Object>>) described.get("attributes");
    return attributes.stream()
        .filter(attribute -> name.equals(attribute.get("name")))
        .findFirst()
        .orElseThrow(() -> new AssertionError("no attribute '" + name + "' in " + attributes));
  }

  private static Map<String, Object> params(String entityType, String name) {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", entityType);
    params.put("name", name);
    return params;
  }

  /** Reaches the argument checks without a server: they all run before anything is persisted. */
  private static void run(Map<String, Object> params) {
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(() -> "admin");
    new CreateEntityTool().execute(null, null, securityContext, params);
  }

  private static Set<String> advertisedTypes(String toolName) throws IOException {
    JsonNode tool = tool(toolName);
    Set<String> types = new LinkedHashSet<>();
    tool.path("parameters")
        .path("properties")
        .path("entityType")
        .path("enum")
        .forEach(value -> types.add(value.asText()));
    return types;
  }

  private static Set<String> toolNames() throws IOException {
    Set<String> names = new LinkedHashSet<>();
    JsonUtils.readTree(toolsJson())
        .path("tools")
        .forEach(tool -> names.add(tool.path("name").asText()));
    return names;
  }

  private static JsonNode tool(String toolName) throws IOException {
    for (JsonNode tool : JsonUtils.readTree(toolsJson()).path("tools")) {
      if (toolName.equals(tool.path("name").asText())) {
        return tool;
      }
    }
    throw new AssertionError("no tool named " + toolName + " in " + TOOLS);
  }

  private static String toolsJson() throws IOException {
    try (InputStream stream =
        CreateEntityToolTest.class.getClassLoader().getResourceAsStream(TOOLS)) {
      if (stream == null) {
        throw new AssertionError(TOOLS + " is not on the test classpath");
      }
      return new String(stream.readAllBytes(), UTF_8);
    }
  }
}
