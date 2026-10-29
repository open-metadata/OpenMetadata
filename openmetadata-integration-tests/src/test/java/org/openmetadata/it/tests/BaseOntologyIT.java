package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.OntologyEntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.OntologyReviewReconciler;
import org.openmetadata.service.jdbi3.TaskRepository;

abstract class BaseOntologyIT<T extends OntologyEntityInterface, K> extends BaseEntityIT<T, K> {
  protected abstract EntityServiceBase<T> entityService();

  protected BaseOntologyIT() {
    supportsEntityStatus = false;
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsCustomExtension = false;
    supportsSearchIndex = false;
  }

  protected static URI definitionIri(String name, TestNamespace ns) {
    return URI.create(
        "https://example.org/ontology/"
            + ns.shortPrefix()
            + "/"
            + URLEncoder.encode(name, StandardCharsets.UTF_8));
  }

  @Override
  protected T getEntityWithFields(String id, String fields) {
    return entityService().get(id, fields);
  }

  @Override
  protected T getEntityByNameWithFields(String name, String fields) {
    return entityService().getByName(name, fields);
  }

  @Override
  protected T getEntityIncludeDeleted(String id) {
    return entityService().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return entityService().getVersionList(id);
  }

  @Override
  protected T getVersion(UUID id, Double version) {
    return entityService().getVersion(id.toString(), version);
  }

  @AfterEach
  void cleanup(TestNamespace ns) {
    deleteRoots(ns);
  }

  static void deleteRoots(TestNamespace ns) {
    for (var root : ns.drainTrackedRoots().reversed().stream().distinct().toList()) {
      if (!Entity.ONTOLOGY.equals(root.entityType()) && !Entity.TASK.equals(root.entityType())) {
        NamespaceCleanup.deleteRoots(List.of(root));
        continue;
      }
      var client = SdkClients.adminClient();
      var service =
          switch (root.entityType()) {
            case Entity.ONTOLOGY -> client.ontologies();
            case Entity.TASK -> client.tasks();
            default -> throw new IllegalArgumentException("Unexpected root: " + root.entityType());
          };
      if (Entity.TASK.equals(root.entityType())) {
        closeReview(root.id());
      }
      final boolean retained =
          Entity.ONTOLOGY.equals(root.entityType())
              && Entity.getCollectionDAO().ontologyReleaseDAO().hasReleases(root.id());
      if (retained
          && Boolean.TRUE.equals(service.get(root.id().toString(), null, "all").getDeleted())) {
        continue;
      }
      service.delete(
          root.id().toString(),
          Map.of("hardDelete", Boolean.toString(!retained), "recursive", "true"));
    }
  }

  private static void closeReview(UUID id) {
    Task task = SdkClients.adminClient().tasks().get(id.toString());
    if (!TaskRepository.isTerminalStatus(task.getStatus()) && task.getResolution() == null) {
      SdkClients.adminClient().tasks().close(id.toString());
    }
    OntologyReviewReconciler reconciler = new OntologyReviewReconciler(Entity.getCollectionDAO());
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .until(
            () -> {
              reconciler.reconcile(id);
              return Entity.getCollectionDAO()
                      .entityExtensionDAO()
                      .getExtension(id, OntologyReviewReconciler.EXTENSION)
                  == null;
            });
  }

  @Test
  void nativeDefinitionIriSurvivesUpdatesAndRestoration(TestNamespace ns) {
    assumeFalse(Entity.ONTOLOGY.equals(getEntityType()));
    K request = createMinimalRequest(ns);
    setFieldViaReflection(request, "setIri", URI.class, null);
    T entity = createEntity(request);
    var ontology =
        SdkClients.adminClient().ontologies().get(entity.getOntology().getId().toString());
    assertEquals(ontology.getNamespace().toString() + entity.getId(), entity.getIri().toString());
    ontology.setNamespace(URI.create(ontology.getNamespace() + "new-definitions/"));
    SdkClients.adminClient().ontologies().update(ontology.getId(), ontology);

    setFieldViaReflection(request, "setDescription", String.class, "Revised native definition");
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, getResourcePath(), request);

    T updated = getEntity(entity.getId().toString());
    assertEquals(entity.getIri().toString(), updated.getIri().toString());
    assertEquals("Revised native definition", updated.getDescription());

    deleteEntity(entity.getId().toString());
    final T deleted = getEntityIncludeDeleted(entity.getId().toString());
    setFieldViaReflection(request, "setIri", URI.class, URI.create("urn:changed-identity"));
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    SdkClients.adminClient()
                        .getHttpClient()
                        .executeForString(HttpMethod.PUT, getResourcePath(), request))
            .getStatusCode());
    assertEquals(
        deleted.getVersion(), getEntityIncludeDeleted(entity.getId().toString()).getVersion());
    setFieldViaReflection(request, "setIri", URI.class, null);
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, getResourcePath(), request);
    assertEquals(
        entity.getIri().toString(), getEntity(entity.getId().toString()).getIri().toString());
  }

  @Test
  void semanticIriCannotBeCleared(TestNamespace ns) {
    T entity = createEntity(createMinimalRequest(ns));
    var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "remove").put("path", "/iri");
    OpenMetadataException rejected =
        assertThrows(
            OpenMetadataException.class, () -> entityService().patch(entity.getId(), patch));
    assertEquals(400, rejected.getStatusCode());
    assertEquals(
        entity.getIri().toString(), getEntity(entity.getId().toString()).getIri().toString());
  }

  @Test
  void semanticIdentityIsScopedToItsOntology(TestNamespace ns) {
    T entity = createEntity(createMinimalRequest(ns));
    K duplicate = createRequest(ns.prefix("duplicateIri"), ns);
    setFieldViaReflection(duplicate, "setIri", URI.class, entity.getIri());
    if (Entity.ONTOLOGY.equals(getEntityType())) {
      assertNotEquals(entity.getId(), createEntity(duplicate).getId());
    } else {
      OpenMetadataException conflict =
          assertThrows(OpenMetadataException.class, () -> createEntity(duplicate));
      assertEquals(409, conflict.getStatusCode());
    }
  }

  @Test
  void semanticIriCannotBeChangedEvenBySchemeCase(TestNamespace ns) {
    T entity = createEntity(createMinimalRequest(ns));
    var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch
        .addObject()
        .put("op", "replace")
        .put("path", "/iri")
        .put("value", entity.getIri().toString().replace("https:", "HTTPS:"));
    OpenMetadataException rejected =
        assertThrows(
            OpenMetadataException.class, () -> entityService().patch(entity.getId(), patch));
    assertEquals(400, rejected.getStatusCode());
    assertEquals(
        entity.getIri().toString(), getEntity(entity.getId().toString()).getIri().toString());
  }
}
