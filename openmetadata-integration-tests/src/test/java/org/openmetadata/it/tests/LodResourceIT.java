package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;

/**
 * Integration tests for {@code GET /v1/lod/entity/{entityType}/{id}} — the authenticated LOD
 * dereferencing endpoint that redirects an OpenMetadata IRI to its RDF representation.
 *
 * <p>The endpoint reads {@code rdf.dereferenceableIris} from the running server config and content
 * negotiates the redirect target from the {@code Accept} header. These tests mutate the shared,
 * in-process server config to toggle {@code dereferenceableIris}, so the class runs {@code @Isolated}
 * (mirroring {@link RdfResourceIT}) and restores the original value in {@code @AfterAll}.
 *
 * <p>Because the config is mutated in-process, the suite is skipped when the embedded server is not
 * running in this JVM (external mode), where {@link OpenMetadataApplicationConfigHolder} is not
 * initialized.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class LodResourceIT {

  private static final String LOD_ENTITY_PATH = "/v1/lod/entity/";
  private static final String RDF_ENTITY_PATH = "/v1/rdf/entity/table/";
  private static final String ENTITY_TYPE_TABLE = "table";
  private static final String TURTLE = "text/turtle";
  private static final String JSON_LD = "application/ld+json";
  private static final String VARY = "Vary";
  private static final String ACCEPT = "Accept";
  private static final String LOCATION = "Location";
  private static final String FORMAT_TURTLE = "format=turtle";
  private static final String FORMAT_JSONLD = "format=jsonld";

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(30))
          .followRedirects(HttpClient.Redirect.NEVER)
          .build();

  private static Boolean originalDereferenceableIris;

  @BeforeAll
  static void enableDereferenceableIris() {
    assumeTrue(
        RdfTestUtils.isRdfEnabled(),
        "RDF is disabled for this test run. Use the RDF test profile to execute LodResourceIT.");
    assumeTrue(
        OpenMetadataApplicationConfigHolder.isInitialized(),
        "LOD dereference tests mutate the in-process server config; skipping in external mode.");
    RdfConfiguration rdfConfig =
        OpenMetadataApplicationConfigHolder.getInstance().getRdfConfiguration();
    assumeTrue(
        rdfConfig != null, "Server RDF configuration is not present; skipping LodResourceIT.");
    originalDereferenceableIris = rdfConfig.getDereferenceableIris();
    rdfConfig.setDereferenceableIris(true);
  }

  @AfterAll
  static void restoreDereferenceableIris() {
    if (!OpenMetadataApplicationConfigHolder.isInitialized()) {
      return;
    }
    RdfConfiguration rdfConfig =
        OpenMetadataApplicationConfigHolder.getInstance().getRdfConfiguration();
    if (rdfConfig != null) {
      rdfConfig.setDereferenceableIris(originalDereferenceableIris);
    }
  }

  @Test
  void dereferenceReturns303RedirectWithVaryHeader(TestNamespace ns) throws Exception {
    Table table = createTable(ns);

    HttpResponse<String> response =
        dereference(
            ENTITY_TYPE_TABLE, table.getId().toString(), TURTLE, SdkClients.getAdminToken());

    assertEquals(303, response.statusCode(), "dereference must return a 303 See-Other redirect");
    String location = location(response);
    assertTrue(
        location.contains(RDF_ENTITY_PATH + table.getId()),
        "redirect Location must target the RDF representation of the entity: " + location);
    assertEquals(
        ACCEPT,
        response.headers().firstValue(VARY).orElse(null),
        "redirect must advertise content negotiation with Vary: Accept");
  }

  @Test
  void turtleAcceptNegotiatesTurtleFormat(TestNamespace ns) throws Exception {
    Table table = createTable(ns);

    HttpResponse<String> response =
        dereference(
            ENTITY_TYPE_TABLE, table.getId().toString(), TURTLE, SdkClients.getAdminToken());

    assertEquals(303, response.statusCode());
    assertTrue(
        location(response).contains(FORMAT_TURTLE),
        "Accept: text/turtle must redirect to the turtle representation: " + location(response));
  }

  @Test
  void jsonLdAcceptNegotiatesJsonLdFormat(TestNamespace ns) throws Exception {
    Table table = createTable(ns);

    HttpResponse<String> response =
        dereference(
            ENTITY_TYPE_TABLE, table.getId().toString(), JSON_LD, SdkClients.getAdminToken());

    assertEquals(303, response.statusCode());
    assertTrue(
        location(response).contains(FORMAT_JSONLD),
        "Accept: application/ld+json must redirect to the JSON-LD representation: "
            + location(response));
  }

  @Test
  void wildcardAcceptDefaultsToJsonLd(TestNamespace ns) throws Exception {
    Table table = createTable(ns);

    HttpResponse<String> response =
        dereference(ENTITY_TYPE_TABLE, table.getId().toString(), "*/*", SdkClients.getAdminToken());

    assertEquals(303, response.statusCode());
    assertTrue(
        location(response).contains(FORMAT_JSONLD),
        "a wildcard Accept must fall back to the JSON-LD default: " + location(response));
  }

  @Test
  void missingAcceptDefaultsToJsonLd(TestNamespace ns) throws Exception {
    Table table = createTable(ns);

    HttpResponse<String> response =
        dereference(ENTITY_TYPE_TABLE, table.getId().toString(), null, SdkClients.getAdminToken());

    assertEquals(303, response.statusCode());
    assertTrue(
        location(response).contains(FORMAT_JSONLD),
        "an absent Accept header must fall back to the JSON-LD default: " + location(response));
  }

  @Test
  void disabledDereferenceableIrisReturns404(TestNamespace ns) throws Exception {
    Table table = createTable(ns);
    setDereferenceableIris(false);
    try {
      HttpResponse<String> response =
          dereference(
              ENTITY_TYPE_TABLE, table.getId().toString(), TURTLE, SdkClients.getAdminToken());

      assertEquals(
          404,
          response.statusCode(),
          "dereferencing must be hidden (404) when dereferenceableIris is disabled");
    } finally {
      setDereferenceableIris(true);
    }
  }

  @Test
  void unknownEntityTypeReturns400() throws Exception {
    HttpResponse<String> response =
        dereference(
            "notARealEntityType", UUID.randomUUID().toString(), TURTLE, SdkClients.getAdminToken());

    assertEquals(
        400,
        response.statusCode(),
        "an unknown entity type must be rejected with 400: " + response.body());
  }

  @Test
  void unauthenticatedRequestIsRejected(TestNamespace ns) throws Exception {
    Table table = createTable(ns);

    HttpResponse<String> response =
        dereference(ENTITY_TYPE_TABLE, table.getId().toString(), TURTLE, null);

    assertEquals(
        401,
        response.statusCode(),
        "an unauthenticated dereference must be rejected with 401: " + response.body());
  }

  @Test
  void nonAdminWithDefaultViewAllIsRedirected(TestNamespace ns) throws Exception {
    Table table = createTable(ns);
    String nonAdminToken =
        JwtAuthProvider.tokenFor(
            "test@open-metadata.org", "test@open-metadata.org", new String[] {}, 3600);

    HttpResponse<String> response =
        dereference(ENTITY_TYPE_TABLE, table.getId().toString(), TURTLE, nonAdminToken);

    assertEquals(
        303,
        response.statusCode(),
        "a role-less user holds ViewAll via OrganizationPolicy and must be redirected, proving the "
            + "authorize() path runs for non-admin callers: "
            + response.body());
  }

  private Table createTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("lodTable"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setColumns(List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().build()));

    Table table = Tables.create(createRequest);
    assertNotNull(table.getId());
    return table;
  }

  private HttpResponse<String> dereference(
      String entityType, String id, String accept, String token) throws Exception {
    String url = SdkClients.getServerUrl() + LOD_ENTITY_PATH + entityType + "/" + id;
    HttpRequest.Builder builder = HttpRequest.newBuilder().uri(URI.create(url)).GET();
    if (token != null) {
      builder.header("Authorization", "Bearer " + token);
    }
    if (accept != null) {
      builder.header(ACCEPT, accept);
    }
    return HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }

  private static String location(HttpResponse<String> response) {
    return response.headers().firstValue(LOCATION).orElse("");
  }

  private static void setDereferenceableIris(boolean enabled) {
    OpenMetadataApplicationConfigHolder.getInstance()
        .getRdfConfiguration()
        .setDereferenceableIris(enabled);
  }
}
