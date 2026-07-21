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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.service.Entity;

/**
 * Integration tests for the renewable Ontology Studio authoring leases exposed under
 * {@code /v1/ontologyEditLocks} (acquire / renew / get / release). Exercises first-acquire, cross
 * session contention, lease renewal and release semantics, and the {@code EDIT_GLOSSARY_TERMS}
 * authorization guard on every verb.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyEditLockResourceIT {

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String BASE_PATH = "/v1/ontologyEditLocks";
  private static final int LONG_LEASE_SECONDS = 300;
  private static final int TOKEN_TTL_SECONDS = 3600;
  private static final int HTTP_OK = 200;
  private static final int HTTP_NO_CONTENT = 204;
  private static final int HTTP_FORBIDDEN = 403;
  private static final int HTTP_NOT_FOUND = 404;
  private static final int HTTP_CONFLICT = 409;

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @Test
  void firstCallerAcquiresLeaseWithHolderAndSession(TestNamespace ns) throws Exception {
    GlossaryTerm term = createTerm(ns);
    AcquireOntologyEditLock request = leaseRequest(term.getId(), "first-caller-session");

    HttpResponse<String> response = acquire(SdkClients.getAdminToken(), request);

    assertEquals(HTTP_OK, response.statusCode(), response.body());
    OntologyEditLock lease = readLease(response);
    assertEquals(Entity.GLOSSARY_TERM, lease.getResourceType());
    assertEquals(term.getId(), lease.getResourceId());
    assertEquals("first-caller-session", lease.getSessionId());
    assertEquals(1, lease.getVersion());
    assertNotNull(lease.getHolder(), "an acquired lease must name its holder");
    assertEquals("admin", lease.getHolder().getName());
    assertTrue(
        lease.getExpiresAt() > lease.getAcquiredAt(), "the lease must expire after it is acquired");
  }

  @Test
  void activeLeaseRejectsAnotherUsersAcquire(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    User owner = UserTestFactory.createUser(ns, "ontologyLockOwner");
    setGlossaryOwner(glossary.getId(), owner);

    HttpResponse<String> held =
        acquire(SdkClients.getAdminToken(), glossaryLeaseRequest(glossary.getId(), "admin-session"));
    assertEquals(HTTP_OK, held.statusCode(), held.body());

    HttpResponse<String> contended =
        acquire(tokenFor(owner), glossaryLeaseRequest(glossary.getId(), "owner-session"));

    assertEquals(
        HTTP_CONFLICT,
        contended.statusCode(),
        "a second session must not steal an active lease: " + contended.body());
  }

  @Test
  void acquireRequiresGlossaryTermEditPermission(TestNamespace ns) throws Exception {
    GlossaryTerm term = createTerm(ns);
    User nonPrivileged = UserTestFactory.createUser(ns, "ontologyLockNoEdit");

    HttpResponse<String> response =
        acquire(tokenFor(nonPrivileged), leaseRequest(term.getId(), "denied-session"));

    assertEquals(
        HTTP_FORBIDDEN,
        response.statusCode(),
        "acquire must require EDIT_GLOSSARY_TERMS: " + response.body());
  }

  @Test
  void renewExtendsLeaseAndGetReturnsActiveLease(TestNamespace ns) throws Exception {
    GlossaryTerm term = createTerm(ns);
    String sessionId = "renew-session";

    OntologyEditLock acquired =
        readLease(acquire(SdkClients.getAdminToken(), leaseRequest(term.getId(), sessionId)));
    assertEquals(1, acquired.getVersion());

    AcquireOntologyEditLock renewal =
        leaseRequest(term.getId(), sessionId).withExpectedVersion(acquired.getVersion());
    HttpResponse<String> renewResponse = renew(SdkClients.getAdminToken(), renewal);
    assertEquals(HTTP_OK, renewResponse.statusCode(), renewResponse.body());
    OntologyEditLock renewed = readLease(renewResponse);

    assertEquals(2, renewed.getVersion(), "renewal must bump the lease version");
    assertEquals(
        acquired.getAcquiredAt(),
        renewed.getAcquiredAt(),
        "renewal keeps the original acquiredAt, only extending the expiry");
    assertTrue(
        renewed.getExpiresAt() >= acquired.getExpiresAt(), "renewal must not shorten the lease");

    HttpResponse<String> getResponse =
        getLease(SdkClients.getAdminToken(), Entity.GLOSSARY_TERM, term.getId());
    assertEquals(HTTP_OK, getResponse.statusCode(), getResponse.body());
    OntologyEditLock active = readLease(getResponse);
    assertEquals(2, active.getVersion(), "get must return the renewed lease");
    assertEquals(sessionId, active.getSessionId());
  }

  @Test
  void releaseFreesLeaseOnlyForMatchingSession(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    User owner = UserTestFactory.createUser(ns, "ontologyLockReleaseOwner");
    setGlossaryOwner(glossary.getId(), owner);
    String sessionId = "release-session";

    assertEquals(
        HTTP_OK,
        acquire(SdkClients.getAdminToken(), glossaryLeaseRequest(glossary.getId(), sessionId))
            .statusCode());

    HttpResponse<String> wrongSession =
        release(SdkClients.getAdminToken(), Entity.GLOSSARY, glossary.getId(), "not-my-session");
    assertEquals(
        HTTP_NOT_FOUND,
        wrongSession.statusCode(),
        "a mismatched sessionId must not release the lease: " + wrongSession.body());
    assertEquals(
        HTTP_OK,
        getLease(SdkClients.getAdminToken(), Entity.GLOSSARY, glossary.getId()).statusCode(),
        "the lease must still be active after a failed release");

    HttpResponse<String> released =
        release(SdkClients.getAdminToken(), Entity.GLOSSARY, glossary.getId(), sessionId);
    assertEquals(HTTP_NO_CONTENT, released.statusCode(), released.body());
    assertEquals(
        HTTP_NOT_FOUND,
        getLease(SdkClients.getAdminToken(), Entity.GLOSSARY, glossary.getId()).statusCode(),
        "a released lease is no longer active");

    HttpResponse<String> reacquired =
        acquire(tokenFor(owner), glossaryLeaseRequest(glossary.getId(), "owner-session"));
    assertEquals(
        HTTP_OK,
        reacquired.statusCode(),
        "another user may acquire once the lease is freed: " + reacquired.body());
    assertEquals(1, readLease(reacquired).getVersion(), "a freed-then-reacquired lease restarts");
  }

  @Test
  void getAndReleaseRequireGlossaryTermEditPermission(TestNamespace ns) throws Exception {
    GlossaryTerm term = createTerm(ns);
    assertEquals(
        HTTP_OK,
        acquire(SdkClients.getAdminToken(), leaseRequest(term.getId(), "guarded-session"))
            .statusCode());
    User nonPrivileged = UserTestFactory.createUser(ns, "ontologyLockDenied");
    String token = tokenFor(nonPrivileged);

    HttpResponse<String> getResponse = getLease(token, Entity.GLOSSARY_TERM, term.getId());
    HttpResponse<String> releaseResponse =
        release(token, Entity.GLOSSARY_TERM, term.getId(), "guarded-session");

    assertEquals(
        HTTP_FORBIDDEN, getResponse.statusCode(), "get must be authorized: " + getResponse.body());
    assertEquals(
        HTTP_FORBIDDEN,
        releaseResponse.statusCode(),
        "release must be authorized: " + releaseResponse.body());
  }

  private GlossaryTerm createTerm(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    return GlossaryTermTestFactory.createSimple(ns, glossary);
  }

  private AcquireOntologyEditLock leaseRequest(UUID resourceId, String sessionId) {
    return new AcquireOntologyEditLock()
        .withResourceType(Entity.GLOSSARY_TERM)
        .withResourceId(resourceId)
        .withSessionId(sessionId)
        .withLeaseSeconds(LONG_LEASE_SECONDS);
  }

  private AcquireOntologyEditLock glossaryLeaseRequest(UUID resourceId, String sessionId) {
    return new AcquireOntologyEditLock()
        .withResourceType(Entity.GLOSSARY)
        .withResourceId(resourceId)
        .withSessionId(sessionId)
        .withLeaseSeconds(LONG_LEASE_SECONDS);
  }

  private HttpResponse<String> acquire(String token, AcquireOntologyEditLock request)
      throws Exception {
    return send(token, "POST", BASE_PATH + "/acquire", serialize(request));
  }

  private HttpResponse<String> renew(String token, AcquireOntologyEditLock request)
      throws Exception {
    return send(token, "PUT", BASE_PATH + "/renew", serialize(request));
  }

  private HttpResponse<String> getLease(String token, String resourceType, UUID resourceId)
      throws Exception {
    return send(token, "GET", lockPath(resourceType, resourceId), null);
  }

  private HttpResponse<String> release(
      String token, String resourceType, UUID resourceId, String sessionId) throws Exception {
    String path =
        lockPath(resourceType, resourceId) + "?sessionId=" + URI.create("").resolve(sessionId);
    return send(token, "DELETE", lockPath(resourceType, resourceId) + "?sessionId=" + sessionId,
        null);
  }

  private static String lockPath(String resourceType, UUID resourceId) {
    return BASE_PATH + "/" + resourceType + "/" + resourceId;
  }

  private HttpResponse<String> send(String token, String method, String path, String body)
      throws Exception {
    HttpRequest.BodyPublisher publisher =
        body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30));
    if (body != null) {
      builder.header("Content-Type", "application/json");
    }
    HttpRequest httpRequest = builder.method(method, publisher).build();
    return HTTP_CLIENT.send(httpRequest, HttpResponse.BodyHandlers.ofString());
  }

  private static String serialize(AcquireOntologyEditLock request) throws Exception {
    return OBJECT_MAPPER.writeValueAsString(request);
  }

  private static OntologyEditLock readLease(HttpResponse<String> response) throws Exception {
    return OBJECT_MAPPER.readValue(response.body(), OntologyEditLock.class);
  }

  private static String tokenFor(User user) {
    return JwtAuthProvider.tokenFor(
        user.getEmail(), user.getEmail(), new String[] {}, TOKEN_TTL_SECONDS);
  }

  private void setGlossaryOwner(UUID glossaryId, User owner) throws Exception {
    String patch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/owners\",\"value\":[{\"id\":\"%s\",\"type\":\"user\"}]}]",
            owner.getId());
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(String.format("%s/v1/glossaries/%s", SdkClients.getServerUrl(),
                glossaryId)))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json-patch+json")
            .timeout(Duration.ofSeconds(30))
            .method("PATCH", HttpRequest.BodyPublishers.ofString(patch))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(HTTP_OK, response.statusCode(), "failed to set glossary owner: " + response.body());
  }
}
</content>
</invoke>
