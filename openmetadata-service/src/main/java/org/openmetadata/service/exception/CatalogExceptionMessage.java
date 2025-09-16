/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.exception;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

public final class CatalogExceptionMessage {
  public static final String REINDEXING_ALREADY_RUNNING = "REINDEXING_ALREADY_RUNNING";
  public static final String FAILED_SEND_EMAIL = "FAILED_SEND_EMAIL";
  public static final String EMAIL_SENDING_ISSUE =
      "There is some issue in sending the Mail. Please contact your administrator.";
  public static final String PASSWORD_INVALID_FORMAT =
      "Password must be of minimum 8 characters, with one special, one Upper, one lower case character, and one Digit.";
  public static final String MAX_FAILED_LOGIN_ATTEMPT =
      "Failed Login Attempts Exceeded. Use Forgot Password or retry after some time.";

  public static final String INCORRECT_OLD_PASSWORD = "INCORRECT_OLD_PASSWORD";

  public static final String INVALID_USER_OR_PASSWORD = "INVALID_USER_OR_PASSWORD";
  public static final String INVALID_USERNAME_PASSWORD =
      "You have entered an invalid username or password.";

  public static final String PASSWORD_RESET_TOKEN_EXPIRED = "PASSWORD_RESET_TOKEN_EXPIRED";
  public static final String ENTITY_ALREADY_EXISTS = "Entity already exists";
  public static final String FERNET_KEY_NULL = "Fernet key is null";
  public static final String FIELD_NOT_TOKENIZED = "Field is not tokenized";
  public static final String FIELD_ALREADY_TOKENIZED = "Field is already tokenized";
  public static final String INVALID_ENTITY_LINK =
      "Entity link must have both {arrayFieldName} and {arrayFieldValue}";
  public static final String EMPTY_POLICIES_IN_ROLE = "At least one policy is required in a role";
  public static final String EMPTY_RULES_IN_POLICY = "At least one rule is required in a policy";
  public static final String INVALID_GROUP_TEAM_UPDATE = "Team of type Group cannot be updated";
  public static final String INVALID_GROUP_TEAM_CHILDREN_UPDATE =
      "A team with children cannot be updated to type Group";
  public static final String ANNOUNCEMENT_OVERLAP =
      "There is already an announcement scheduled that overlaps with the given start time and end time";
  public static final String ANNOUNCEMENT_INVALID_START_TIME =
      "Announcement start time must be earlier than the end time";
  public static final String UNEXPECTED_PARENT =
      "Team of type Organization can't have a parent team";
  public static final String DELETE_ORGANIZATION = "Organization team type can't be deleted";
  public static final String CREATE_ORGANIZATION =
      "Only one Organization is allowed. New Organization type can't be created";
  public static final String CREATE_GROUP =
      "Team of type Group can't have children of type team. Only users are allowed as part of the team";
  public static final String TEAM_HIERARCHY =
      "Unexpected error occurred while building the teams hierarchy";
  public static final String LDAP_MISSING_ATTR =
      "Username or Email Attribute is incorrect. Please check Openmetadata Configuration.";
  public static final String MULTIPLE_EMAIL_ENTRIES_ERROR = "MULTIPLE_EMAIL_ENTRIES_ERROR";
  public static final String MULTIPLE_EMAIL_ENTRIES =
      "Email corresponds to multiple entries in Directory.";

  public static final String INVALID_EMAIL_PASSWORD =
      "You have entered an invalid email or password.";

  public static final String EMAIL_EXISTS = "EMAIL_EXISTS";

  public static final String SELF_SIGNUP_NOT_ENABLED = "SELF_SIGNUP_NOT_ENABLED";
  public static final String SELF_SIGNUP_ERROR = "Signup is not supported.";
  public static final String OTHER_USER_SIGN_UP_ERROR = "OTHER_USER_SIGN_UP_ERROR";
  public static final String OTHER_USER_SIGN_UP =
      "Self Signup can only create user for self. Only Admin can create other users.";
  public static final String SELF_SIGNUP_DISABLED_MESSAGE =
      "Self Signup is not enabled. Please contact your Administrator for assistance with account creation";

  public static final String NOT_IMPLEMENTED_METHOD = "Method not implemented.";

  public static final String AUTHENTICATOR_OPERATION_NOT_SUPPORTED =
      "AUTHENTICATOR_OPERATION_NOT_SUPPORTED";
  public static final String FORBIDDEN_AUTHENTICATOR_OP =
      "Operation is not permitted with the Selected Authenticator.";

  public static final String INVALID_TOKEN = "INVALID_TOKEN";
  public static final String TOKEN_EXPIRED = "TOKEN_EXPIRED";
  public static final String TOKEN_EXPIRY_ERROR =
      "Email Verification Token %s is expired. Please issue a new request for email verification.";
  public static final String INVALID_BOT_USER = "Revoke Token can only be applied to Bot Users.";
  public static final String NO_MANUAL_TRIGGER_ERR = "App does not support manual trigger.";
  public static final String INVALID_APP_TYPE = "Application Type is not valid.";
  public static final String CSV_EXPORT_FAILED = "CSV Export Failed.";

  private CatalogExceptionMessage() {}

  public static String entityNotFound(String entityType, String id) {
    return String.format("%s instance for %s not found", entityType, id);
  }

  public static String entityNotFound(String entityType, UUID id) {
    return entityNotFound(entityType, id.toString());
  }

  public static String readOnlyAttribute(String entityType, String attribute) {
    return String.format("%s attribute %s can't be modified", entityType, attribute);
  }

  public static String invalidName(String name) {
    if (name == null) {
      return "name must not be null";
    }
    return String.format("Invalid name %s", name);
  }

  public static String invalidField(String field) {
    return String.format("Invalid field name %s", field);
  }

  public static String entityTypeNotFound(String entityType) {
    return String.format("Entity type %s not found", entityType);
  }

  public static String entityRepositoryNotFound(String entityType) {
    return String.format(
        "Entity repository for %s not found. Is the ENTITY_TYPE_MAP initialized?", entityType);
  }

  public static String entityRelationshipNotFound(
      String entityType, UUID id, String relationshipName, String toEntityType) {
    return String.format(
        "Entity type %s %s does not have expected relationship %s to/from entity type %s",
        entityType, id, relationshipName, toEntityType);
  }

  public static String resourceTypeNotFound(String resourceType) {
    return String.format("Resource type %s not found", resourceType);
  }

  public static String entityTypeNotSupported(String entityType) {
    return String.format("Entity type %s not supported", entityType);
  }

  public static String deletedUser(UUID id) {
    return String.format("User %s is deleted", id);
  }

  public static String userAlreadyPartOfTeam(String userName, String teamName) {
    return String.format("User '%s' is already part of the team '%s'", userName, teamName);
  }

  public static String invalidColumnFQN(String fqn) {
    return String.format("Invalid fully qualified column name %s", fqn);
  }

  public static String invalidFieldName(String fieldType, String fieldName) {
    return String.format("Invalid %s name %s", fieldType, fieldName);
  }

  public static String invalidFieldFQN(String fqn) {
    return String.format("Invalid fully qualified field name %s", fqn);
  }

  public static String entityVersionNotFound(String entityType, UUID id, Double version) {
    return String.format("%s instance for %s and version %s not found", entityType, id, version);
  }

  public static String invalidServiceEntity(
      String serviceType, String entityType, String expected) {
    return String.format(
        "Invalid service type `%s` for %s. Expected %s.", serviceType, entityType, expected);
  }

  public static String glossaryTermMismatch(String parentId, String glossaryId) {
    return String.format(
        "Invalid queryParameters - glossary term `parent` %s is not in the `glossary` %s",
        parentId, glossaryId);
  }

  public static String notAdmin(String name) {
    return String.format("Principal: CatalogPrincipal{name='%s'} is not admin", name);
  }

  public static String operationNotAllowed(String name, MetadataOperation operation) {
    return String.format(
        "Principal: CatalogPrincipal{name='%s'} operations [%s] not allowed",
        name, operation.value());
  }

  public static String notReviewer(String name) {
    return String.format("User '%s' is not a reviewer", name);
  }

  public static String permissionDenied(
      String user,
      MetadataOperation operation,
      String roleName,
      String policyName,
      String ruleName) {
    if (roleName != null) {
      return String.format(
          "Principal: CatalogPrincipal{name='%s'} operation %s denied by role %s, policy %s, rule %s",
          user, operation, roleName, policyName, ruleName);
    }
    return String.format(
        "Principal: CatalogPrincipal{name='%s'} operation %s denied policy %s, rule %s",
        user, operation, policyName, ruleName);
  }

  public static String permissionNotAllowed(String user, List<MetadataOperation> operations) {
    return String.format(
        "Principal: CatalogPrincipal{name='%s'} operations %s not allowed", user, operations);
  }

  public static String resourcePermissionNotAllowed(
      String user, List<MetadataOperation> operations, List<String> resources) {
    return String.format(
        "Principal: CatalogPrincipal{name='%s'} operations %s not allowed for resources {%s}.",
        user, operations, resources);
  }

  public static String domainPermissionNotAllowed(
      String user, List<EntityReference> domains, List<MetadataOperation> operations) {
    return String.format(
        "Principal: CatalogPrincipal{name='%s'} does not belong to domains [%s] to perform the %s operations.",
        user,
        domains.stream().map(EntityReference::getName).collect(Collectors.joining(", ")),
        operations);
  }

  public static String taskOperationNotAllowed(String user, String operations) {
    return String.format(
        "Principal: CatalogPrincipal{name='%s'} operations %s not allowed", user, operations);
  }

  public static String suggestionOperationNotAllowed(String user, String operations) {
    return String.format(
        "Principal: CatalogPrincipal{name='%s'} operations %s not allowed", user, operations);
  }

  public static String entityIsNotEmpty(String entityType) {
    return String.format("%s is not empty", entityType);
  }

  public static String unknownCustomField(String fieldName) {
    return String.format("Unknown custom field %s", fieldName);
  }

  public static String dateTimeValidationError(String fieldName, String format) {
    return String.format(
        "Custom field %s value is not as per defined format %s", fieldName, format);
  }

  public static String jsonValidationError(String fieldName, String validationMessages) {
    return String.format("Custom field %s has invalid JSON %s", fieldName, validationMessages);
  }

  public static String customPropertyConfigError(String fieldName, String validationMessages) {
    return String.format("Custom Property %s has invalid value %s", fieldName, validationMessages);
  }

  public static String invalidParent(Team parent, String child, TeamType childType) {
    return String.format(
        "Team %s of type %s can't be of parent of team %s of type %s",
        parent.getName(), parent.getTeamType(), child, childType);
  }

  public static String invalidChild(String parent, TeamType parentType, Team child) {
    return String.format(
        "Team %s of type %s can't have child team %s of type %s",
        parent, parentType, child.getName(), child.getTeamType());
  }

  public static String invalidParentCount(int validParentCount, TeamType teamType) {
    return String.format("Team of type %s can have only %s parents", teamType, validParentCount);
  }

  public static String invalidTeamOwner(TeamType teamType) {
    return String.format(
        "Team of type %s can't own entities. Only Team of type Group can own entities.", teamType);
  }

  public static String invalidTeamUpdateUsers(TeamType teamType) {
    return String.format(
        "Team is of type %s. Users can be updated only in team of type Group.", teamType);
  }

  public static String invalidOwnerType(String entityType) {
    return String.format(
        "Entity of type %s can't be the owner. Only Team of type Group or a User can own entities.",
        entityType);
  }

  public static String onlyOneTeamAllowed() {
    return "Only One Team is allowed to own Data Assets.";
  }

  public static String noTeamAndUserComboAllowed() {
    return "Data Assets can have up to 5 users or a Team but not both as owners.";
  }

  public static String failedToParse(String message) {
    return String.format("Failed to parse - %s", message);
  }

  public static String failedToEvaluate(String message) {
    return String.format("Failed to evaluate - %s", message);
  }

  public static String systemEntityDeleteNotAllowed(String name, String entityType) {
    return String.format("System entity [%s] of type %s can not be deleted.", name, entityType);
  }

  public static String systemEntityRenameNotAllowed(String name, String entityType) {
    return String.format("System entity [%s] of type %s can not be renamed.", name, entityType);
  }

  public static String systemEntityModifyNotAllowed(String name, String entityType) {
    return String.format("System entity [%s] of type %s can not be modified.", name, entityType);
  }

  public static String mutuallyExclusiveLabels(TagLabel tag1, TagLabel tag2) {
    return String.format(
        "Tag labels %s and %s are mutually exclusive and can't be assigned together",
        tag1.getTagFQN(), tag2.getTagFQN());
  }

  public static String disabledTag(TagLabel tag) {
    return String.format(
        "Tag label %s is disabled and can't be assigned to a data asset.", tag.getTagFQN());
  }

  public static String csvNotSupported(String entityType) {
    return String.format(
        "Upload/download CSV for bulk operations is not supported for entity [%s]", entityType);
  }

  public static String userAlreadyBot(String userName, String botName) {
    return String.format("Bot user [%s] is already used by [%s] bot", userName, botName);
  }

  public static String invalidGlossaryTermMove(String term, String newParent) {
    return String.format(
        "Can't move Glossary term %s to its child Glossary term %s", term, newParent);
  }

  public static String eventPublisherFailedToPublish(
      SubscriptionDestination.SubscriptionType type, ChangeEvent event, String message) {
    return String.format(
        "Failed to publish event %s to %s due to %s ",
        JsonUtils.pojoToJson(event), type.value(), message);
  }

  public static String eventPublisherFailedToPublish(
      SubscriptionDestination.SubscriptionType type, String message) {
    return String.format(
        "Failed to publish event of destination type %s due to %s ", type.value(), message);
  }

  public static String invalidTaskField(EntityLink entityLink, TaskType taskType) {
    return String.format(
        "The Entity link with no field name - %s is not supported for %s task.",
        entityLink, taskType);
  }

  public static String invalidFieldForTask(String fieldName, TaskType type) {
    return String.format("The field name %s is not supported for %s task.", fieldName, type);
  }

  public static String invalidReviewerType(String type) {
    return String.format("Reviewers can only be a Team or User. Given Reviewer Type : %s", type);
  }

  public static String invalidEnumValue(Class<? extends Enum<?>> enumClass) {
    String className = enumClass.getSimpleName();
    String classNameWithLowercaseFirstLetter =
        className.substring(0, 1).toLowerCase() + className.substring(1);

    return invalidEnumValue(enumClass, classNameWithLowercaseFirstLetter);
  }

  public static String invalidEnumValue(Class<? extends Enum<?>> enumClass, String key) {
    String enumValues =
        Arrays.stream(enumClass.getEnumConstants())
            .map(Object::toString)
            .collect(Collectors.joining(", "));
    return "query param " + key + " must be one of [" + enumValues + "]";
  }

  public static String duplicateGlossaryTerm(String termName, String glossaryName) {
    return String.format(
        "A term with the name '%s' already exists in '%s' glossary.", termName, glossaryName);
  }
}
