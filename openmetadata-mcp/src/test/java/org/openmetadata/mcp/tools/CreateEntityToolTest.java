package org.openmetadata.mcp.tools;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

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

  /**
   * Covers all eight types, not the two that happened to be convenient. A type registered with an
   * empty or wrong {@code required} list would otherwise be created from a bare name and fail deep
   * in the repository, or worse, be persisted half-formed.
   */
  @Test
  void noRegisteredTypeCanBeCreatedFromANameAlone() {
    for (String entityType : CreatableEntityRegistry.names()) {
      IllegalArgumentException failure =
          assertThrows(
              IllegalArgumentException.class,
              () -> run(params(entityType, "Bare")),
              entityType + " was created from nothing but a name");
      CreatableEntityRegistry.require(entityType)
          .required()
          .forEach(
              field ->
                  assertTrue(
                      failure.getMessage().contains(field),
                      entityType
                          + " must name the missing '"
                          + field
                          + "'. Was: "
                          + failure.getMessage()));
    }
  }

  // --- the write path ----------------------------------------------------------------------------

  @Test
  void creatingAnEntityAuthorizesBeforeItWritesAnything() {
    Authorizer authorizer = mock(Authorizer.class);
    Limits limits = mock(Limits.class);
    GlossaryRepository repository = mock(GlossaryRepository.class);
    Glossary saved = new Glossary().withName("Finance");
    saved.setFullyQualifiedName("Finance");
    when(repository.createOrUpdate(isNull(), any(), anyString(), any()))
        .thenReturn(new RestUtil.PutResponse<>(Status.CREATED, saved, EventType.ENTITY_CREATED));
    // prepareInternal is what resolves the fully qualified name, and that is the whole reason the
    // overwrite check has to follow it - a mock that leaves the name null skips that check and the
    // ordering below would pass without ever exercising it.
    doAnswer(
            invocation -> {
              invocation.<Glossary>getArgument(0).setFullyQualifiedName("Finance");
              return null;
            })
        .when(repository)
        .prepareInternal(any(), anyBoolean());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<RuleEngine> rules = mockStatic(RuleEngine.class);
        MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.GLOSSARY)).thenReturn(repository);
      rules.when(RuleEngine::getInstance).thenReturn(mock(RuleEngine.class));

      Map<String, Object> params = params("glossary", "Finance");
      params.put("description", "a glossary");
      new CreateEntityTool().execute(authorizer, limits, securityContext(), params);

      // createOrUpdate updates in place when the name is taken, so both the CREATE check and the
      // overwrite check have to land before it - not merely be present somewhere in the method.
      InOrder ordered = inOrder(limits, authorizer, repository);
      ordered.verify(limits).enforceLimits(any(), any(), any());
      ordered.verify(authorizer).authorize(any(), any(), any());
      ordered.verify(repository).prepareInternal(any(), anyBoolean());
      ordered.verify(authorizer).authorize(any(), any(), any());
      ordered.verify(repository).createOrUpdate(isNull(), any(), anyString(), any());
    }
  }

  @Test
  void aDeniedCallerWritesNothing() {
    Authorizer authorizer = mock(Authorizer.class);
    GlossaryRepository repository = mock(GlossaryRepository.class);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<RuleEngine> rules = mockStatic(RuleEngine.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.GLOSSARY)).thenReturn(repository);
      rules.when(RuleEngine::getInstance).thenReturn(mock(RuleEngine.class));

      Map<String, Object> params = params("glossary", "Finance");
      params.put("description", "a glossary");

      assertThrows(
          AuthorizationException.class,
          () ->
              new CreateEntityTool()
                  .execute(authorizer, mock(Limits.class), securityContext(), params));

      verify(repository, never()).createOrUpdate(isNull(), any(), anyString(), any());
      verify(repository, never()).prepareInternal(any(), anyBoolean());
    }
  }

  @Test
  void anOwnerThatResolvesToNothingFailsInsteadOfBeingDropped() {
    UserRepository users = mock(UserRepository.class);
    TeamRepository teams = mock(TeamRepository.class);
    when(users.findByNameOrNull(anyString(), any())).thenReturn(null);
    when(teams.findByNameOrNull(anyString(), any())).thenReturn(null);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getUserRepository).thenReturn(users);
      entity.when(() -> Entity.getEntityRepository(Entity.TEAM)).thenReturn(teams);

      Map<String, Object> params = params("glossary", "Finance");
      params.put("description", "a glossary");
      params.put("owners", List.of("nobody.at.all"));

      IllegalArgumentException failure =
          assertThrows(IllegalArgumentException.class, () -> run(params));

      assertTrue(
          failure.getMessage().contains("nobody.at.all"),
          "the helper the replaced tools used returned only what it could resolve, so a misspelled "
              + "owner created an unowned entity and reported success. Was: "
              + failure.getMessage());
    }
  }

  // --- only what the type can actually hold ------------------------------------------------------

  @Test
  void describeNeverAdvertisesAFieldCreateWouldReject() {
    for (String entityType : CreatableEntityRegistry.names()) {
      Map<String, Object> described =
          new DescribeEntityTypeTool()
              .execute(null, null, new HashMap<>(Map.of("entityType", entityType)));
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> attributes =
          (List<Map<String, Object>>) described.get("attributes");
      List<String> names = attributes.stream().map(a -> String.valueOf(a.get("name"))).toList();

      // lifeCycle is a getter with no setter on the CreateEntity interface, so Jackson lists it as
      // a property of every implementor and then refuses to bind it. Advertising it told callers
      // to send a field that always failed - the two tools contradicted each other.
      assertTrue(
          !names.contains("lifeCycle"),
          entityType + " advertises lifeCycle, which create_entity cannot bind: " + names);
      assertTrue(
          !names.contains("provider"),
          entityType + " advertises provider; provider=system makes an entity nobody can delete");
    }
  }

  @Test
  void aSharedParameterTheTypeHasNoFieldForIsRefusedNotDropped() {
    Map<String, Object> params = params("classification", "PII");
    params.put("description", "a classification");
    params.put("tags", List.of("Tier.Tier1"));

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("tags") && failure.getMessage().contains("classification"),
        "CreateClassification has no tags field, only the CreateEntity interface's no-op default "
            + "setter - so the tag was accepted, discarded, and reported as success. Was: "
            + failure.getMessage());
  }

  @Test
  void anUnsupportedSharedParameterNamesTheOnesThatDoWork() {
    Map<String, Object> params = params("classification", "PII");
    params.put("description", "a classification");
    params.put("extension", Map.of("anything", "value"));

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("Supported for this type"),
        "extension is getter-only on CreateEntity, so this used to fail with a raw Jackson message "
            + "naming a Java class. Was: "
            + failure.getMessage());
  }

  @Test
  void aDeclaredFieldIsToldApartFromAnInheritedNoOp() {
    // The discriminator, stated directly: CreateMetric declares tags, CreateClassification only
    // inherits CreateEntity's no-op default setter. Rejecting on name alone would break the first.
    assertTrue(
        DescribeEntityTypeTool.bindableNames(CreatableEntityRegistry.require("metric"))
            .contains("tags"),
        "metric declares tags for real and must keep accepting it");
    assertTrue(
        !DescribeEntityTypeTool.bindableNames(CreatableEntityRegistry.require("classification"))
            .contains("tags"),
        "classification has no tags field - only the interface default that silently discards");
  }

  // --- behaviours the replaced tools had, which the merge must not drop -------------------------

  @Test
  void aMemoryIsStampedAsAnExplicitRememberRequest() {
    CreateContextMemory request = new CreateContextMemory().withName("m");

    CreatePreparers.contextMemory(request);

    assertEquals(
        ContextMemorySourceType.REMEMBER_REQUEST,
        request.getSourceType(),
        "create_context_memory stamped this so the Memory Agent could tell an explicit 'remember "
            + "this' from a hand-written catalog edit. The schema default is Manual, so leaving it "
            + "unset silently changed the provenance of every memory MCP creates");
  }

  @Test
  void aMetricNeedsAnExpressionThatActuallyComputesSomething() {
    Map<String, Object> params = params("metric", "Orders");
    params.put("attributes", Map.of("metricExpression", Map.of()));

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("metricExpression"),
        "the required-field check only proves the key is present, and isAbsent treats any Map as "
            + "present - so an empty expression passed straight through to the repository, which "
            + "does not validate it either. Was: "
            + failure.getMessage());
  }

  @Test
  void anIgnoredMutuallyExclusiveIsReportedRatherThanDroppedInSilence() {
    CreateClassification request = new CreateClassification().withName("PII");
    request.setMutuallyExclusive(Boolean.TRUE);
    Classification stored = new Classification().withName("PII");
    stored.setMutuallyExclusive(Boolean.FALSE);
    Map<String, Object> result = new HashMap<>();

    CreatePreparers.classificationNote(request, stored, EventType.ENTITY_UPDATED, result);

    assertTrue(
        result.get("_warning").toString().contains("was ignored"),
        "the field is immutable once the classification exists, so an update discards it - "
            + "returning a clean success would tell the caller their change landed");
  }

  @Test
  void nothingIsReportedWhenTheStoredValueMatches() {
    CreateClassification request = new CreateClassification().withName("PII");
    request.setMutuallyExclusive(Boolean.TRUE);
    Classification stored = new Classification().withName("PII");
    stored.setMutuallyExclusive(Boolean.TRUE);
    Map<String, Object> result = new HashMap<>();

    CreatePreparers.classificationNote(request, stored, EventType.ENTITY_UPDATED, result);

    assertTrue(result.isEmpty(), "a warning on a value that did apply is just noise");
  }

  @Test
  void theValidTypesAreListedInARegistrationOrder() {
    assertEquals(
        "glossary",
        CreatableEntityRegistry.names().iterator().next(),
        "names() feeds the list of valid types in the error a caller sees, so it cannot come out "
            + "in a different order per build - Map.copyOf leaves iteration order unspecified");
  }

  @Test
  void anEmptyCollectionCountsAsMissing() {
    Map<String, Object> params = params("dataProduct", "Churn");
    params.put("description", "a product");
    params.put("domains", List.of());

    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> run(params));

    assertTrue(
        failure.getMessage().contains("domains"),
        "an empty list is put into the payload, so only isAbsent's collection branch catches it - "
            + "without that a data product could be created belonging to no domain. Was: "
            + failure.getMessage());
  }

  @Test
  void anUnresolvableReviewerFailsJustLikeAnOwner() {
    UserRepository users = mock(UserRepository.class);
    TeamRepository teams = mock(TeamRepository.class);
    when(users.findByNameOrNull(anyString(), any())).thenReturn(null);
    when(teams.findByNameOrNull(anyString(), any())).thenReturn(null);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getUserRepository).thenReturn(users);
      entity.when(() -> Entity.getEntityRepository(Entity.TEAM)).thenReturn(teams);

      Map<String, Object> params = params("glossary", "Finance");
      params.put("description", "a glossary");
      params.put("reviewers", List.of("nobody.at.all"));

      IllegalArgumentException failure =
          assertThrows(IllegalArgumentException.class, () -> run(params));

      assertTrue(
          failure.getMessage().contains("reviewers"),
          "the tool promises owners AND reviewers are rejected rather than dropped; they share a "
              + "helper but are wired separately. Was: "
              + failure.getMessage());
    }
  }

  // --- defaults the replaced tools applied
  // --------------------------------------------------------

  @Test
  void aDomainWithNoTypeGetsTheDefaultRatherThanFailingValidation() {
    CreateDomain request = new CreateDomain().withName("Marketing").withDescription("a domain");

    CreatePreparers.domain(request);

    assertEquals(
        CreateDomain.DomainType.AGGREGATE,
        request.getDomainType(),
        "create_domain defaulted an absent domainType; domainType is non-null in the schema, so "
            + "dropping the default would turn an optional field into a required one");
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
    new CreateEntityTool().execute(null, null, securityContext(), params);
  }

  private static CatalogSecurityContext securityContext() {
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(() -> "admin");
    return securityContext;
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
