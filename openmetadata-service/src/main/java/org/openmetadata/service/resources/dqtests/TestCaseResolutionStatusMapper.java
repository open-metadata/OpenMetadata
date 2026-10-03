package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityTimeSeriesMapper;
import org.openmetadata.service.util.FullyQualifiedName;

public class TestCaseResolutionStatusMapper
    implements EntityTimeSeriesMapper<TestCaseResolutionStatus, CreateTestCaseResolutionStatus> {
  @Override
  public TestCaseResolutionStatus createToEntity(
      CreateTestCaseResolutionStatus create, String user) {
    TestCase testCaseEntity =
        Entity.getEntityByName(Entity.TEST_CASE, create.getTestCaseReference(), null, Include.ALL);
    User userEntity = Entity.getEntityByName(Entity.USER, user, null, Include.ALL);

    return createToEntity(create, userEntity.getEntityReference(), testCaseEntity);
  }

  /** Variant for bulk callers that have already resolved the test case and the caller. */
  public TestCaseResolutionStatus createToEntity(
      CreateTestCaseResolutionStatus create, EntityReference updatedBy, TestCase testCase) {
    return new TestCaseResolutionStatus()
        .withTimestamp(System.currentTimeMillis())
        .withTestCaseResolutionStatusType(create.getTestCaseResolutionStatusType())
        .withTestCaseResolutionStatusDetails(withResolvedAssignee(create))
        .withUpdatedBy(updatedBy)
        .withUpdatedAt(System.currentTimeMillis())
        .withTestCaseReference(testCase.getEntityReference())
        .withSeverity(create.getSeverity());
  }

  /**
   * A request may name the assignee by id or by name alone. The record keeps the full reference:
   * the incident lists show the assignee from it, and the incident groups count assignees by name.
   */
  private static Object withResolvedAssignee(CreateTestCaseResolutionStatus create) {
    Object details = create.getTestCaseResolutionStatusDetails();
    if (create.getTestCaseResolutionStatusType() != TestCaseResolutionStatusTypes.Assigned
        || details == null) {
      return details;
    }
    Assigned assigned = JsonUtils.convertValue(details, Assigned.class);
    EntityReference assignee = assigned.getAssignee();
    if (assignee == null) {
      return details;
    }
    String type = assignee.getType() != null ? assignee.getType() : Entity.USER;
    if (assignee.getId() != null) {
      return assigned.withAssignee(
          Entity.getEntityReferenceById(type, assignee.getId(), Include.NON_DELETED));
    }
    if (nullOrEmpty(assignee.getName())) {
      return details;
    }
    // The lookup takes an FQN: a name with a dot in it is quoted, and a user's is lowercased the
    // way the user repository builds it.
    String name = Entity.USER.equals(type) ? assignee.getName().toLowerCase() : assignee.getName();
    return assigned.withAssignee(
        Entity.getEntityReferenceByName(
            type, FullyQualifiedName.quoteName(name), Include.NON_DELETED));
  }
}
