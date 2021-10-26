package org.openmetadata.catalog.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.openmetadata.common.utils.JsonSchemaUtil;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

public abstract class EntityTestHelper<T> extends CatalogApplicationTest {
  private final Class<T> entityClass;

  public EntityTestHelper(Class<T> entityClass) {
    this.entityClass = entityClass;
  }

  /**
   * Methods to be overridden entity classes
   */
  public abstract WebTarget getCollection();

  public abstract WebTarget getResource(UUID id);

  public abstract void validateCreatedEntity(T createdEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException;

  public abstract void validateUpdatedEntity(T updatedEntity, Object request, Map<String, String> authHeaders)
          throws HttpResponseException;

  public abstract void validatePatchedEntity(T expected, T updated, Map<String, String> authHeaders)
          throws HttpResponseException;


  public abstract T getEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException;

  public abstract EntityInterface<T> getEntityInterface(T entity);

  public final T createEntity(Object createRequest, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.post(getCollection(), createRequest, entityClass, authHeaders);
  }

  public final T updateEntity(Object updateRequest, Status status, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.put(getCollection(), updateRequest, entityClass, status, authHeaders);
  }

  public final T patchEntity(UUID id, String originalJson, T updated, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatedTableJson = JsonUtils.pojoToJson(updated);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedTableJson);
    return TestUtils.patch(getResource(id), patch, entityClass, authHeaders);
  }

  public final T createAndCheckEntity(Object create, Map<String, String> authHeaders) throws HttpResponseException {
    // Validate an entity that is created has all the information set in create request
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    T entity = createEntity(create, authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(entity);

    assertEquals(updatedBy, entityInterface.getUpdatedBy());
    assertEquals(0.1, entityInterface.getVersion()); // First version of the entity
    validateCreatedEntity(entity, create, authHeaders);

    // GET the entity created and ensure it has all the information set in create request
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    assertEquals(0.1, entityInterface.getVersion()); // First version of the entity
    validateCreatedEntity(getEntity, create, authHeaders);

    return entity;
  }

  public T updateAndCheckEntity(Object request, Status status, Map<String, String> authHeaders,
                                UpdateType updateType, ChangeDescription changeDescription)
          throws HttpResponseException {
    T updated = updateEntity(request, status, authHeaders);
    validateUpdatedEntity(updated, request, authHeaders);
    validateChangeDescription(updated, updateType, changeDescription);

    // GET the newly updated database and validate
    EntityInterface<T> entityInterface = getEntityInterface(updated);
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    validateUpdatedEntity(getEntity, request, authHeaders);
    validateChangeDescription(getEntity, updateType, changeDescription);
    return updated;
  }

  public final T patchEntityAndCheck(T updated, String originalJson, Map<String, String> authHeaders,
                                     UpdateType updateType, ChangeDescription expectedChange)
          throws JsonProcessingException, HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    EntityInterface<T> entityInterface = getEntityInterface(updated);

    // Validate information returned in patch response has the updates
    T returned = patchEntity(entityInterface.getId(), originalJson, updated, authHeaders);
    validatePatchedEntity(updated, returned, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);

    // GET the entity and Validate information returned
    T getEntity = getEntity(entityInterface.getId(), authHeaders);
    validatePatchedEntity(updated, returned, authHeaders);
    validateChangeDescription(getEntity, updateType, expectedChange);
    return returned;
  }

  public final void validateCommonEntityFields(EntityInterface<T> entity, String expectedDescription,
                                               String expectedUpdatedByUser, EntityReference expectedOwner) {
    assertNotNull(entity.getId());
    assertNotNull(entity.getHref());
    assertNotNull(entity.getFullyQualifiedName());
    assertEquals(expectedDescription, entity.getDescription());
    assertEquals(expectedUpdatedByUser, entity.getUpdatedBy());
    assertOwner(expectedOwner, entity.getOwner());
  }

  public final void validateChangeDescription(T updated, UpdateType updateType,
                                              ChangeDescription expectedChange) {
    EntityInterface<T> updatedEntityInterface = getEntityInterface(updated);
    if (updateType == UpdateType.CREATED) {
      return; // PUT operation was used to create an entity. No change description expected.
    }
    TestUtils.validateUpdate(expectedChange.getPreviousVersion(), updatedEntityInterface.getVersion(), updateType);

    if (updateType != UpdateType.NO_CHANGE) {
      ChangeDescription change = updatedEntityInterface.getChangeDescription();
      assertEquals(expectedChange.getPreviousVersion(), change.getPreviousVersion());

      assertFieldLists(expectedChange.getFieldsAdded(), change.getFieldsAdded());
      assertFieldLists(expectedChange.getFieldsUpdated(), change.getFieldsUpdated());
      assertFieldLists(expectedChange.getFieldsDeleted(), change.getFieldsDeleted());
    }
  }

  public void assertFieldLists(List<String> expectedList, List<String> actualList) {
    expectedList.sort(Comparator.comparing(String::toString));
    actualList.sort(Comparator.comparing(String::toString));
    assertIterableEquals(expectedList, actualList);
  }

  public ChangeDescription getChangeDescription(Double previousVersion) {
    return new ChangeDescription().withPreviousVersion(previousVersion)
            .withFieldsAdded(new ArrayList<>()).withFieldsUpdated(new ArrayList<>())
            .withFieldsDeleted(new ArrayList<>());
  }

  public static void assertOwner(EntityReference expected, EntityReference actual) {
    if (expected != null) {
      TestUtils.validateEntityReference(actual);
      assertEquals(expected.getId(), actual.getId());
      assertEquals(expected.getType(), actual.getType());
    } else {
      assertNull(actual);
    }
  }
}
