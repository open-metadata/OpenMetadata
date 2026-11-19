/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.attachments;

import static jakarta.ws.rs.core.Response.Status.CREATED;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.jackson.JacksonFeature;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.media.multipart.FormDataMultiPart;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.media.multipart.file.StreamDataBodyPart;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
class AttachmentListIT {

  private static final String ATTACHMENTS_PATH = "v1/attachments";
  private static String serverBaseUrl;
  private static Client multipartClient;
  private static WebTarget uploadTarget;

  @BeforeAll
  static void setup() {
    String itBaseUrl =
        System.getProperty(
            "IT_BASE_URL",
            System.getenv().getOrDefault("IT_BASE_URL", "http://localhost:8585/api"));
    serverBaseUrl = itBaseUrl.endsWith("/api") ? itBaseUrl : itBaseUrl + "/api";

    multipartClient = ClientBuilder.newClient();
    multipartClient.register(MultiPartFeature.class);
    multipartClient.register(new JacksonFeature(Jackson.newObjectMapper()));

    uploadTarget =
        multipartClient
            .target(serverBaseUrl + "/" + ATTACHMENTS_PATH + "/upload")
            .property(ClientProperties.CONNECT_TIMEOUT, 30000)
            .property(ClientProperties.READ_TIMEOUT, 30000);
  }

  @AfterAll
  static void tearDown() {
    if (multipartClient != null) {
      multipartClient.close();
      multipartClient = null;
    }
  }

  private static MultivaluedMap<String, Object> adminAuthHeaders() {
    String token = SdkClients.getAdminToken();
    MultivaluedMap<String, Object> headers = new MultivaluedHashMap<>();
    headers.add("Authorization", "Bearer " + token);
    return headers;
  }

  private Glossary createGlossary(RestClient rest, TestNamespace ns, String slug) {
    try {
      return rest.create(
          "v1/glossaries",
          new CreateGlossary().withName(ns.prefix(slug)).withDescription("attachment IT glossary"),
          Glossary.class);
    } catch (Exception e) {
      throw new AssertionError("Failed to create glossary " + slug, e);
    }
  }

  private Asset uploadAttachment(String entityLink, String fileName, String body) {
    try (FormDataMultiPart multipart = new FormDataMultiPart()) {
      multipart.field("entityLink", entityLink);
      multipart.field("assetType", "External");
      multipart.bodyPart(
          new StreamDataBodyPart(
              "file",
              new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)),
              fileName,
              MediaType.APPLICATION_OCTET_STREAM_TYPE));

      Response response =
          uploadTarget
              .request()
              .headers(adminAuthHeaders())
              .post(Entity.entity(multipart, multipart.getMediaType()));

      String responseBody = response.readEntity(String.class);
      assertEquals(
          CREATED.getStatusCode(), response.getStatus(), "Asset upload failed: " + responseBody);
      return JsonUtils.readValue(responseBody, Asset.class);
    } catch (Exception e) {
      throw new AssertionError("Failed to upload attachment " + fileName, e);
    }
  }

  private List<Asset> listExternalAttachments(String fqn, String queryString) {
    RestClient rest = RestClient.admin();
    String path = ATTACHMENTS_PATH + "/fqn/" + fqn + "/External";
    if (queryString != null && !queryString.isEmpty()) {
      path = path + "?" + queryString;
    }
    try (Response response = rest.rawGet(path)) {
      assertEquals(200, response.getStatus(), "Listing attachments failed");
      String body = response.readEntity(String.class);
      return JsonUtils.readValue(body, new TypeReference<List<Asset>>() {});
    }
  }

  private String entityLink(Glossary glossary) {
    return "<#E::glossary::" + glossary.getFullyQualifiedName() + ">";
  }

  private static void awaitClockPast(long timestamp) {
    await()
        .pollInterval(Duration.ofMillis(2))
        .atMost(Duration.ofSeconds(2))
        .until(() -> System.currentTimeMillis() > timestamp);
  }

  @Test
  void testListAttachmentsSortByUpdatedAtDesc(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-sort-updated");
    String link = entityLink(glossary);

    Asset older = uploadAttachment(link, "older.txt", "older");
    awaitClockPast(older.getUpdatedAt());
    Asset middle = uploadAttachment(link, "middle.txt", "middle");
    awaitClockPast(middle.getUpdatedAt());
    Asset newer = uploadAttachment(link, "newer.txt", "newer");

    List<Asset> assets =
        listExternalAttachments(
            glossary.getFullyQualifiedName(), "sortBy=updatedAt&sortOrder=desc");

    List<UUID> ids = assets.stream().map(a -> UUID.fromString(a.getId())).toList();
    assertEquals(
        List.of(
            UUID.fromString(newer.getId()),
            UUID.fromString(middle.getId()),
            UUID.fromString(older.getId())),
        ids,
        "Expected newest-first ordering");
  }

  @Test
  void testListAttachmentsSortByNameAsc(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-sort-name");
    String link = entityLink(glossary);

    Asset zebra = uploadAttachment(link, "zzz.txt", "z");
    Asset apple = uploadAttachment(link, "aaa.txt", "a");
    Asset mango = uploadAttachment(link, "mmm.txt", "m");

    List<Asset> assets =
        listExternalAttachments(glossary.getFullyQualifiedName(), "sortBy=name&sortOrder=asc");

    List<UUID> ids = assets.stream().map(a -> UUID.fromString(a.getId())).toList();
    assertEquals(
        List.of(
            UUID.fromString(apple.getId()),
            UUID.fromString(mango.getId()),
            UUID.fromString(zebra.getId())),
        ids,
        "Expected name-ascending ordering");
  }

  @Test
  void testListAttachmentsCreatedAtAliasesUpdatedAt(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-sort-created");
    String link = entityLink(glossary);

    Asset first = uploadAttachment(link, "first.txt", "1");
    awaitClockPast(first.getUpdatedAt());
    Asset second = uploadAttachment(link, "second.txt", "2");

    List<Asset> assets =
        listExternalAttachments(
            glossary.getFullyQualifiedName(), "sortBy=createdAt&sortOrder=desc");
    List<UUID> ids = assets.stream().map(a -> UUID.fromString(a.getId())).toList();
    assertEquals(
        List.of(UUID.fromString(second.getId()), UUID.fromString(first.getId())),
        ids,
        "createdAt should alias to updatedAt and return newest first");
  }

  @Test
  void testListAttachmentsWithLimitAndOffset(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-paginate");
    String link = entityLink(glossary);

    uploadAttachment(link, "alpha.txt", "1");
    uploadAttachment(link, "bravo.txt", "2");
    uploadAttachment(link, "charlie.txt", "3");
    uploadAttachment(link, "delta.txt", "4");

    List<Asset> page =
        listExternalAttachments(
            glossary.getFullyQualifiedName(), "sortBy=name&sortOrder=asc&offset=1&limit=2");
    assertEquals(2, page.size(), "Expected page size 2");
    assertEquals("bravo.txt", page.get(0).getFileName());
    assertEquals("charlie.txt", page.get(1).getFileName());
  }

  @Test
  void testListAttachmentsRejectsUnknownSortBy(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-bad-sort");
    String link = entityLink(glossary);
    uploadAttachment(link, "only.txt", "only");

    RestClient rest = RestClient.admin();
    String path =
        ATTACHMENTS_PATH
            + "/fqn/"
            + glossary.getFullyQualifiedName()
            + "/External?sortBy=bogusField";
    try (Response response = rest.rawGet(path)) {
      assertTrue(
          response.getStatus() >= 400 && response.getStatus() < 500,
          "Expected 4xx for unknown sortBy, got " + response.getStatus());
    }
  }

  @Test
  void testListAttachmentsNoSortReturnsAll(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-no-sort");
    String link = entityLink(glossary);
    Asset a = uploadAttachment(link, "one.txt", "1");
    Asset b = uploadAttachment(link, "two.txt", "2");

    List<Asset> assets = listExternalAttachments(glossary.getFullyQualifiedName(), null);
    assertEquals(2, assets.size(), "Expected both attachments returned without sort/pagination");
    assertNotNull(a.getId());
    assertNotNull(b.getId());
  }

  @Test
  void testAttachmentReadsFollowParentEntityVisibility(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-parent-visibility");
    Asset asset = uploadAttachment(entityLink(glossary), "visibility.txt", "v");

    RestClient restricted = userWithoutGlossaryView("att_deny");
    assertEquals(403, readStatus(restricted, ATTACHMENTS_PATH + "/" + asset.getId()));
    assertEquals(403, readStatus(restricted, externalListPath(glossary)));
  }

  @Test
  void testAttachmentReadsAllowedWhenParentIsVisible(TestNamespace ns) {
    Glossary glossary = createGlossary(RestClient.admin(), ns, "attach-parent-visible");
    Asset asset = uploadAttachment(entityLink(glossary), "visible.txt", "v");

    RestClient viewer = plainUser("att_view");
    assertEquals(200, readStatus(viewer, ATTACHMENTS_PATH + "/" + asset.getId()));
    assertEquals(200, readStatus(viewer, externalListPath(glossary)));
  }

  private static String externalListPath(Glossary glossary) {
    return ATTACHMENTS_PATH + "/fqn/" + glossary.getFullyQualifiedName() + "/External";
  }

  private static int readStatus(RestClient client, String path) {
    try (Response response = client.rawGet(path)) {
      return response.getStatus();
    }
  }

  private static String shortName(String label) {
    return label + "_" + UUID.randomUUID().toString().substring(0, 8);
  }

  private static RestClient plainUser(String label) {
    String userName = shortName(label);
    String email = userName + "@test.openmetadata.org";
    SdkClients.adminClient().users().create(new CreateUser().withName(userName).withEmail(email));
    return RestClient.forUser(email, new String[] {});
  }

  private static RestClient userWithoutGlossaryView(String label) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = shortName(label);
    Rule denyView =
        new Rule()
            .withName(prefix + "_rule")
            .withResources(List.of("glossary"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL, MetadataOperation.VIEW_BASIC))
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        admin
            .policies()
            .create(new CreatePolicy().withName(prefix + "_policy").withRules(List.of(denyView)));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(prefix + "_team")
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDefaultRoles(List.of(role.getId())));
    String email = prefix + "u@test.openmetadata.org";
    admin
        .users()
        .create(
            new CreateUser()
                .withName(prefix + "u")
                .withEmail(email)
                .withTeams(List.of(team.getId())));
    return RestClient.forUser(email, new String[] {});
  }
}
