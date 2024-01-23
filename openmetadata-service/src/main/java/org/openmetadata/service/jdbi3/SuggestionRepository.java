package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.SUGGESTION_ACCEPTED;
import static org.openmetadata.schema.type.EventType.SUGGESTION_REJECTED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.type.Relationship.CREATED;
import static org.openmetadata.schema.type.Relationship.IS_ABOUT;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.jdbi3.UserRepository.TEAMS_FIELD;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import javax.json.JsonPatch;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SuggestionStatus;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.feeds.SuggestionsResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository
public class SuggestionRepository {
  private final CollectionDAO dao;

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
    // Add relationship User -- created --> Thread relationship
    dao.relationshipDAO()
        .insert(
            suggestion.getCreatedBy().getId(),
            suggestion.getId(),
            suggestion.getCreatedBy().getType(),
            Entity.SUGGESTION,
            CREATED.ordinal());

    // Add field relationship for data asset - Thread -- isAbout ---> entity/entityField
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
    return new RestUtil.DeleteResponse<>(suggestion, ENTITY_DELETED);
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

  @Getter
  public static class SuggestionWorkflow {
    protected final Suggestion suggestion;

    SuggestionWorkflow(Suggestion suggestion) {
      this.suggestion = suggestion;
    }

    public EntityInterface acceptSuggestions(EntityInterface entityInterface) {
      if (suggestion.getType().equals(SuggestionType.SuggestTagLabel)) {
        entityInterface.setTags(suggestion.getTagLabels());
        return entityInterface;
      } else if (suggestion.getType().equals(SuggestionType.SuggestDescription)) {
        entityInterface.setDescription(suggestion.getDescription());
        return entityInterface;
      } else {
        throw new WebApplicationException("Invalid suggestion Type");
      }
    }
  }

  public RestUtil.PutResponse<Suggestion> acceptSuggestion(
      UriInfo uriInfo, Suggestion suggestion, String user) {
    suggestion.setStatus(SuggestionStatus.Accepted);
    acceptSuggestion(suggestion, user);
    Suggestion updatedHref = SuggestionsResource.addHref(uriInfo, suggestion);
    return new RestUtil.PutResponse<>(Response.Status.OK, updatedHref, SUGGESTION_ACCEPTED);
  }

  protected void acceptSuggestion(Suggestion suggestion, String user) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(suggestion.getEntityLink());
    EntityInterface entity =
        Entity.getEntity(
            entityLink, suggestion.getType() == SuggestionType.SuggestTagLabel ? "tags" : "", ALL);
    String origJson = JsonUtils.pojoToJson(entity);
    SuggestionWorkflow suggestionWorkflow = getSuggestionWorkflow(suggestion);
    EntityInterface updatedEntity = suggestionWorkflow.acceptSuggestions(entity);
    String updatedEntityJson = JsonUtils.pojoToJson(updatedEntity);
    JsonPatch patch = JsonUtils.getJsonPatch(origJson, updatedEntityJson);
    EntityRepository<?> repository = Entity.getEntityRepository(entityLink.getEntityType());
    repository.patch(null, entity.getId(), user, patch);
    suggestion.setStatus(SuggestionStatus.Accepted);
    update(suggestion, user);
  }

  public RestUtil.PutResponse<Suggestion> rejectSuggestion(
      UriInfo uriInfo, Suggestion suggestion, String user) {
    suggestion.setStatus(SuggestionStatus.Rejected);
    update(suggestion, user);
    Suggestion updatedHref = SuggestionsResource.addHref(uriInfo, suggestion);
    return new RestUtil.PutResponse<>(Response.Status.OK, updatedHref, SUGGESTION_REJECTED);
  }

  public void checkPermissionsForAcceptOrRejectSuggestion(
      Suggestion suggestion, SuggestionStatus status, SecurityContext securityContext) {
    String userName = securityContext.getUserPrincipal().getName();
    User user = Entity.getEntityByName(USER, userName, TEAMS_FIELD, NON_DELETED);
    MessageParser.EntityLink about = MessageParser.EntityLink.parse(suggestion.getEntityLink());
    EntityReference aboutRef = EntityUtil.validateEntityLink(about);
    EntityReference ownerRef = Entity.getOwner(aboutRef);
    User owner =
        Entity.getEntityByName(USER, ownerRef.getFullyQualifiedName(), TEAMS_FIELD, NON_DELETED);
    List<String> userTeamNames =
        user.getTeams().stream().map(EntityReference::getFullyQualifiedName).toList();
    List<String> ownerTeamNames =
        owner.getTeams().stream().map(EntityReference::getFullyQualifiedName).toList();
    if (Boolean.FALSE.equals(user.getIsAdmin())
        && !owner.getName().equals(userName)
        && Collections.disjoint(userTeamNames, ownerTeamNames)) {
      throw new AuthorizationException(
          CatalogExceptionMessage.taskOperationNotAllowed(userName, status.value()));
    }
  }

  public SuggestionWorkflow getSuggestionWorkflow(Suggestion suggestion) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(suggestion.getEntityLink());
    EntityRepository<?> repository = Entity.getEntityRepository(entityLink.getEntityType());
    return repository.getSuggestionWorkflow(suggestion);
  }
}
