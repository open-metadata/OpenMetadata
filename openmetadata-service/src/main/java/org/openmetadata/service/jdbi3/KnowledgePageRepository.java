package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.Relationship.EDITED_BY;
import static org.openmetadata.schema.type.Relationship.HAS;
import static org.openmetadata.schema.type.Relationship.RELATED_TO;
import static org.openmetadata.service.Entity.FIELD_PARENT;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.Entity.getEntity;
import static org.openmetadata.service.Entity.getEntityReferencesByIds;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidPageMove;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getId;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.attachments.AssetType;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageHierarchy;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.drive.PageContextProcessingEngineHolder;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.knowledge.KnowledgePageResource;
import org.openmetadata.service.search.PropagationDescriptor;
import org.openmetadata.service.search.vector.PageBodyTextContributor;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.AISettingsUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
@Repository
public class KnowledgePageRepository extends EntityRepository<Page> {
  public static final String KNOWLEDGE_PAGE_ENTITY = "page";

  static {
    PageBodyTextContributor.INSTANCE.register();
  }

  private static final String KNOWLEDGE_PATCH_FIELDS = "page,relatedEntities,parent,children";
  private static final String KNOWLEDGE_UPDATE_FIELDS = "page,relatedEntities,parent,children";
  public static final String RELATED_ENTITIES = "relatedEntities";
  public static final String EDITORS = "editors";
  public static final String MEMORY_COUNT = "memoryCount";
  public static final String KNOWLEDGE_PAGE_TERM_SEARCH_INDEX = "page";
  private final CollectionDAO.KnowledgePageDAO daoExtension;
  private final CollectionDAO.AssetDAO assetDAO;

  /**
   * IMPORTANT: relatedEntities excludes domains and dataProducts as they use the HAS relationship
   * and are managed separately in EntityRepository. Always use filterOutDomainsAndDataProducts()
   * when working with relatedEntities to prevent duplicate assignments.
   */
  public KnowledgePageRepository(Jdbi jdbi) {
    super(
        KnowledgePageResource.COLLECTION_PATH,
        KNOWLEDGE_PAGE_ENTITY,
        Page.class,
        (jdbi.onDemand(CollectionDAO.class)).knowledgePageDAO(),
        KNOWLEDGE_PATCH_FIELDS,
        KNOWLEDGE_UPDATE_FIELDS);
    supportsSearch = true;
    // NOTE: SearchIndexFactory registration handled by OpenMetadata core
    this.daoExtension = jdbi.onDemand(CollectionDAO.class).knowledgePageDAO();
    this.assetDAO = jdbi.onDemand(CollectionDAO.class).assetDAO();
  }

  @Override
  public List<PropagationDescriptor> getSearchPropagationDescriptors() {
    List<PropagationDescriptor> descriptors =
        new ArrayList<>(super.getSearchPropagationDescriptors());
    descriptors.add(
        new PropagationDescriptor(
            "parent", PropagationDescriptor.PropagationType.ENTITY_REFERENCE, null));
    return descriptors;
  }

  @Override
  public void setFields(
      Page knowledgePage, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    knowledgePage.setRelatedEntities(
        fields.contains(RELATED_ENTITIES)
            ? getRelatedEntities(knowledgePage)
            : knowledgePage.getRelatedEntities());
    knowledgePage.setEditors(
        fields.contains(EDITORS) ? getEditors(knowledgePage) : knowledgePage.getEditors());
    knowledgePage.setParent(
        fields.contains(FIELD_PARENT) ? getParent(knowledgePage) : knowledgePage.getParent());
    knowledgePage.setChildren(
        fields.contains("children") ? getChildren(knowledgePage) : knowledgePage.getChildren());
    if (fields.contains(MEMORY_COUNT)) {
      knowledgePage.setMemoryCount(
          findTo(
                  knowledgePage.getId(),
                  KNOWLEDGE_PAGE_ENTITY,
                  Relationship.MENTIONED_IN,
                  Entity.CONTEXT_MEMORY)
              .size());
    }
    if (knowledgePage.getPageType().equals(PageType.ARTICLE)) {
      Article article = new Article();
      if (knowledgePage.getPage() != null) {
        article = JsonUtils.convertValue(knowledgePage.getPage(), Article.class);
      }
      article.setRelatedArticles(
          fields.contains(RELATED_ENTITIES)
              ? getRelatedArticles(knowledgePage)
              : article.getRelatedArticles());
      knowledgePage.setPage(article);
      knowledgePage.setAttachments(
          fields.contains("attachments")
              ? getAttachments(knowledgePage)
              : knowledgePage.getAttachments());
    }
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Page> entities) {
    if (nullOrEmpty(entities)) {
      return;
    }
    fetchAndSetParents(entities, fields);
    fetchAndSetRelatedEntities(entities, fields);
    fetchAndSetEditors(entities, fields);
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (Page entity : entities) {
      setArticleFields(entity, fields);
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetParents(List<Page> entities, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_PARENT)) {
      return;
    }
    Map<UUID, EntityReference> parentByPageId = batchFetchParents(entities);
    entities.forEach(page -> page.setParent(parentByPageId.get(page.getId())));
  }

  private Map<UUID, EntityReference> batchFetchParents(List<Page> entities) {
    Map<UUID, EntityReference> parentByPageId = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities),
                Relationship.CONTAINS.ordinal(),
                KNOWLEDGE_PAGE_ENTITY,
                Include.NON_DELETED);
    Map<UUID, EntityReference> refById = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID pageId = UUID.fromString(record.getToId());
      UUID parentId = UUID.fromString(record.getFromId());
      EntityReference ref =
          refById.computeIfAbsent(
              parentId,
              id -> Entity.getEntityReferenceById(KNOWLEDGE_PAGE_ENTITY, id, Include.NON_DELETED));
      parentByPageId.put(pageId, ref);
    }
    return parentByPageId;
  }

  private void fetchAndSetRelatedEntities(List<Page> entities, EntityUtil.Fields fields) {
    if (!fields.contains(RELATED_ENTITIES)) {
      return;
    }
    Map<UUID, List<EntityReference>> relatedByPageId = batchFetchRelatedEntities(entities);
    entities.forEach(
        page ->
            page.setRelatedEntities(
                relatedByPageId.getOrDefault(page.getId(), Collections.emptyList())));
  }

  private Map<UUID, List<EntityReference>> batchFetchRelatedEntities(List<Page> entities) {
    Map<UUID, List<EntityReference>> relatedByPageId = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(entities), HAS.ordinal(), Include.NON_DELETED);
    Map<String, EntityReference> refById = resolveReferencesByType(records);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      EntityReference ref = refById.get(record.getFromId());
      if (ref == null || isDomainOrDataProduct(ref)) {
        continue;
      }
      relatedByPageId
          .computeIfAbsent(UUID.fromString(record.getToId()), id -> new ArrayList<>())
          .add(ref);
    }
    relatedByPageId.values().forEach(refs -> refs.sort(EntityUtil.compareEntityReference));
    return relatedByPageId;
  }

  private Map<String, EntityReference> resolveReferencesByType(
      List<CollectionDAO.EntityRelationshipObject> records) {
    Map<String, Set<UUID>> idsByType = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      idsByType
          .computeIfAbsent(record.getFromEntity(), type -> new HashSet<>())
          .add(UUID.fromString(record.getFromId()));
    }
    Map<String, EntityReference> refById = new HashMap<>();
    idsByType.forEach(
        (type, ids) ->
            getEntityReferencesByIds(type, new ArrayList<>(ids), Include.NON_DELETED)
                .forEach(ref -> refById.put(ref.getId().toString(), ref)));
    return refById;
  }

  private boolean isDomainOrDataProduct(EntityReference ref) {
    return Entity.DOMAIN.equals(ref.getType()) || Entity.DATA_PRODUCT.equals(ref.getType());
  }

  private void fetchAndSetEditors(List<Page> entities, EntityUtil.Fields fields) {
    if (!fields.contains(EDITORS)) {
      return;
    }
    Map<UUID, List<EntityReference>> editorsByPageId = batchFetchEditors(entities);
    entities.forEach(
        page ->
            page.setEditors(editorsByPageId.getOrDefault(page.getId(), Collections.emptyList())));
  }

  private Map<UUID, List<EntityReference>> batchFetchEditors(List<Page> entities) {
    Map<UUID, List<EntityReference>> editorsByPageId = new HashMap<>();
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(entities),
                KNOWLEDGE_PAGE_ENTITY,
                USER,
                EDITED_BY.ordinal(),
                Include.NON_DELETED);
    Map<String, EntityReference> refById = new HashMap<>();
    getEntityReferencesByIds(
            USER,
            records.stream().map(r -> UUID.fromString(r.getToId())).distinct().toList(),
            Include.NON_DELETED)
        .forEach(ref -> refById.put(ref.getId().toString(), ref));
    for (CollectionDAO.EntityRelationshipObject record : records) {
      EntityReference ref = refById.get(record.getToId());
      if (ref != null) {
        editorsByPageId
            .computeIfAbsent(UUID.fromString(record.getFromId()), id -> new ArrayList<>())
            .add(ref);
      }
    }
    return editorsByPageId;
  }

  private void setArticleFields(Page knowledgePage, EntityUtil.Fields fields) {
    if (!PageType.ARTICLE.equals(knowledgePage.getPageType())) {
      return;
    }
    Article article = new Article();
    if (knowledgePage.getPage() != null) {
      article = JsonUtils.convertValue(knowledgePage.getPage(), Article.class);
    }
    article.setRelatedArticles(
        fields.contains(RELATED_ENTITIES)
            ? getRelatedArticles(knowledgePage)
            : article.getRelatedArticles());
    knowledgePage.setPage(article);
    knowledgePage.setAttachments(
        fields.contains("attachments")
            ? getAttachments(knowledgePage)
            : knowledgePage.getAttachments());
  }

  @Override
  public void setFullyQualifiedName(Page page) {
    if (page.getParent() == null) {
      page.setFullyQualifiedName(page.getName());
    } else {
      EntityReference parent = page.getParent();
      Page parentPage = Entity.getEntity(parent, "", Include.ALL);
      page.setFullyQualifiedName(
          FullyQualifiedName.add(parentPage.getFullyQualifiedName(), page.getName()));
    }
  }

  @Override
  public void restorePatchAttributes(Page original, Page updated) {
    // Patch can't update Children
    super.restorePatchAttributes(original, updated);
    updated.withChildren(original.getChildren());
  }

  private List<EntityReference> filterOutDomainsAndDataProducts(List<EntityReference> entities) {
    if (nullOrEmpty(entities)) {
      return Collections.emptyList();
    }
    return entities.stream()
        .filter(
            ref ->
                !Entity.DOMAIN.equals(ref.getType()) && !Entity.DATA_PRODUCT.equals(ref.getType()))
        .collect(Collectors.toList());
  }

  private List<EntityReference> getRelatedEntities(Page entity) {
    if (entity == null) {
      return Collections.emptyList();
    }
    List<EntityReference> allRelated = findFrom(entity.getId(), KNOWLEDGE_PAGE_ENTITY, HAS, null);
    return filterOutDomainsAndDataProducts(allRelated);
  }

  private List<EntityReference> getEditors(Page entity) {
    return entity == null
        ? Collections.emptyList()
        : findTo(entity.getId(), KNOWLEDGE_PAGE_ENTITY, EDITED_BY, USER);
  }

  private List<EntityReference> getRelatedArticles(Page entity) {
    return findFrom(entity.getId(), KNOWLEDGE_PAGE_ENTITY, RELATED_TO, KNOWLEDGE_PAGE_ENTITY);
  }

  private List<Asset> getAttachments(Page page) {
    List<String> json =
        assetDAO.getByFqnExact(AssetType.External.value(), page.getFullyQualifiedName());
    if (json == null || json.isEmpty()) {
      return Collections.emptyList();
    }
    return JsonUtils.readObjects(json, Asset.class);
  }

  @Override
  protected List<EntityReference> getChildren(Page knowledgePage) {
    return findTo(
        knowledgePage.getId(),
        KNOWLEDGE_PAGE_ENTITY,
        Relationship.PARENT_OF,
        KNOWLEDGE_PAGE_ENTITY);
  }

  @Override
  public void clearFields(Page entity, EntityUtil.Fields fields) {
    entity.withRelatedEntities(
        fields.contains(RELATED_ENTITIES) ? entity.getRelatedEntities() : null);
    entity.withEditors(fields.contains(EDITORS) ? entity.getEditors() : null);
    entity.setParent(fields.contains(FIELD_PARENT) ? entity.getParent() : null);
    entity.setChildren(fields.contains("children") ? entity.getChildren() : null);
    if (entity.getPageType().equals(PageType.ARTICLE)) {
      Article article = new Article();
      if (entity.getPage() != null) {
        article = JsonUtils.convertValue(entity.getPage(), Article.class);
      }
      article.withRelatedArticles(
          fields.contains(RELATED_ENTITIES) ? article.getRelatedArticles() : null);
      entity.withPage(article);
    }
  }

  @Override
  public void prepare(Page knowledgePage, boolean update) {
    // Validate Related Entities
    List<EntityReference> relatedEntities = knowledgePage.getRelatedEntities();
    if (!nullOrEmpty(relatedEntities)) {
      List<EntityReference> filtered = filterOutDomainsAndDataProducts(relatedEntities);
      knowledgePage.withRelatedEntities(filtered);
    }
    EntityUtil.populateEntityReferences(knowledgePage.getRelatedEntities());

    validateParentHierarchy(knowledgePage);

    if (knowledgePage.getPageType().equals(PageType.ARTICLE)) {
      Article article = JsonUtils.convertValue(knowledgePage.getPage(), Article.class);

      // Validate Related Articles
      EntityUtil.populateEntityReferences(article.getRelatedArticles());

      knowledgePage.setPage(article);

      // A new article with a body queues extraction in postCreate; stamp Queued in this same create
      // so the status is persisted atomically rather than through a racing out-of-band write.
      if (!update && !nullOrEmpty(knowledgePage.getDescription()) && isExtractionEnabled()) {
        knowledgePage.setProcessingStatus(PageProcessingStatus.Queued);
      }
    }
  }

  /**
   * Reject a reparent that would point a page at itself or at one of its own descendants. Without
   * this guard the move is accepted and the FQN rewrite cascades into an ever-growing, self-
   * referential chain (e.g. {@code a.b.a.b.a}), corrupting the whole subtree.
   */
  private void validateParentHierarchy(Page page) {
    EntityReference parentRef = page.getParent();
    if (parentRef != null && parentRef.getId() != null) {
      EntityReference parent =
          Entity.getEntityReferenceById(
              KNOWLEDGE_PAGE_ENTITY, parentRef.getId(), Include.NON_DELETED);
      if (isCyclicParentMove(
          page.getId(),
          page.getFullyQualifiedName(),
          parent.getId(),
          parent.getFullyQualifiedName())) {
        String pageFqn =
            page.getFullyQualifiedName() != null ? page.getFullyQualifiedName() : page.getName();
        throw new IllegalArgumentException(
            invalidPageMove(pageFqn, parent.getFullyQualifiedName()));
      }
    }
  }

  static boolean isCyclicParentMove(UUID pageId, String pageFqn, UUID parentId, String parentFqn) {
    boolean isSelf = pageId != null && pageId.equals(parentId);
    boolean isDescendant =
        pageFqn != null && parentFqn != null && FullyQualifiedName.isParent(parentFqn, pageFqn);
    return isSelf || isDescendant;
  }

  public ResultList<PageHierarchy> getHierarchyWithSearch(
      String parent, PageType pageType, int offset, int limit) {
    String pageTypeValue = pageType != null ? pageType.value() : null;
    return searchRepository
        .getSearchClient()
        .listPageHierarchy(parent, pageTypeValue, offset, limit);
  }

  public ResultList<PageHierarchy> getHierarchyWithSearchForActivePage(
      String activeFqn, PageType pageType, int offset, int limit) {
    String pageTypeValue = pageType != null ? pageType.value() : null;
    return searchRepository
        .getSearchClient()
        .listPageHierarchyForActivePage(activeFqn, pageTypeValue, offset, limit);
  }

  public List<PageHierarchy> listHierarchy(ListFilter filter, int limit) {
    List<PageHierarchy> pageHierarchyList = new ArrayList<>();
    EntityUtil.Fields fields = getFields("parent,children");

    ResultList<Page> resultList = listAfter(null, fields, filter, limit, null);
    Map<UUID, Page> lookUp =
        resultList.getData().stream().collect(Collectors.toMap(Page::getId, p -> p));
    List<Page> topLevelPages =
        resultList.getData().stream().filter(p -> p.getParent() == null).toList();

    for (Page page : topLevelPages) {
      pageHierarchyList.add(getHierarchy(lookUp, page));
    }

    return pageHierarchyList;
  }

  public PageHierarchy getHierarchy(Map<UUID, Page> lookUp, Page topLevelPage) {
    PageHierarchy topLevelHierarchy = getPageHierarchy(topLevelPage);
    int childrenCount = countChildren(lookUp, topLevelPage);
    topLevelHierarchy.withChildrenCount(childrenCount);
    return topLevelHierarchy;
  }

  private int countChildren(Map<UUID, Page> lookUp, Page parentPage) {
    int childCount = 0;
    // For each child reference, we check if the page exists in the lookup map
    for (EntityReference childRef : listOrEmpty(parentPage.getChildren())) {
      Page childPage = lookUp.get(childRef.getId());
      if (childPage != null) {
        childCount++;
      }
    }
    return childCount;
  }

  private PageHierarchy getPageHierarchy(Page page) {
    // Build a PageHierarchy object from the given Page object
    return new PageHierarchy()
        .withId(page.getId())
        .withPageType(page.getPageType())
        .withName(page.getName())
        .withDisplayName(page.getDisplayName())
        .withHref(page.getHref())
        .withFullyQualifiedName(page.getFullyQualifiedName())
        .withDescription(page.getDescription());
  }

  @Override
  public void storeEntity(Page knowledgePage, boolean update) {
    // Related Entities
    List<EntityReference> relatedEntities = knowledgePage.getRelatedEntities();
    EntityReference parent = knowledgePage.getParent();
    List<EntityReference> children = knowledgePage.getChildren();
    knowledgePage.withRelatedEntities(null).withParent(null).withChildren(null);

    if (knowledgePage.getPageType().equals(PageType.ARTICLE)) {
      Article article = JsonUtils.convertValue(knowledgePage.getPage(), Article.class);
      List<EntityReference> relatedArticles = article.getRelatedArticles();
      article.withRelatedArticles(null);
      store(knowledgePage, update);
      article.withRelatedArticles(relatedArticles);
      knowledgePage.withRelatedEntities(relatedEntities).withParent(parent).withChildren(children);
      return;
    }

    store(knowledgePage, update);
    knowledgePage.withRelatedEntities(relatedEntities).withParent(parent).withChildren(children);
  }

  @Override
  public void storeRelationships(Page knowledgePage) {
    // Add Parent for this entity
    if (knowledgePage.getParent() != null) {
      addRelationship(
          knowledgePage.getParent().getId(),
          knowledgePage.getId(),
          KNOWLEDGE_PAGE_ENTITY,
          KNOWLEDGE_PAGE_ENTITY,
          Relationship.CONTAINS);
    }

    for (EntityReference child : listOrEmpty(knowledgePage.getChildren())) {
      addRelationship(
          knowledgePage.getId(),
          child.getId(),
          KNOWLEDGE_PAGE_ENTITY,
          KNOWLEDGE_PAGE_ENTITY,
          Relationship.CONTAINS);
    }
    // Add Related Entities
    for (EntityReference relatedEntity : listOrEmpty(knowledgePage.getRelatedEntities())) {
      addRelationship(
          relatedEntity.getId(),
          knowledgePage.getId(),
          relatedEntity.getType(),
          KNOWLEDGE_PAGE_ENTITY,
          HAS);
    }

    if (knowledgePage.getPageType().equals(PageType.ARTICLE)) {
      Article article = JsonUtils.convertValue(knowledgePage.getPage(), Article.class);
      for (EntityReference relatedArticle : listOrEmpty(article.getRelatedArticles())) {
        addRelationship(
            relatedArticle.getId(),
            knowledgePage.getId(),
            KNOWLEDGE_PAGE_ENTITY,
            KNOWLEDGE_PAGE_ENTITY,
            RELATED_TO);
      }
    }
  }

  public RestUtil.PutResponse<?> addKnowledgePageUsage(
      UriInfo uriInfo, String updatedBy, UUID knowledgePageId, List<EntityReference> entityIds) {
    Page page =
        getEntity(KNOWLEDGE_PAGE_ENTITY, knowledgePageId, RELATED_ENTITIES, Include.NON_DELETED);
    List<EntityReference> oldValue = page.getRelatedEntities();
    // Create Relationships
    List<EntityReference> validEntities = filterOutDomainsAndDataProducts(entityIds);
    validEntities.forEach(
        entityRef ->
            addRelationship(
                entityRef.getId(),
                knowledgePageId,
                entityRef.getType(),
                KNOWLEDGE_PAGE_ENTITY,
                HAS));

    // Populate Fields
    setFieldsInternal(page, new EntityUtil.Fields(allowedFields, RELATED_ENTITIES));
    Entity.withHref(uriInfo, page.getRelatedEntities());
    ChangeEvent changeEvent =
        getKnowledgeChangeEvent(
            updatedBy,
            RELATED_ENTITIES,
            oldValue,
            page.getRelatedEntities(),
            withHref(uriInfo, page));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> removeKnowledgePageUsedIn(
      UriInfo uriInfo, String updatedBy, UUID knowledgePageId, List<EntityReference> entityIds) {
    Page page =
        getEntity(KNOWLEDGE_PAGE_ENTITY, knowledgePageId, RELATED_ENTITIES, Include.NON_DELETED);
    List<EntityReference> oldValue = page.getRelatedEntities();
    List<EntityReference> validEntities = filterOutDomainsAndDataProducts(entityIds);
    for (EntityReference ref : validEntities) {
      deleteRelationship(ref.getId(), ref.getType(), knowledgePageId, KNOWLEDGE_PAGE_ENTITY, HAS);
    }

    // Populate Fields
    setFieldsInternal(page, new EntityUtil.Fields(allowedFields, RELATED_ENTITIES));
    Entity.withHref(uriInfo, page.getRelatedEntities());
    ChangeEvent changeEvent =
        getKnowledgeChangeEvent(
            updatedBy,
            RELATED_ENTITIES,
            oldValue,
            page.getRelatedEntities(),
            withHref(uriInfo, page));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private ChangeEvent getKnowledgeChangeEvent(
      String updatedBy, String fieldUpdated, Object oldValue, Object newValue, Page updatedPage) {
    FieldChange fieldChange =
        new FieldChange().withName(fieldUpdated).withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change =
        new ChangeDescription().withPreviousVersion(updatedPage.getVersion());
    change.getFieldsUpdated().add(fieldChange);
    return new ChangeEvent()
        .withEntity(updatedPage)
        .withChangeDescription(change)
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updatedPage.getId())
        .withEntityFullyQualifiedName(updatedPage.getFullyQualifiedName())
        .withUserName(updatedBy)
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updatedPage.getVersion())
        .withPreviousVersion(updatedPage.getVersion());
  }

  @Override
  public EntityUpdater getUpdater(
      Page original, Page updated, Operation operation, ChangeSource source) {
    return new KnowledgePageUpdater(original, updated, operation);
  }

  public class KnowledgePageUpdater extends EntityUpdater {
    public KnowledgePageUpdater(Page original, Page updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // Update Related Terms
      updateRelatedEntities(original, updated);

      recordExtractionStats(original, updated);

      recordProcessingStatus(original, updated);

      // Updated Quick Link
      if (original.getPageType().equals(PageType.QUICK_LINK)) {
        QuickLink originalLink = JsonUtils.convertValue(original.getPage(), QuickLink.class);
        QuickLink updatedLink = JsonUtils.convertValue(updated.getPage(), QuickLink.class);
        recordChange("quickLink", originalLink, updatedLink);
      }

      // Updated Article
      if (original.getPageType().equals(PageType.ARTICLE)) {
        updateArticles(original, updated);
      }

      // Add Editor
      if (fieldsChanged() && updatingUser.getId() != null) {
        addRelationship(
            original.getId(), updatingUser.getId(), KNOWLEDGE_PAGE_ENTITY, USER, EDITED_BY);
      }

      updateParent(original, updated);
    }

    /**
     * extractionStats is engine-managed: the extraction throttle stamps it, and it is absent from
     * CreatePage. Preserve the stored value when an update omits it so a body edit through PUT never
     * wipes it, and persist a fresh stamp with updateVersion=false (the same treatment lifeCycle
     * gets) so machine extraction does not churn the article's version history on every run.
     */
    private void recordExtractionStats(Page original, Page updated) {
      if (updated.getExtractionStats() == null) {
        updated.setExtractionStats(original.getExtractionStats());
      }
      recordChange(
          "extractionStats",
          original.getExtractionStats(),
          updated.getExtractionStats(),
          true,
          EntityUtil.objectMatch,
          false);
    }

    /**
     * processingStatus / processingError are machine-managed like extractionStats. An edit that
     * changes an article's body (re)queues extraction, so stamp Queued here — in the user's own
     * transaction — because a later out-of-band write would race the body change and could clobber
     * it. Any other update preserves the stored values when the request omits them (so a body edit
     * through PUT never wipes them), and both fields record with updateVersion=false so machine
     * status transitions never churn the article's version history.
     */
    private void recordProcessingStatus(Page original, Page updated) {
      boolean bodyRequeued =
          PageType.ARTICLE.equals(updated.getPageType())
              && !Objects.equals(original.getDescription(), updated.getDescription())
              && isExtractionEnabled();
      if (bodyRequeued) {
        updated.setProcessingStatus(PageProcessingStatus.Queued);
        updated.setProcessingError(null);
      } else {
        if (updated.getProcessingStatus() == null) {
          updated.setProcessingStatus(original.getProcessingStatus());
        }
        if (updated.getProcessingError() == null) {
          updated.setProcessingError(original.getProcessingError());
        }
      }
      recordChange(
          "processingStatus",
          original.getProcessingStatus(),
          updated.getProcessingStatus(),
          false,
          EntityUtil.objectMatch,
          false);
      recordChange(
          "processingError",
          original.getProcessingError(),
          updated.getProcessingError(),
          false,
          EntityUtil.objectMatch,
          false);
    }

    private void updateParent(Page original, Page updated) {
      UUID oldParentId = getId(original.getParent());
      UUID newParentId = getId(updated.getParent());
      final boolean parentChanged = !Objects.equals(oldParentId, newParentId);
      if (parentChanged) {
        if (oldParentId != null) {
          deleteRelationship(
              oldParentId,
              KNOWLEDGE_PAGE_ENTITY,
              original.getId(),
              KNOWLEDGE_PAGE_ENTITY,
              Relationship.CONTAINS);
        }
        if (newParentId != null) {
          setFullyQualifiedName(updated);
          daoExtension.updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
          addRelationship(
              newParentId,
              original.getId(),
              KNOWLEDGE_PAGE_ENTITY,
              KNOWLEDGE_PAGE_ENTITY,
              Relationship.CONTAINS);
        } else {
          setFullyQualifiedName(updated);
          daoExtension.updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        }
        recordChange(
            "parent", original.getParent(), updated.getParent(), true, entityReferenceMatch);
      }
    }

    private void updateChildren(Page original, Page updated) {
      List<EntityReference> origChildren = listOrEmpty(original.getChildren());
      List<EntityReference> updatedChildren = listOrEmpty(updated.getChildren());
      updateToRelationships(
          "children",
          KNOWLEDGE_PAGE_ENTITY,
          original.getId(),
          Relationship.PARENT_OF,
          KNOWLEDGE_PAGE_ENTITY,
          origChildren,
          updatedChildren,
          false);
    }

    private void updateRelatedEntities(Page original, Page updated) {
      List<EntityReference> origRelatedEntities =
          filterOutDomainsAndDataProducts(listOrEmpty(original.getRelatedEntities()));
      List<EntityReference> updatedRelatedEntities =
          filterOutDomainsAndDataProducts(listOrEmpty(updated.getRelatedEntities()));
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      if (!recordListChange(
          RELATED_ENTITIES,
          origRelatedEntities,
          updatedRelatedEntities,
          added,
          deleted,
          entityReferenceMatch)) {
        return; // No changes between original and updated.
      }
      // Remove relationships from original
      for (EntityReference ref : origRelatedEntities) {
        deleteRelationship(
            ref.getId(), ref.getType(), original.getId(), KNOWLEDGE_PAGE_ENTITY, HAS);
      }

      // Add relationships from updated
      for (EntityReference ref : updatedRelatedEntities) {
        addRelationship(ref.getId(), original.getId(), ref.getType(), KNOWLEDGE_PAGE_ENTITY, HAS);
      }
      updatedRelatedEntities.sort(EntityUtil.compareEntityReference);
      origRelatedEntities.sort(EntityUtil.compareEntityReference);
    }

    private void updateArticles(Page original, Page updated) {
      Article oldArticle = JsonUtils.convertValue(original.getPage(), Article.class);
      Article updateArticle = JsonUtils.convertValue(updated.getPage(), Article.class);

      // Related Articles
      List<EntityReference> origRelatedArticles = listOrEmpty(oldArticle.getRelatedArticles());
      List<EntityReference> updatedRelatedArticles =
          listOrEmpty(updateArticle.getRelatedArticles());
      updateFromRelationships(
          RELATED_ENTITIES,
          KNOWLEDGE_PAGE_ENTITY,
          origRelatedArticles,
          updatedRelatedArticles,
          RELATED_TO,
          KNOWLEDGE_PAGE_ENTITY,
          original.getId());
    }
  }

  protected void updateTaskWithNewReviewers(Page page) {
    try {
      MessageParser.EntityLink about =
          new MessageParser.EntityLink(KNOWLEDGE_PAGE_ENTITY, page.getFullyQualifiedName());
      FeedRepository feedRepository = Entity.getFeedRepository();
      Thread originalTask =
          feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      page =
          Entity.getEntityByName(
              KNOWLEDGE_PAGE_ENTITY,
              page.getFullyQualifiedName(),
              "id,fullyQualifiedName,reviewers",
              Include.ALL);

      Thread updatedTask = JsonUtils.deepCopy(originalTask, Thread.class);
      updatedTask.getTask().withAssignees(new ArrayList<>(page.getReviewers()));
      JsonPatch patch = JsonUtils.getJsonPatch(originalTask, updatedTask);
      RestUtil.PatchResponse<Thread> thread =
          feedRepository.patchThread(null, originalTask.getId(), updatedTask.getUpdatedBy(), patch);

      // Send WebSocket Notification
      WebsocketNotificationHandler.handleTaskNotification(thread.entity());
    } catch (EntityNotFoundException e) {
      // Task may not be present
      LOG.debug("Task not found for page {}", page.getFullyQualifiedName());
    }
  }

  @Override
  public FeedRepository.TaskWorkflow getTaskWorkflow(FeedRepository.ThreadContext threadContext) {
    validateTaskThread(threadContext);
    TaskType taskType = threadContext.getThread().getTask().getType();
    return new ApprovalTaskWorkflow(threadContext);
  }

  public static class ApprovalTaskWorkflow extends FeedRepository.TaskWorkflow {
    ApprovalTaskWorkflow(FeedRepository.ThreadContext threadContext) {
      super(threadContext);
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      Page page = (Page) threadContext.getAboutEntity();
      checkUpdatedByReviewer(page, user);

      UUID taskId = threadContext.getThread().getId();
      Map<String, Object> variables = new HashMap<>();
      variables.put(RESULT_VARIABLE, resolveTask.getNewValue().equalsIgnoreCase("approved"));
      variables.put(UPDATED_BY_VARIABLE, user);
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      workflowHandler.resolveTask(
          taskId, workflowHandler.transformToNodeVariables(taskId, variables));

      return page;
    }
  }

  @Override
  public void postUpdate(Page original, Page updated) {
    super.postUpdate(original, updated);
    if (EntityStatus.IN_REVIEW.equals(original.getEntityStatus())) {
      if (EntityStatus.APPROVED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Approved the page");
      } else if (EntityStatus.REJECTED.equals(updated.getEntityStatus())) {
        closeApprovalTask(updated, "Rejected the page");
      }
    }

    // TODO: It might happen that a task went from DRAFT to IN_REVIEW to DRAFT fairly quickly
    // Due to ChangesConsolidation, the postUpdate will be called as from DRAFT to DRAFT, but there
    // will be a Task created.
    // This if handles this case scenario, by guaranteeing that we are any Approval Task if the
    // Tag goes back to DRAFT.
    if (EntityStatus.DRAFT.equals(updated.getEntityStatus())) {
      try {
        closeApprovalTask(updated, "Closed due to page going back to DRAFT.");
      } catch (EntityNotFoundException ignored) {
      } // No ApprovalTask is present, and thus we don't need to worry about this.
    }

    if (isArticleBodyChanged(original, updated)) {
      schedulePillExtraction(updated.getId());
    }
  }

  @Override
  protected void postCreate(Page entity) {
    super.postCreate(entity);
    if (PageType.ARTICLE.equals(entity.getPageType()) && !nullOrEmpty(entity.getDescription())) {
      schedulePillExtraction(entity.getId());
    }
  }

  @Override
  protected void postDelete(Page entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    if (LLMClientHolder.isEnabled()) {
      PageContextProcessingEngineHolder.get().cancel(entity.getId());
    }
  }

  // Knowledge-pill cleanup runs in the *AdditionalChildren hooks rather than postDelete because
  // those fire while the page -> memory MENTIONED_IN edges still exist. postDelete runs after
  // cleanup() has already deleted those edges on a hard delete, so a findTo there would match
  // nothing and orphan the pills. The pills track the page's lifecycle: soft-deleted with it,
  // hard-deleted with it, restored with it. Mirrors DashboardRepository's chart cascade.
  @Override
  @Transaction
  protected void softDeleteAdditionalChildren(UUID pageId, String deletedBy) {
    contextMemoryRepository().deleteExtractedMemories(pageId, KNOWLEDGE_PAGE_ENTITY, false);
  }

  @Override
  @Transaction
  protected void hardDeleteAdditionalChildren(UUID pageId, String deletedBy) {
    contextMemoryRepository().deleteExtractedMemories(pageId, KNOWLEDGE_PAGE_ENTITY, true);
  }

  @Override
  @Transaction
  protected void restoreAdditionalChildren(UUID pageId, String updatedBy) {
    contextMemoryRepository().restoreExtractedMemories(pageId, KNOWLEDGE_PAGE_ENTITY);
  }

  private ContextMemoryRepository contextMemoryRepository() {
    return (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
  }

  /** True when an article's markdown body changed — the only edit that warrants re-extraction. */
  private boolean isArticleBodyChanged(Page original, Page updated) {
    return PageType.ARTICLE.equals(updated.getPageType())
        && !Objects.equals(original.getDescription(), updated.getDescription());
  }

  /**
   * Hands the page to the in-memory throttle, which coalesces autosaves and runs extraction once the
   * body settles. A no-op when the LLM is disabled, mirroring the file pipeline.
   */
  private void schedulePillExtraction(UUID pageId) {
    if (isExtractionEnabled()) {
      PageContextProcessingEngineHolder.get().schedule(pageId);
    }
  }

  /** True when the LLM is configured and article (page) memory extraction is toggled on. */
  private boolean isExtractionEnabled() {
    return LLMClientHolder.isEnabled()
        && AISettingsUtil.isPageExtractionEnabled(AISettingsUtil.get());
  }

  private void closeApprovalTask(Page entity, String comment) {
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(KNOWLEDGE_PAGE_ENTITY, entity.getFullyQualifiedName());
    FeedRepository feedRepository = Entity.getFeedRepository();

    // Skip closing tasks if updatedBy is null (e.g., during tests)
    if (entity.getUpdatedBy() == null) {
      LOG.debug(
          "Skipping task closure for page {} - updatedBy is null", entity.getFullyQualifiedName());
      return;
    }

    // Close User Tasks
    try {
      Thread taskThread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      feedRepository.closeTask(
          taskThread, entity.getUpdatedBy(), new CloseTask().withComment(comment));
    } catch (EntityNotFoundException ex) {
      LOG.info("No approval task found for page {}", entity.getFullyQualifiedName());
    }
  }

  public static void checkUpdatedByReviewer(Page page, String updatedBy) {
    // Only list of allowed reviewers can change the status from DRAFT to APPROVED
    List<EntityReference> reviewers = page.getReviewers();
    if (!nullOrEmpty(reviewers)) {
      // Updating user must be one of the reviewers
      boolean isReviewer =
          reviewers.stream()
              .anyMatch(
                  e -> {
                    if (e.getType().equals(TEAM)) {
                      Team team =
                          Entity.getEntityByName(TEAM, e.getName(), "users", Include.NON_DELETED);
                      return team.getUsers().stream()
                          .anyMatch(
                              u ->
                                  u.getName().equals(updatedBy)
                                      || u.getFullyQualifiedName().equals(updatedBy));
                    } else {
                      return e.getName().equals(updatedBy)
                          || e.getFullyQualifiedName().equals(updatedBy);
                    }
                  });
      if (!isReviewer) {
        throw new AuthorizationException(notReviewer(updatedBy));
      }
    }
  }
}
