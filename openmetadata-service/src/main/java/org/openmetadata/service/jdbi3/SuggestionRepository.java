package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.SUGGESTION_ACCEPTED;
import static org.openmetadata.schema.type.EventType.SUGGESTION_DELETED;
import static org.openmetadata.schema.type.EventType.SUGGESTION_REJECTED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.type.Relationship.CREATED;
import static org.openmetadata.schema.type.Relationship.IS_ABOUT;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.jdbi3.UserRepository.TEAMS_FIELD;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SuggestionStatus;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SuggestionException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.SuggestionsResource;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Repository
public class SuggestionRepository {
  private final CollectionDAO dao;

  public enum PaginationType {
    BEFORE,
    AFTER
  }

  public SuggestionRepository() {
    this.dao = Entity.getCollectionDAO();
    Entity.setSuggestionRepository(this);
    ResourceRegistry.addResource("suggestion", null, Entity.getEntityFields(Suggestion.class));
  }

  @Transaction
  public Suggestion create(Suggestion suggestion) {
    store(suggestion);
    storeRelationships(suggestion);
    return suggestion;
  }

  @Transaction
  public Suggestion update(Suggestion suggestion, String userName) {
    suggestion.setUpdatedBy(userName);
    dao.suggestionDAO().update(suggestion.getId(), JsonUtils.pojoToJson(suggestion));
    storeRelationships(suggestion);
    return suggestion;
  }

  @Transaction
  public void store(Suggestion suggestion) {
    // Insert a new Suggestion
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(suggestion.getEntityLink());
    dao.suggestionDAO().insert(entityLink.getEntityFQN(), JsonUtils.pojoToJson(suggestion));
  }

  @Transaction
  public void storeRelationships(Suggestion suggestion) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(suggestion.getEntityLink());
    // Add relationship User -- created --> Suggestion relationship
    dao.relationshipDAO()
        .insert(
            suggestion.getCreatedBy().getId(),
            suggestion.getId(),
            suggestion.getCreatedBy().getType(),
            Entity.SUGGESTION,
            CREATED.ordinal());

    // Add field relationship for data asset - Suggestion -- entityLink ---> entity/entityField
    dao.fieldRelationshipDAO()
        .insert(
            suggestion.getId().toString(), // from FQN
            entityLink.getFullyQualifiedFieldValue(), // to FQN,
            suggestion.getId().toString(),
            entityLink.getFullyQualifiedFieldValue(),
            Entity.SUGGESTION, // From type
            entityLink.getFullyQualifiedFieldType(), // to Type
            IS_ABOUT.ordinal(),
            null);
  }

  public Suggestion get(UUID id) {
    return EntityUtil.validate(id, dao.suggestionDAO().findById(id), Suggestion.class);
  }

  @Transaction
  public RestUtil.DeleteResponse<Suggestion> deleteSuggestion(
      Suggestion suggestion, String deletedByUser) {
    deleteSuggestionInternal(suggestion.getId());
    LOG.debug("{} deleted suggestion with id {}", deletedByUser, suggestion.getId());
    return new RestUtil.DeleteResponse<>(suggestion, SUGGESTION_DELETED);
  }

  @Transaction
  public RestUtil.DeleteResponse<EntityInterface> deleteSuggestionsForAnEntity(
      EntityInterface entity, String deletedByUser) {
    deleteSuggestionInternalForAnEntity(entity);
    LOG.debug("{} deleted suggestions for the entity id {}", deletedByUser, entity.getId());
    return new RestUtil.DeleteResponse<>(entity, SUGGESTION_DELETED);
  }

  @Transaction
  public void deleteSuggestionInternal(UUID id) {
    // Delete all the relationships to other entities
    dao.relationshipDAO().deleteAll(id, Entity.SUGGESTION);

    // Delete all the field relationships to other entities
    dao.fieldRelationshipDAO().deleteAllByPrefix(id.toString());

    // Finally, delete the suggestion
    dao.suggestionDAO().delete(id);
  }

  @Transaction
  public void deleteSuggestionInternalForAnEntity(EntityInterface entity) {
    // Delete all the field relationships to other entities
    dao.fieldRelationshipDAO().deleteAllByPrefix(entity.getId().toString());

    // Finally, delete the suggestion
    dao.suggestionDAO().deleteByFQN(entity.getFullyQualifiedName());
  }

  @Getter
  public static class SuggestionWorkflow {
    // The workflow is applied to a specific entity at a time
    protected final EntityInterface entity;

    SuggestionWorkflow(EntityInterface entity) {
      this.entity = entity;
    }

    public EntityInterface acceptSuggestion(Suggestion suggestion, EntityInterface entity) {
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(suggestion.getEntityLink());
      if (entityLink.getFieldName() != null) {
        EntityRepository<?> repository = Entity.getEntityRepository(entityLink.getEntityType());
        return repository.applySuggestion(
            entity, entityLink.getFullyQualifiedFieldValue(), suggestion);
      } else {
        if (suggestion.getType().equals(SuggestionType.SuggestTagLabel)) {
          List<TagLabel> tags = mergeTags(entity.getTags(), suggestion.getTagLabels());
          entity.setTags(tags);
          return entity;
        } else if (suggestion.getType().equals(SuggestionType.SuggestDescription)) {
          entity.setDescription(suggestion.getDescription());
          return entity;
        } else {
          throw new SuggestionException("Invalid suggestion Type");
        }
      }
    }
  }

  private static List<TagLabel> mergeTags(
      List<TagLabel> existingTags, List<TagLabel> incomingTags) {
    if (incomingTags == null || incomingTags.isEmpty()) {
      return existingTags;
    }
    // Throw an error if incoming tags are mutually exclusive
    TagLabelUtil.checkMutuallyExclusive(incomingTags);

    ArrayList<TagLabel> tags = new ArrayList<>();
    Set<String> incomingClassification =
        incomingTags.stream()
            .map(t -> FullyQualifiedName.getParentFQN(t.getTagFQN()))
            .collect(Collectors.toSet());

    // We'll give priority to incoming tags over existing tags
    // so we'll skip any existing tag that is mutually exclusive and clashing with incoming
    // classification
    for (TagLabel tag : existingTags) {
      if (TagLabelUtil.mutuallyExclusive(tag)
          && incomingClassification.contains(FullyQualifiedName.getParentFQN(tag.getTagFQN()))) {
        LOG.debug(
            String.format(
                "Incoming tags are mutually exclusive with existing tag [%s]", tag.getTagFQN()));
      } else {
        tags.add(tag);
      }
    }
    return naiveMergeTags(tags, incomingTags);
  }

  // Add all tags without repeats
  private static List<TagLabel> naiveMergeTags(
      List<TagLabel> existingTags, List<TagLabel> incomingTags) {
    List<TagLabel> tags = new ArrayList<>(existingTags);
    Set<String> existingTagFQNs =
        existingTags.stream().map(TagLabel::getTagFQN).collect(Collectors.toSet());
    for (TagLabel incomingTag : incomingTags) {
      if (!existingTagFQNs.contains(incomingTag.getTagFQN())) {
        tags.add(incomingTag);
      }
    }
    return tags;
  }

  public RestUtil.PutResponse<Suggestion> acceptSuggestion(
      UriInfo uriInfo,
      Suggestion suggestion,
      SecurityContext securityContext,
      Authorizer authorizer) {
    acceptSuggestion(suggestion, securityContext, authorizer);
    Suggestion updatedHref = SuggestionsResource.addHref(uriInfo, suggestion);
    return new RestUtil.PutResponse<>(Response.Status.OK, updatedHref, SUGGESTION_ACCEPTED);
  }

  public RestUtil.PutResponse<List<Suggestion>> acceptSuggestionList(
      UriInfo uriInfo,
      List<Suggestion> suggestions,
      SecurityContext securityContext,
      Authorizer authorizer) {
    acceptSuggestionList(suggestions, securityContext, authorizer);
    List<Suggestion> updatedHref =
        suggestions.stream()
            .map(suggestion -> SuggestionsResource.addHref(uriInfo, suggestion))
            .toList();
    return new RestUtil.PutResponse<>(Response.Status.OK, updatedHref, SUGGESTION_ACCEPTED);
  }

  protected void acceptSuggestion(
      Suggestion suggestion, SecurityContext securityContext, Authorizer authorizer) {
    String user = securityContext.getUserPrincipal().getName();
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(suggestion.getEntityLink());
    EntityRepository<?> repository = Entity.getEntityRepository(entityLink.getEntityType());
    EntityInterface entity =
        Entity.getEntity(entityLink, repository.getSuggestionFields(suggestion), ALL);
    // Prepare the original JSON before updating the Entity, otherwise we get an empty patch
    String origJson = JsonUtils.pojoToJson(entity);
    SuggestionWorkflow suggestionWorkflow = repository.getSuggestionWorkflow(entity);

    EntityInterface updatedEntity = suggestionWorkflow.acceptSuggestion(suggestion, entity);
    String updatedEntityJson = JsonUtils.pojoToJson(updatedEntity);

    // Patch the entity with the updated suggestions
    JsonPatch patch = JsonUtils.getJsonPatch(origJson, updatedEntityJson);

    OperationContext operationContext = new OperationContext(entityLink.getEntityType(), patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        new ResourceContext<>(entityLink.getEntityType(), entity.getId(), null));
    repository.patch(null, entity.getId(), user, patch, ChangeSource.SUGGESTED);
    suggestion.setStatus(SuggestionStatus.Accepted);
    update(suggestion, user);
  }

  @Transaction
  protected void acceptSuggestionList(
      List<Suggestion> suggestions, SecurityContext securityContext, Authorizer authorizer) {
    String user = securityContext.getUserPrincipal().getName();

    // Entity being updated
    EntityInterface entity = null;
    EntityRepository<?> repository = null;
    String origJson = null;
    SuggestionWorkflow suggestionWorkflow = null;

    for (Suggestion suggestion : suggestions) {
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(suggestion.getEntityLink());

      // Validate all suggestions indeed talk about the same entity
      if (entity == null) {
        // Initialize the Entity and the Repository
        repository = Entity.getEntityRepository(entityLink.getEntityType());
        entity =
            Entity.getEntity(entityLink, repository.getSuggestionFields(suggestion), NON_DELETED);
        origJson = JsonUtils.pojoToJson(entity);
        suggestionWorkflow = repository.getSuggestionWorkflow(entity);
      } else if (!entity.getFullyQualifiedName().equals(entityLink.getEntityFQN())) {
        throw new SuggestionException("All suggestions must be for the same entity");
      }
      // update entity with the suggestion
      entity = suggestionWorkflow.acceptSuggestion(suggestion, entity);
    }

    // Patch the entity with the updated suggestions
    String updatedEntityJson = JsonUtils.pojoToJson(entity);
    JsonPatch patch = JsonUtils.getJsonPatch(origJson, updatedEntityJson);

    OperationContext operationContext = new OperationContext(repository.getEntityType(), patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        new ResourceContext<>(repository.getEntityType(), entity.getId(), null));
    repository.patch(null, entity.getId(), user, patch, ChangeSource.SUGGESTED);

    // Only mark the suggestions as accepted after the entity has been successfully updated
    for (Suggestion suggestion : suggestions) {
      suggestion.setStatus(SuggestionStatus.Accepted);
      update(suggestion, user);
    }
  }

  public RestUtil.PutResponse<Suggestion> rejectSuggestion(
      UriInfo uriInfo, Suggestion suggestion, String user) {
    suggestion.setStatus(SuggestionStatus.Rejected);
    update(suggestion, user);
    Suggestion updatedHref = SuggestionsResource.addHref(uriInfo, suggestion);
    return new RestUtil.PutResponse<>(Response.Status.OK, updatedHref, SUGGESTION_REJECTED);
  }

  @Transaction
  public RestUtil.PutResponse<List<Suggestion>> rejectSuggestionList(
      UriInfo uriInfo, List<Suggestion> suggestions, String user) {
    for (Suggestion suggestion : suggestions) {
      suggestion.setStatus(SuggestionStatus.Rejected);
      update(suggestion, user);
      SuggestionsResource.addHref(uriInfo, suggestion);
    }
    return new RestUtil.PutResponse<>(Response.Status.OK, suggestions, SUGGESTION_REJECTED);
  }

  public void checkPermissionsForUpdateSuggestion(
      Suggestion suggestion, SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(USER, userName, TEAMS_FIELD, NON_DELETED);
    if (Boolean.FALSE.equals(user.getIsAdmin())
        && !userName.equalsIgnoreCase(suggestion.getCreatedBy().getName())) {
      throw new AuthorizationException(
          CatalogExceptionMessage.suggestionOperationNotAllowed(userName, "Update"));
    }
  }

  public void checkPermissionsForAcceptOrRejectSuggestion(
      Suggestion suggestion, SuggestionStatus status, SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(USER, userName, TEAMS_FIELD, NON_DELETED);
    MessageParser.EntityLink about = MessageParser.EntityLink.parse(suggestion.getEntityLink());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about);
    List<EntityReference> ownerRefs = Entity.getOwners(aboutRef);
    List<String> ownerTeamNames = new ArrayList<>();
    if (!nullOrEmpty(ownerRefs)) {
      for (EntityReference ownerRef : ownerRefs) {
        try {
          User owner =
              Entity.getEntityByName(
                  USER, ownerRef.getFullyQualifiedName(), TEAMS_FIELD, NON_DELETED);
          ownerTeamNames =
              owner.getTeams().stream().map(EntityReference::getFullyQualifiedName).toList();
        } catch (EntityNotFoundException e) {
          Team owner =
              Entity.getEntityByName(TEAM, ownerRef.getFullyQualifiedName(), "", NON_DELETED);
          ownerTeamNames.add(owner.getFullyQualifiedName());
        }
      }
    }

    List<String> userTeamNames =
        user.getTeams().stream().map(EntityReference::getFullyQualifiedName).toList();

    if (Boolean.FALSE.equals(user.getIsAdmin())
        && (!nullOrEmpty(ownerRefs)
            && ownerRefs.stream().noneMatch(ownerRef -> ownerRef.getName().equals(userName)))
        && Collections.disjoint(userTeamNames, ownerTeamNames)) {
      throw new AuthorizationException(
          CatalogExceptionMessage.suggestionOperationNotAllowed(userName, status.value()));
    }
  }

  public void checkPermissionsForEditEntity(
      Suggestion suggestion,
      SuggestionType suggestionType,
      SecurityContext securityContext,
      Authorizer authorizer) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(suggestion.getEntityLink());
    EntityInterface entity = Entity.getEntity(entityLink, "", NON_DELETED);
    // Check that the user has the right permissions to update the entity
    authorizer.authorize(
        securityContext,
        new OperationContext(
            entityLink.getEntityType(),
            suggestionType == SuggestionType.SuggestTagLabel
                ? MetadataOperation.EDIT_TAGS
                : MetadataOperation.EDIT_DESCRIPTION),
        new ResourceContext<>(entityLink.getEntityType(), entity.getId(), null));
  }

  public int listCount(SuggestionFilter filter) {
    String mySqlCondition = filter.getCondition(false);
    String postgresCondition = filter.getCondition(false);
    return dao.suggestionDAO().listCount(mySqlCondition, postgresCondition);
  }

  public ResultList<Suggestion> listBefore(SuggestionFilter filter, int limit, String before) {
    int total = listCount(filter);
    String mySqlCondition = filter.getCondition(true);
    String postgresCondition = filter.getCondition(true);
    List<String> jsons =
        dao.suggestionDAO()
            .listBefore(
                mySqlCondition, postgresCondition, limit + 1, RestUtil.decodeCursor(before));
    List<Suggestion> suggestions = getSuggestionList(jsons);
    String beforeCursor = null;
    String afterCursor;
    if (nullOrEmpty(suggestions)) {
      return new ResultList<>(suggestions, null, null, total);
    }
    if (suggestions.size() > limit) {
      suggestions.remove(0);
      beforeCursor = suggestions.get(0).getUpdatedAt().toString();
    }
    afterCursor =
        !suggestions.isEmpty()
            ? suggestions.get(suggestions.size() - 1).getUpdatedAt().toString()
            : null;
    return new ResultList<>(suggestions, beforeCursor, afterCursor, total);
  }

  public ResultList<Suggestion> listAfter(SuggestionFilter filter, int limit, String after) {
    int total = listCount(filter);
    String mySqlCondition = filter.getCondition(true);
    String postgresCondition = filter.getCondition(true);
    List<String> jsons =
        dao.suggestionDAO()
            .listAfter(mySqlCondition, postgresCondition, limit + 1, RestUtil.decodeCursor(after));
    List<Suggestion> suggestions = getSuggestionList(jsons);
    String beforeCursor;
    String afterCursor = null;
    if (nullOrEmpty(suggestions)) {
      return new ResultList<>(suggestions, null, null, total);
    }
    beforeCursor = after == null ? null : suggestions.get(0).getUpdatedAt().toString();
    if (suggestions.size() > limit) {
      suggestions.remove(limit);
      afterCursor = suggestions.get(limit - 1).getUpdatedAt().toString();
    }
    return new ResultList<>(suggestions, beforeCursor, afterCursor, total);
  }

  private List<Suggestion> getSuggestionList(List<String> jsons) {
    List<Suggestion> suggestions = new ArrayList<>();
    for (String json : jsons) {
      Suggestion suggestion = JsonUtils.readValue(json, Suggestion.class);
      suggestions.add(suggestion);
    }
    return suggestions;
  }

  public final List<Suggestion> listAll(SuggestionFilter filter) {
    ResultList<Suggestion> suggestionList = listAfter(filter, Integer.MAX_VALUE - 1, "");
    return suggestionList.getData();
  }
}
