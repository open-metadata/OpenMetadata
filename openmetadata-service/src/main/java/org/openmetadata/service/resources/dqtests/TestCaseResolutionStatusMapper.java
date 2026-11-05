package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Locale;
import java.util.Objects;
import java.util.Set;
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
  private static final Set<String> ASSIGNEE_TYPES = Set.of(Entity.USER, Entity.TEAM);

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
    Assigned assigned = assignedDetails(create);
    return assigned == null || assigned.getAssignee() == null
        ? create.getTestCaseResolutionStatusDetails()
        : assigned.withAssignee(resolveAssignee(assigned.getAssignee()));
  }

  private static Assigned assignedDetails(CreateTestCaseResolutionStatus create) {
    boolean isAssigned =
        create.getTestCaseResolutionStatusType() == TestCaseResolutionStatusTypes.Assigned
            && create.getTestCaseResolutionStatusDetails() != null;
    return isAssigned
        ? JsonUtils.convertValue(create.getTestCaseResolutionStatusDetails(), Assigned.class)
        : null;
  }

  private static EntityReference resolveAssignee(EntityReference assignee) {
    String type = assigneeType(assignee);
    EntityReference result = assignee;
    if (assignee.getId() != null) {
      result = Entity.getEntityReferenceById(type, assignee.getId(), Include.NON_DELETED);
    } else if (!nullOrEmpty(assignee.getName())) {
      result =
          Entity.getEntityReferenceByName(
              type, assigneeFqn(type, assignee.getName()), Include.NON_DELETED);
    }
    return result;
  }

  // The type is the client's to send, not to choose: only a user or a team can own an incident.
  private static String assigneeType(EntityReference assignee) {
    String type = Objects.requireNonNullElse(assignee.getType(), Entity.USER);
    if (!ASSIGNEE_TYPES.contains(type)) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid assignee type '%s'. Must be one of [%s, %s]",
              type, Entity.USER, Entity.TEAM));
    }
    return type;
  }

  // The lookup takes an FQN: a name with a dot in it is quoted, and a user's is lowercased the way
  // the user repository builds it.
  private static String assigneeFqn(String type, String name) {
    return FullyQualifiedName.quoteName(
        Entity.USER.equals(type) ? name.toLowerCase(Locale.ROOT) : name);
  }
}
