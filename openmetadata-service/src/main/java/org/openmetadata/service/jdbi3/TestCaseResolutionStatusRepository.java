package org.openmetadata.service.jdbi3;

import java.beans.BeanInfo;
import java.beans.IntrospectionException;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class TestCaseResolutionStatusRepository extends EntityTimeSeriesRepository<TestCaseResolutionStatus> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases/testCaseFailureStatus";
  public static final String TESTCASE_RESOLUTION_STATUS_EXTENSION = "testCase.testCaseResolutionStatus";

  public TestCaseResolutionStatusRepository() {
    super(
        COLLECTION_PATH,
        Entity.getCollectionDAO().testCaseResolutionStatusTimeSeriesDao(),
        TestCaseResolutionStatus.class,
        Entity.ENTITY_TEST_CASE_FAILURE_STATUS);
  }

  public ResultList<TestCaseResolutionStatus> listTestCaseFailureStatusesForSequenceId(UUID sequenceId) {
    List<String> jsons =
        ((CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO) timeSeriesDao)
            .listTestCaseFailureStatusesForSequenceId(sequenceId);
    List<TestCaseResolutionStatus> testCaseFailureStatuses =
        JsonUtils.readObjects(jsons, TestCaseResolutionStatus.class);

    return getResultList(testCaseFailureStatuses, null, null, testCaseFailureStatuses.size());
  }

  public RestUtil.PatchResponse<TestCaseResolutionStatus> patch(UUID id, JsonPatch patch, String user)
      throws IntrospectionException, InvocationTargetException, IllegalAccessException {
    String originalJson = timeSeriesDao.getById(id);
    if (originalJson == null) {
      throw new EntityNotFoundException(String.format("Entity with id %s not found", id));
    }
    TestCaseResolutionStatus original = JsonUtils.readValue(originalJson, entityClass);
    TestCaseResolutionStatus updated = JsonUtils.applyPatch(original, patch, entityClass);

    updated.setUpdatedAt(System.currentTimeMillis());
    updated.setUpdatedBy(EntityUtil.getEntityReference("User", user));
    validatePatchFields(updated, original);

    timeSeriesDao.update(JsonUtils.pojoToJson(updated), id);
    return new RestUtil.PatchResponse<>(Response.Status.OK, updated, RestUtil.ENTITY_UPDATED);
  }

  private void validatePatchFields(TestCaseResolutionStatus updated, TestCaseResolutionStatus original)
      throws IntrospectionException, InvocationTargetException, IllegalAccessException {
    // Validate that only updatedAt and updatedBy fields are updated
    BeanInfo beanInfo = Introspector.getBeanInfo(TestCaseResolutionStatus.class);

    for (PropertyDescriptor propertyDescriptor : beanInfo.getPropertyDescriptors()) {
      String propertyName = propertyDescriptor.getName();
      if ((!propertyName.equals("updatedBy")) && (!propertyName.equals("updatedAt"))) {
        Object originalValue = propertyDescriptor.getReadMethod().invoke(original);
        Object updatedValue = propertyDescriptor.getReadMethod().invoke(updated);
        if (originalValue != null && !originalValue.equals(updatedValue)) {
          throw new IllegalArgumentException(String.format("Field %s is not allowed to be updated", propertyName));
        }
      }
    }
  }
}
