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

package org.openmetadata.service.resources;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;
import static org.openmetadata.service.util.EntityUtil.createOrUpdateOperation;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.schema.BulkAssetsRequestInterface;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.aicontext.AIContextBuilder;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.csv.BulkImportVersioning;
import org.openmetadata.service.csv.CsvAsyncJob;
import org.openmetadata.service.csv.CsvAsyncJobManager;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.approval.ApprovalGate;
import org.openmetadata.service.jdbi3.AssetEditService;
import org.openmetadata.service.jdbi3.ChildFieldPageReader;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.monitoring.LatencyPhase;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.PagePermissionsResolver;
import org.openmetadata.service.security.PatchRequester;
import org.openmetadata.service.security.ViewOperations;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.RowDecisionGate;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.AsyncService.DatabaseOperation;
import org.openmetadata.service.util.BulkAssetsOperationResponse;
import org.openmetadata.service.util.CSVExportResponse;
import org.openmetadata.service.util.CSVImportResponse;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.JsonPatchUtils;
import org.openmetadata.service.util.ListCursors;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.RestoreEntityResponse;
import org.openmetadata.service.util.ValidatorUtil;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
@LatencyPhase
public abstract class EntityResource<T extends EntityInterface<?>, K extends EntityRepository<T>> {
  private static final String INCLUDE_PERMISSIONS_PARAM = "includePermissions";
  protected final Class<T> entityClass;
  protected final String entityType;
  protected final Set<String> allowedFields;
  @Getter protected final K repository;
  protected final Authorizer authorizer;
  protected final Limits limits;
  protected final Map<String, MetadataOperation> fieldsToViewOperations = new HashMap<>();
  protected final ViewPermissionFilter viewPermissionFilter;

  private static final List<MetadataOperation> VIEW_BASIC_ONLY = List.of(VIEW_BASIC);

  /** Pages a filtered listing reads to fill one page, the first included. */
  private static final int MAX_FILTERED_PAGE_READS = 5;

  /** Rows a filtered listing scans for one page before it returns a short page. */
  private static final int MAX_FILTERED_ROWS_SCANNED = 1000;

  protected EntityResource(String entityType, Authorizer authorizer, Limits limits) {
    this.entityType = entityType;
    this.repository = (K) Entity.getEntityRepository(entityType);
    this.entityClass = (Class<T>) Entity.getEntityClassFromType(entityType);
    allowedFields = repository.getAllowedFields();
    this.authorizer = authorizer;
    this.viewPermissionFilter = new ViewPermissionFilter(authorizer);
    this.limits = limits;
    addViewOperation(
        "owners,followers,votes,tags,extension,domains,dataProducts,experts,reviewers", VIEW_BASIC);
    Entity.registerResourcePermissions(entityType, getEntitySpecificOperations());
    Entity.registerResourceFieldViewMapping(entityType, fieldsToViewOperations);
  }

  /** Method used for initializing a resource, such as creating default policies, roles, etc. */
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {}

  /**
   * Method used for upgrading a resource such as adding new fields to entities, etc. that can't be done in bootstrap
   * migrate
   */
  public void upgrade() {
    // Nothing to do in the default implementation
  }

  public final Fields getFields(String fields) {
    return repository.getFields(fields);
  }

  protected T addHref(UriInfo uriInfo, T entity) {
    try (var ignored = RequestLatencyContext.phase("addHref")) {
      Entity.withHref(uriInfo, entity.getOwners());
      Entity.withHref(uriInfo, entity.getFollowers());
      Entity.withHref(uriInfo, entity.getExperts());
      Entity.withHref(uriInfo, entity.getReviewers());
      Entity.withHref(uriInfo, entity.getChildren());
      Entity.withHref(uriInfo, entity.getDomains());
      Entity.withHref(uriInfo, entity.getDataProducts());
      return entity;
    }
  }

  protected Response addFollowerInternal(
      SecurityContext securityContext, UUID entityId, UUID userId) {
    authorizeFollowerMutation(securityContext, userId);
    authorizeView(securityContext, entityId);
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), entityId, userId)
        .toResponse();
  }

  protected Response deleteFollowerInternal(
      SecurityContext securityContext, UUID entityId, UUID userId) {
    authorizeFollowerMutation(securityContext, userId);
    // The response carries the entity, so a follower who has since lost access must not read it.
    authorizeView(securityContext, entityId);
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), entityId, userId)
        .toResponse();
  }

  /** The vote response carries the whole entity, so voting takes the same view as reading it. */
  protected Response updateVoteInternal(
      SecurityContext securityContext, UUID entityId, VoteRequest request) {
    authorizeView(securityContext, entityId);
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), entityId, request)
        .toResponse();
  }

  private void authorizeView(SecurityContext securityContext, UUID entityId) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, VIEW_BASIC),
        getResourceContextById(entityId));
  }

  private void authorizeFollowerMutation(SecurityContext securityContext, UUID userId) {
    if (userId == null) {
      throw new BadRequestException("userId is required");
    }
    SubjectContext subjectContext = getSubjectContext(securityContext);
    if (!Objects.equals(subjectContext.user().getId(), userId)) {
      authorizer.authorizeAdmin(securityContext);
    }
  }

  protected List<MetadataOperation> getEntitySpecificOperations() {
    return null;
  }

  public final ResultList<T> addHref(UriInfo uriInfo, ResultList<T> list) {
    try (var ignored = RequestLatencyContext.phase("addHref")) {
      listOrEmpty(list.getData()).forEach(i -> addHref(uriInfo, i));
      return list;
    }
  }

  /**
   * When a list request opts in with {@code ?includePermissions=true}, attach each listed entity's
   * permissions for the current user so the UI can render row-level actions without firing one
   * permission call per entity. No-op (and zero cost) for the default listing.
   */
  public final ResultList<T> addPermissions(
      UriInfo uriInfo, SecurityContext securityContext, ResultList<T> list) {
    if (isPermissionsRequested(uriInfo) && !nullOrEmpty(list.getData())) {
      list.setEntityPermissions(
          PagePermissionsResolver.resolve(
              authorizer, securityContext, entityType, repository, list.getData()));
    }
    return list;
  }

  private boolean isPermissionsRequested(UriInfo uriInfo) {
    return Boolean.parseBoolean(uriInfo.getQueryParameters().getFirst(INCLUDE_PERMISSIONS_PARAM));
  }

  /** Cursor-paged list inputs, grouped so the paging helper stays within the parameter limit. */
  private record CursorPage(
      Fields fields, ListFilter filter, int limit, String before, String after) {}

  private ResultList<T> listCursorPaged(
      UriInfo uriInfo, SecurityContext securityContext, CursorPage page) {
    ResultList<T> resultList =
        rowsMayDiffer(securityContext, page.fields())
            ? readableRowsPage(uriInfo, securityContext, page)
            : readPage(uriInfo, page, page.before(), page.after());
    retainViewableReferences(securityContext, page.fields(), resultList.getData());
    return addPermissions(uriInfo, securityContext, addHref(uriInfo, resultList));
  }

  /** A reference-list field of {@code E} whose targets are filtered per caller. */
  public record ReferenceListField<E>(
      String name,
      Function<E, List<EntityReference>> getter,
      BiConsumer<E, List<EntityReference>> setter) {}

  /**
   * Reference-list fields whose targets the caller may not be allowed to view, such as the assets a
   * user owns: a target stays in the list only if the caller may view it
   * (ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view). None by default.
   */
  protected List<ReferenceListField<T>> viewFilteredReferenceFields() {
    return List.of();
  }

  protected final T retainViewableReferences(
      SecurityContext securityContext, Fields fields, T entity) {
    if (entity != null) {
      retainViewableReferences(securityContext, fields, List.of(entity));
    }
    return entity;
  }

  protected final void retainViewableReferences(
      SecurityContext securityContext, Fields fields, List<T> entities) {
    List<ReferenceListField<T>> requested =
        viewFilteredReferenceFields().stream()
            .filter(field -> fields != null && fields.contains(field.name()))
            .toList();
    if (requested.isEmpty() || nullOrEmpty(entities)) {
      return;
    }
    Set<UUID> hidden = hiddenReferences(securityContext, requested, entities);
    if (!hidden.isEmpty()) {
      entities.forEach(entity -> ShownReferenceLists.removeHidden(entity, requested, hidden));
    }
  }

  /**
   * Ids of the references in {@code lists} of {@code entities} the caller may not view, checked in
   * one batch per target type where a row-dependent rule could refuse a view.
   */
  private Set<UUID> hiddenReferences(
      SecurityContext securityContext, List<ReferenceListField<T>> lists, List<T> entities) {
    SubjectContext subject = getSubjectContext(securityContext);
    Map<String, Boolean> typeMayDiffer = new HashMap<>();
    List<EntityReference> toCheck =
        entities.stream()
            .flatMap(
                entity ->
                    lists.stream()
                        .flatMap(list -> listOrEmpty(list.getter().apply(entity)).stream()))
            .filter(
                ref ->
                    ref.getType() != null
                        && ref.getId() != null
                        && typeMayDiffer.computeIfAbsent(
                            ref.getType(),
                            type -> RowDecisionGate.mayDiffer(subject, type, VIEW_BASIC_ONLY)))
            .toList();
    Set<UUID> hidden = new HashSet<>();
    if (!toCheck.isEmpty()) {
      Set<UUID> viewable = viewPermissionFilter.viewableIds(securityContext, toCheck);
      toCheck.stream()
          .map(EntityReference::getId)
          .filter(id -> !viewable.contains(id))
          .forEach(hidden::add);
    }
    return hidden;
  }

  /**
   * The write response with its reference lists filtered as a GET filters them. The entity is the
   * one the repository wrote, which handlers that run after the write may still read, so the
   * response carries a filtered copy instead.
   */
  @SuppressWarnings("unchecked")
  private Response withViewableReferences(SecurityContext securityContext, Response response) {
    List<ReferenceListField<T>> lists = viewFilteredReferenceFields();
    if (lists.isEmpty() || !entityClass.isInstance(response.getEntity())) {
      return response;
    }
    T entity = (T) response.getEntity();
    Set<UUID> hidden = hiddenReferences(securityContext, lists, List.of(entity));
    if (hidden.isEmpty()) {
      return response;
    }
    T viewable = JsonUtils.deepCopy(entity, entityClass);
    ShownReferenceLists.removeHidden(viewable, lists, hidden);
    return Response.fromResponse(response).entity(viewable).build();
  }

  /** The reference lists whose targets are filtered among those a write of {@code fields} stores. */
  private List<ReferenceListField<T>> writtenReferenceLists(Fields fields) {
    return viewFilteredReferenceFields().stream()
        .filter(list -> fields.contains(list.name()))
        .toList();
  }

  /**
   * The patch to write for this caller. A reference list the caller was shown without some of its
   * entries is patched as it was shown and the entries the caller could not see are written back,
   * so an index means what the caller saw and a PATCH never drops what it was not shown
   * (ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view). Any other patch is
   * written as it was sent.
   */
  private JsonPatch patchAsShown(
      SecurityContext securityContext, JsonPatch patch, Supplier<T> storedEntity) {
    Set<String> patched = JsonUtils.extractPatchedFields(patch);
    List<ReferenceListField<T>> lists =
        writtenReferenceLists(repository.getPatchFields()).stream()
            .filter(list -> patched.contains(list.name()))
            .toList();
    if (lists.isEmpty() || getSubjectContext(securityContext).isAdmin()) {
      return patch;
    }
    T stored = storedEntity.get();
    Set<UUID> hidden = hiddenReferences(securityContext, lists, List.of(stored));
    return hidden.isEmpty()
        ? patch
        : ShownReferenceLists.patchOfShown(stored, patch, lists, hidden, entityClass);
  }

  /**
   * A PUT names a reference list as the caller was shown it, so the stored entries the caller may
   * not view are added back to what it sent
   * (ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view).
   */
  private void keepHiddenReferences(SecurityContext securityContext, T entity, T stored) {
    List<ReferenceListField<T>> lists = writtenReferenceLists(repository.getPutFields());
    if (lists.isEmpty() || getSubjectContext(securityContext).isAdmin()) {
      return;
    }
    String listNames = String.join(",", lists.stream().map(ReferenceListField::name).toList());
    T current =
        repository.get(null, stored.getId(), repository.getFields(listNames), Include.ALL, false);
    Set<UUID> hidden = hiddenReferences(securityContext, lists, List.of(current));
    for (ReferenceListField<T> list : lists) {
      List<EntityReference> kept = ShownReferenceLists.hiddenEntries(current, list, hidden);
      if (!kept.isEmpty()) {
        list.setter()
            .accept(entity, ShownReferenceLists.withEntries(list.getter().apply(entity), kept));
      }
    }
  }

  /**
   * What a caller was shown of an entity's reference lists, and a PATCH applied to it. The pure
   * part of the reference-list filtering, kept apart so it can be tested without a server.
   */
  static final class ShownReferenceLists {
    private static final String OP = "op";
    private static final String PATH = "path";
    private static final String VALUE = "value";
    private static final String ID = "id";

    private ShownReferenceLists() {}

    /**
     * {@code patch} as it applies to {@code stored} for a caller shown {@code stored} without the
     * {@code hidden} references of {@code lists}. The caller's operations on those lists run on the
     * lists as shown, and each list holding a hidden entry is written whole with its hidden entries
     * added back. Operations on other fields are kept as sent, unless one also touches such a list,
     * in which case the fields it touches are written whole too. A patch that replaces the document
     * root is returned as sent, for the write to refuse.
     */
    static <E extends EntityInterface<?>> JsonPatch patchOfShown(
        E stored,
        JsonPatch patch,
        List<ReferenceListField<E>> lists,
        Set<UUID> hidden,
        Class<E> entityClass) {
      if (replacesWholeDocument(patch)) {
        return patch;
      }
      E shown = JsonUtils.deepCopy(stored, entityClass);
      removeHidden(shown, lists, hidden);
      JsonObject intended = JsonUtils.applyPatch(shown, patch).asJsonObject();
      JsonObject storedJson = JsonUtils.getJsonStructure(stored).asJsonObject();
      Map<String, List<EntityReference>> kept = new LinkedHashMap<>();
      for (ReferenceListField<E> list : lists) {
        List<EntityReference> entries = hiddenEntries(stored, list, hidden);
        if (!entries.isEmpty()) {
          kept.put(list.name(), entries);
        }
      }
      Set<String> wholeFields = fieldsWrittenWhole(patch, kept.keySet());
      JsonArrayBuilder operations = Json.createArrayBuilder();
      patch.toJsonArray().stream()
          .filter(operation -> Collections.disjoint(fieldsOf(operation), wholeFields))
          .forEach(operations::add);
      for (String field : wholeFields) {
        JsonValue value =
            kept.containsKey(field)
                ? shownListWith(intended.get(field), kept.get(field))
                : intended.get(field);
        writeWhole(operations, field, value, storedJson.containsKey(field));
      }
      return Json.createPatch(operations.build());
    }

    static <E> void removeHidden(E entity, List<ReferenceListField<E>> lists, Set<UUID> hidden) {
      for (ReferenceListField<E> list : lists) {
        List<EntityReference> refs = list.getter().apply(entity);
        if (refs != null) {
          list.setter()
              .accept(
                  entity,
                  refs.stream()
                      .filter(ref -> !isHidden(ref, hidden))
                      .collect(Collectors.toCollection(ArrayList::new)));
        }
      }
    }

    static <E> List<EntityReference> hiddenEntries(
        E entity, ReferenceListField<E> list, Set<UUID> hidden) {
      return listOrEmpty(list.getter().apply(entity)).stream()
          .filter(ref -> isHidden(ref, hidden))
          .toList();
    }

    /** {@code sent} with the {@code kept} entries it does not already name. */
    static List<EntityReference> withEntries(
        List<EntityReference> sent, List<EntityReference> kept) {
      List<EntityReference> entries = new ArrayList<>(listOrEmpty(sent));
      Set<UUID> named =
          entries.stream()
              .map(EntityReference::getId)
              .filter(Objects::nonNull)
              .collect(Collectors.toSet());
      kept.stream().filter(ref -> !named.contains(ref.getId())).forEach(entries::add);
      return entries;
    }

    private static boolean isHidden(EntityReference ref, Set<UUID> hidden) {
      return ref.getId() != null && hidden.contains(ref.getId());
    }

    private static boolean replacesWholeDocument(JsonPatch patch) {
      return patch.toJsonArray().stream()
          .anyMatch(
              operation ->
                  operation instanceof JsonObject object
                      && "".equals(object.getString(PATH, null)));
    }

    /**
     * The shown list as the patch left it, with the {@code kept} entries it does not already name.
     * A value that is not a list is returned as it is, for the write to refuse.
     */
    private static JsonValue shownListWith(JsonValue shown, List<EntityReference> kept) {
      if (shown != null
          && shown.getValueType() != JsonValue.ValueType.ARRAY
          && shown.getValueType() != JsonValue.ValueType.NULL) {
        return shown;
      }
      JsonArrayBuilder entries = Json.createArrayBuilder();
      Set<String> named = new HashSet<>();
      if (shown instanceof JsonArray shownEntries) {
        for (JsonValue entry : shownEntries) {
          entries.add(entry);
          if (entry instanceof JsonObject reference) {
            named.add(reference.getString(ID, "").toLowerCase(Locale.ROOT));
          }
        }
      }
      kept.stream()
          .filter(ref -> !named.contains(ref.getId().toString()))
          .forEach(ref -> entries.add(JsonUtils.getJsonStructure(ref)));
      return entries.build();
    }

    /** {@code seeds} and every field an operation touches together with one already in the set. */
    private static Set<String> fieldsWrittenWhole(JsonPatch patch, Set<String> seeds) {
      Set<String> fields = new HashSet<>(seeds);
      boolean grew = true;
      while (grew) {
        grew = false;
        for (JsonValue operation : patch.toJsonArray()) {
          Set<String> touched = fieldsOf(operation);
          if (!Collections.disjoint(touched, fields)) {
            grew |= fields.addAll(touched);
          }
        }
      }
      return fields;
    }

    private static Set<String> fieldsOf(JsonValue operation) {
      return JsonPatchUtils.touchedLocations(operation).stream()
          .map(ShownReferenceLists::topLevelField)
          .collect(Collectors.toSet());
    }

    /** The field a JSON Pointer starts at; the document root and a missing location are "". */
    private static String topLevelField(String location) {
      if (location.isEmpty()) {
        return location;
      }
      int end = location.indexOf('/', 1);
      return location
          .substring(1, end < 0 ? location.length() : end)
          .replace("~1", "/")
          .replace("~0", "~");
    }

    private static void writeWhole(
        JsonArrayBuilder operations, String field, JsonValue value, boolean stored) {
      String path = "/" + field.replace("~", "~0").replace("/", "~1");
      if (value != null) {
        operations.add(Json.createObjectBuilder().add(OP, "add").add(PATH, path).add(VALUE, value));
      } else if (stored) {
        operations.add(Json.createObjectBuilder().add(OP, "remove").add(PATH, path));
      }
    }
  }

  /**
   * A cursor page of {@code filter} as the caller may read it, for resources that authorize and
   * build their listing themselves. Takes cursors as sent; returns the page without links.
   */
  protected final ResultList<T> readableListPage(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limit,
      String before,
      String after) {
    CursorPage page =
        new CursorPage(
            fields, filter, limit, ListCursors.unseal(before), ListCursors.unseal(after));
    return rowsMayDiffer(securityContext, fields)
        ? readableRowsPage(uriInfo, securityContext, page)
        : readPage(uriInfo, page, page.before(), page.after());
  }

  private ResultList<T> readPage(UriInfo uriInfo, CursorPage page, String before, String after) {
    return before != null // Reverse paging
        ? repository.listBefore(uriInfo, page.fields(), page.filter(), page.limit(), before)
        : repository.listAfter(uriInfo, page.fields(), page.filter(), page.limit(), after);
  }

  /**
   * Whether a row-dependent rule could refuse a row the listing's own check allowed: a listing is
   * authorized once for its type (ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read).
   */
  protected final boolean rowsMayDiffer(SecurityContext securityContext, Fields fields) {
    RowAuthorization<T> rows = rowAuthorization(fields);
    return RowDecisionGate.mayDiffer(
        getSubjectContext(securityContext), rows.resource(), rows.operations());
  }

  /**
   * How each row of a listing is authorized: as the entity's item endpoint authorizes it, so a
   * listing never returns a row that endpoint refuses
   * (ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read). Each row is checked for
   * {@code operations} on {@code resource}; {@code readable} keeps the rows that pass.
   */
  public record RowAuthorization<E>(
      String resource,
      List<MetadataOperation> operations,
      BiFunction<SecurityContext, List<E>, List<E>> readable) {}

  /** By default a row is the entity itself, read with the operations its requested fields need. */
  protected RowAuthorization<T> rowAuthorization(Fields fields) {
    List<MetadataOperation> operations = ViewOperations.forFields(entityType, fields);
    return new RowAuthorization<>(
        entityType,
        operations,
        (securityContext, rows) -> readableRows(securityContext, rows, operations));
  }

  /**
   * The page as the caller may read it. Rows the caller may not read are dropped and replaced from
   * the pages that follow, within {@link #MAX_FILTERED_PAGE_READS} reads and
   * {@link #MAX_FILTERED_ROWS_SCANNED} rows; past that the page comes back short. The total still
   * counts every row, and the cursors are sealed because one may point at a dropped row.
   */
  private ResultList<T> readableRowsPage(
      UriInfo uriInfo, SecurityContext securityContext, CursorPage page) {
    boolean backward = page.before() != null;
    RowAuthorization<T> rows = rowAuthorization(page.fields());
    ResultList<T> read = readPage(uriInfo, page, page.before(), page.after());
    Paging first = read.getPaging();
    List<T> kept = new ArrayList<>();
    String onward;
    int reads = 0;
    int scanned = 0;
    while (true) {
      List<T> readable = rows.readable().apply(securityContext, read.getData());
      if (backward) {
        kept.addAll(0, readable);
      } else {
        kept.addAll(readable);
      }
      reads++;
      scanned += read.getData().size();
      onward = backward ? read.getPaging().getBefore() : read.getPaging().getAfter();
      if (kept.size() >= page.limit()
          || onward == null
          || reads >= MAX_FILTERED_PAGE_READS
          || scanned >= MAX_FILTERED_ROWS_SCANNED) {
        break;
      }
      read =
          backward ? readPage(uriInfo, page, onward, null) : readPage(uriInfo, page, null, onward);
    }
    if (kept.size() > page.limit()) {
      kept =
          new ArrayList<>(
              backward
                  ? kept.subList(kept.size() - page.limit(), kept.size())
                  : kept.subList(0, page.limit()));
      onward = cursorOf(backward ? kept.getFirst() : kept.getLast(), page.filter());
    }
    // The repository leaves this cursor null when no page lies that way (the first page); it stays
    // null, so a client does not offer a page that would come back empty.
    String repositoryBackAgain = backward ? first.getAfter() : first.getBefore();
    String backAgain =
        repositoryBackAgain == null || kept.isEmpty()
            ? repositoryBackAgain
            : cursorOf(backward ? kept.getLast() : kept.getFirst(), page.filter());
    ResultList<T> result = new ResultList<>(kept, null, null, first.getTotal());
    result
        .getPaging()
        .withBefore(ListCursors.seal(backward ? onward : backAgain))
        .withAfter(ListCursors.seal(backward ? backAgain : onward));
    return result;
  }

  private String cursorOf(T row, ListFilter filter) {
    return RestUtil.encodeCursor(repository.getCursorValue(row, filter));
  }

  /** The {@code rows} the caller may read with {@code operations}, decided on authorization copies. */
  private List<T> readableRows(
      SecurityContext securityContext, List<T> rows, List<MetadataOperation> operations) {
    if (rows.isEmpty()) {
      return rows;
    }
    List<T> copies =
        repository.get(
            null,
            rows.stream().map(T::getId).distinct().toList(),
            ResourceContext.authorizationFields(repository),
            Include.ALL);
    Set<UUID> readable =
        viewPermissionFilter
            .retainPermitted(securityContext, entityType, repository, copies, operations)
            .stream()
            .map(EntityInterface::getId)
            .collect(Collectors.toSet());
    return rows.stream().filter(row -> readable.contains(row.getId())).toList();
  }

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      int limitParam,
      String before,
      String after) {
    Fields fields = getFields(fieldsParam);
    OperationContext listOperationContext =
        new OperationContext(entityType, getViewOperations(fields));
    ResourceContext resourceContext = filter.getResourceContext(entityType);
    return listInternal(
        uriInfo,
        securityContext,
        fields,
        filter,
        limitParam,
        before,
        after,
        listOperationContext,
        resourceContext);
  }

  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limitParam,
      String before,
      String after,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    RestUtil.validateCursors(before, after);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    // Add Domain Filter
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);

    return listCursorPaged(
        uriInfo,
        securityContext,
        new CursorPage(
            fields, filter, limitParam, ListCursors.unseal(before), ListCursors.unseal(after)));
  }

  /**
   * A listing authorized by any of {@code authRequests}. A request on another entity, such as the
   * table whose queries are listed, allows the listing but not its rows: each row is still checked
   * as its item endpoint checks it.
   */
  public ResultList<T> listInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      ListFilter filter,
      int limitParam,
      String before,
      String after,
      List<AuthRequest> authRequests) {
    RestUtil.validateCursors(before, after);
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    // Add Domain Filter
    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);

    return listCursorPaged(
        uriInfo,
        securityContext,
        new CursorPage(
            fields, filter, limitParam, ListCursors.unseal(before), ListCursors.unseal(after)));
  }

  protected ResultList<T> searchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      String query,
      int limit,
      int offset) {
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    ResourceContextInterface resourceContext = filter.getResourceContext(entityType);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    EntityUtil.addDomainQueryParam(securityContext, filter, entityType);

    if (!nullOrEmpty(query)) {
      filter.addQueryParam("nameFilter", query);
    }

    ResultList<T> resultList =
        repository.listAfterWithOffset(uriInfo, fields, filter, limit, offset);
    retainReadableRows(securityContext, fields, resultList);
    return addPermissions(uriInfo, securityContext, addHref(uriInfo, resultList));
  }

  /**
   * Drops the rows of an offset page the caller may not read. An offset page is not refilled, since
   * the offset of the next page would no longer line up; it can come back short.
   */
  protected final void retainReadableRows(
      SecurityContext securityContext, Fields fields, ResultList<T> resultList) {
    if (resultList != null
        && resultList.getData() != null
        && rowsMayDiffer(securityContext, fields)) {
      resultList.setData(
          rowAuthorization(fields).readable().apply(securityContext, resultList.getData()));
    }
  }

  public ResultList<T> listInternalFromSearch(
      UriInfo uriInfo,
      SecurityContext securityContext,
      Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      List<AuthRequest> authRequests)
      throws IOException {
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);
    EntityUtil.addNavbarDomainFilter(securityContext, searchListFilter, entityType);
    ResultList<T> resultList =
        repository.listFromSearchWithOffset(
            uriInfo,
            fields,
            searchListFilter,
            limit,
            offset,
            searchSortFilter,
            q,
            queryString,
            securityContext);
    retainReadableRows(securityContext, fields, resultList);
    return addPermissions(uriInfo, securityContext, resultList);
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, null);
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      String fieldsParam,
      Include include,
      String includeRelations) {
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    Include resolvedInclude = include != null ? include : Include.NON_DELETED;
    RelationIncludes relationIncludes = new RelationIncludes(resolvedInclude, includeRelations);
    return getInternal(
        uriInfo,
        securityContext,
        id,
        fields,
        relationIncludes,
        operationContext,
        getResourceContextById(id, relationIncludes, fields));
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      Fields fields,
      Include include,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    return getInternal(
        uriInfo,
        securityContext,
        id,
        fields,
        RelationIncludes.fromInclude(include),
        operationContext,
        resourceContext);
  }

  public T getInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      Fields fields,
      RelationIncludes relationIncludes,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    T authorized = reuseAuthorizedEntity(uriInfo, resourceContext, fields);
    return retainViewableReferences(
        securityContext,
        fields,
        addHref(
            uriInfo,
            authorized != null
                ? authorized
                : repository.get(
                    uriInfo, id, fields, relationIncludes, isDistributedCacheEnabled())));
  }

  /**
   * Returns the entity the authorization decision already loaded, reduced to the caller's
   * projection, or null when policy evaluation never resolved it.
   *
   * <p>A GET builds its context from the same field set it serves, so the authorization load is a
   * superset of the response projection and re-reading it would fetch the same row twice. That
   * coupling is not enforced by the type system — the terminal overloads are public and a caller
   * could pass a projection the context never loaded — so it is checked here rather than assumed:
   * anything not covered falls back to a normal load. Fields the caller did not request are cleared
   * so the payload is identical to a freshly loaded entity.
   */
  @SuppressWarnings("unchecked")
  private T reuseAuthorizedEntity(
      UriInfo uriInfo, ResourceContextInterface resourceContext, Fields fields) {
    EntityInterface<?> resolved =
        resourceContext == null ? null : resourceContext.getResolvedEntity();
    boolean coversProjection =
        resolved != null && resourceContext.getLoadedFields().containsAll(fields.getFieldList());
    T result = null;
    if (coversProjection && entityClass.isInstance(resolved)) {
      result = (T) resolved;
      repository.clearFieldsInternal(result, fields);
      // clearFieldsInternal does not reset certification, and the authorization load always
      // requests it, so an entity resolved for the decision would carry it into a response that
      // never asked for it. Mirror the rule a normal read applies: present only when the caller
      // requested tags or certification.
      if (!fields.contains(Entity.FIELD_TAGS) && !fields.contains(Entity.FIELD_CERTIFICATION)) {
        result.setCertification(null);
      }
      // The authorization load runs without a UriInfo, so the entity carries no self link yet.
      result = repository.withHref(uriInfo, result);
    }
    return result;
  }

  /**
   * REST GETs consult the entity cache only when a distributed cache (Redis) is configured *and*
   * currently reachable. With Redis, invalidation in {@code EntityRepository.invalidateCache}
   * keeps all instances coherent so cached reads stay fresh. If Redis isn't wired, or the
   * provider flipped to unavailable after a connection loss, we fall back to {@code
   * fromCache=false} to avoid serving stale reads from a per-instance Guava cache in a
   * multi-instance deployment.
   */
  private static boolean isDistributedCacheEnabled() {
    if (CacheBundle.getCachedEntityDao() == null) {
      return false;
    }
    CacheProvider provider = CacheBundle.getCacheProvider();
    return provider != null && provider.available();
  }

  public T getVersionInternal(SecurityContext securityContext, UUID id, String version) {
    OperationContext operationContext = new OperationContext(entityType, VIEW_BASIC);
    return getVersionInternal(
        securityContext, id, version, operationContext, getResourceContextById(id));
  }

  public T getVersionInternal(
      SecurityContext securityContext,
      UUID id,
      String version,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    T stored = repository.getVersion(id, version);
    return snapshotRedaction(securityContext)
        .map(redaction -> redaction.apply(stored))
        .orElse(stored);
  }

  /**
   * The versions and history endpoints return entities as they were stored, without the
   * post-processing the entity's own reads apply. A resource whose entities carry secrets returns
   * the redaction its reads apply; empty, the default, shows a stored snapshot unchanged.
   */
  protected Optional<UnaryOperator<T>> snapshotRedaction(SecurityContext securityContext) {
    return Optional.empty();
  }

  /** Applies {@code redaction} to the entity a response carries, bare or inside a change event. */
  @SuppressWarnings("unchecked")
  protected final Response withRedactedEntity(Response response, UnaryOperator<T> redaction) {
    Object body = response.getEntity();
    if (entityClass.isInstance(body)) {
      return Response.fromResponse(response).entity(redaction.apply((T) body)).build();
    }
    if (body instanceof ChangeEvent changeEvent
        && entityClass.isInstance(changeEvent.getEntity())) {
      changeEvent.setEntity(redaction.apply((T) changeEvent.getEntity()));
    }
    return response;
  }

  protected EntityHistory listVersionsInternal(SecurityContext securityContext, UUID id) {
    OperationContext operationContext = new OperationContext(entityType, VIEW_BASIC);
    return listVersionsInternal(securityContext, id, operationContext, getResourceContextById(id));
  }

  protected EntityHistory listVersionsInternal(
      SecurityContext securityContext,
      UUID id,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    EntityHistory history = repository.listVersions(id);
    snapshotRedaction(securityContext)
        .ifPresent(
            redaction ->
                history.setVersions(
                    history.getVersions().stream()
                        .map(
                            version ->
                                (Object)
                                    JsonUtils.pojoToJson(
                                        redaction.apply(
                                            JsonUtils.readValue((String) version, entityClass))))
                        .collect(Collectors.toList())));
    return history;
  }

  protected ResultList<T> listEntityHistoryByTimestampInternal(
      SecurityContext securityContext,
      long startTs,
      long endTs,
      String before,
      String after,
      int limit) {

    ResourceContext resourceContext = getResourceContext();
    OperationContext operationContext = new OperationContext(entityType, VIEW_BASIC);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    ResultList<T> history =
        repository.listEntityHistoryByTimestamp(startTs, endTs, after, before, limit);
    history.setData(
        retainReadableHistory(securityContext, readableSnapshots(securityContext, history)));
    snapshotRedaction(securityContext)
        .ifPresent(
            redaction ->
                history.setData(
                    history.getData().stream().map(redaction).collect(Collectors.toList())));
    return history;
  }

  /**
   * The snapshots of entities the caller may view now: a snapshot is a version of an entity, so it
   * is decided as the entity is (ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read).
   */
  private List<T> readableSnapshots(SecurityContext securityContext, ResultList<T> history) {
    List<T> snapshots = history.getData() == null ? List.of() : history.getData();
    if (snapshots.isEmpty() || !rowsMayDiffer(securityContext, Fields.EMPTY_FIELDS)) {
      return snapshots;
    }
    return rowAuthorization(Fields.EMPTY_FIELDS).readable().apply(securityContext, snapshots);
  }

  /**
   * Snapshots this caller may see beyond what policies decide, for entities with a visibility of
   * their own (private memories and files). Every snapshot by default.
   */
  protected List<T> retainReadableHistory(SecurityContext securityContext, List<T> snapshots) {
    return snapshots;
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include, null);
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include,
      String includeRelations) {
    Fields fields = getFields(fieldsParam);
    OperationContext operationContext = new OperationContext(entityType, getViewOperations(fields));
    Include resolvedInclude = include != null ? include : Include.NON_DELETED;
    RelationIncludes relationIncludes = new RelationIncludes(resolvedInclude, includeRelations);
    return getByNameInternal(
        uriInfo,
        securityContext,
        name,
        fields,
        relationIncludes,
        operationContext,
        getResourceContextByName(name, relationIncludes, fields));
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Fields fields,
      Include include,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    return getByNameInternal(
        uriInfo,
        securityContext,
        name,
        fields,
        RelationIncludes.fromInclude(include),
        operationContext,
        resourceContext);
  }

  public T getByNameInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      Fields fields,
      RelationIncludes relationIncludes,
      OperationContext operationContext,
      ResourceContextInterface resourceContext) {
    authorizer.authorize(securityContext, operationContext, resourceContext);
    T authorized = reuseAuthorizedEntity(uriInfo, resourceContext, fields);
    return retainViewableReferences(
        securityContext,
        fields,
        addHref(
            uriInfo,
            authorized != null
                ? authorized
                : repository.getByName(
                    uriInfo, name, fields, relationIncludes, isDistributedCacheEnabled())));
  }

  /**
   * Authorizes what a create or update does beyond writing the entity itself, once the CREATE or
   * EDIT_ALL check on the entity has passed. Every create and create-or-update path, single and
   * bulk, calls it, so a resource whose entity links to other entities checks those links in one
   * place. {@code stored} is the saved entity, carrying what {@link
   * #prepareCreateOrUpdateAuthorization} loaded, or null when the write creates it. Throwing fails
   * the write; in a bulk request it fails that item alone.
   */
  protected void authorizeCreateOrUpdate(SecurityContext securityContext, T entity, T stored) {}

  /**
   * Loads onto the stored entities what {@link #authorizeCreateOrUpdate} reads from them, for all of
   * them at once, so a bulk request pays one read rather than one per item. It runs before that
   * check on every update path: for a bulk request, once with every entity the request updates.
   */
  protected void prepareCreateOrUpdateAuthorization(List<T> stored) {}

  private void authorizeUpdate(SecurityContext securityContext, T entity, T stored) {
    prepareCreateOrUpdateAuthorization(List.of(stored));
    authorizeCreateOrUpdate(securityContext, entity, stored);
  }

  public Response create(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    OperationContext operationContext = new OperationContext(entityType, CREATE);
    CreateResourceContext<T> createResourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
    authorizeCreateOrUpdate(securityContext, entity, null);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    T createdEntity =
        addHref(
            uriInfo,
            repository.create(
                uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
    return Response.created(createdEntity.getHref()).entity(createdEntity).build();
  }

  public Response create(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic,
      T entity) {
    OperationContext operationContext = new OperationContext(entityType, CREATE);
    CreateResourceContext<T> createResourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    authorizeCreateOrUpdate(securityContext, entity, null);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    T createdEntity =
        addHref(
            uriInfo,
            repository.create(
                uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
    return Response.created(createdEntity.getHref()).entity(createdEntity).build();
  }

  public Response createOrUpdate(UriInfo uriInfo, SecurityContext securityContext, T entity) {
    repository.prepareInternal(entity, true);
    // If entity does not exist, this is a create operation, else update operation
    ResourceContext<T> resourceContext = getResourceContextByName(entity.getFullyQualifiedName());
    MetadataOperation operation = createOrUpdateOperation(resourceContext);
    OperationContext operationContext = new OperationContext(entityType, operation);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (operation == CREATE) {
      CreateResourceContext<T> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorize(securityContext, operationContext, createResourceContext);
      authorizeCreateOrUpdate(securityContext, entity, null);
      T createdEntity =
          addHref(
              uriInfo,
              repository.create(
                  uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
      return withViewableReferences(
          securityContext,
          new PutResponse<>(Response.Status.CREATED, createdEntity, ENTITY_CREATED).toResponse());
    }
    // Already loaded by createOrUpdateOperation, so handing it over costs no read.
    T stored = entityClass.cast(resourceContext.getEntity());
    resourceContext =
        getResourceContextByName(
            entity.getFullyQualifiedName(), ResourceContextInterface.Operation.PUT);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    authorizeUpdate(securityContext, entity, stored);
    keepHiddenReferences(securityContext, entity, stored);
    PutResponse<T> response =
        repository.createOrUpdate(uriInfo, entity, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return withViewableReferences(securityContext, response.toResponse());
  }

  public Response createOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic,
      T entity) {
    repository.prepareInternal(entity, true);
    // If entity does not exist, this is a create operation, else update operation
    ResourceContext<T> resourceContext = getResourceContextByName(entity.getFullyQualifiedName());
    MetadataOperation operation = createOrUpdateOperation(resourceContext);
    OperationContext operationContext = new OperationContext(entityType, operation);
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (operation == CREATE) {
      CreateResourceContext<T> createResourceContext =
          new CreateResourceContext<>(entityType, entity);
      limits.enforceLimits(securityContext, createResourceContext, operationContext);
      authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
      authorizeCreateOrUpdate(securityContext, entity, null);
      T createdEntity =
          addHref(
              uriInfo,
              repository.create(
                  uriInfo, entity, securityContext.getUserPrincipal().getName(), impersonatedBy));
      return withViewableReferences(
          securityContext,
          new PutResponse<>(Response.Status.CREATED, createdEntity, ENTITY_CREATED).toResponse());
    }
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    T stored = entityClass.cast(resourceContext.getEntity());
    authorizeUpdate(securityContext, entity, stored);
    keepHiddenReferences(securityContext, entity, stored);
    PutResponse<T> response =
        repository.createOrUpdate(uriInfo, entity, securityContext.getUserPrincipal().getName());
    addHref(uriInfo, response.getEntity());
    return withViewableReferences(securityContext, response.toResponse());
  }

  /** Deprecated: use method with changeContext
   * Example:
   * ```
   * patchInternal(uriInfo, securityContext, id, patch, changeContext);
   * ```
   * */
  @Deprecated
  public Response patchInternal(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch, null);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource) {
    // Get If-Match header from ThreadLocal set by ETagRequestFilter
    String ifMatchHeader =
        org.openmetadata.service.resources.filters.ETagRequestFilter.getIfMatchHeader();
    return patchInternal(uriInfo, securityContext, id, patch, changeSource, ifMatchHeader);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.PATCH));
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    PatchResponse<T> response =
        repository.patch(
            uriInfo,
            id,
            securityContext.getUserPrincipal().getName(),
            patchAsShown(securityContext, patch, () -> storedForPatch(id)),
            changeSource,
            ifMatchHeader,
            impersonatedBy);
    addHref(uriInfo, response.entity());
    return withViewableReferences(securityContext, response.toResponse());
  }

  private T storedForPatch(UUID id) {
    return repository.get(null, id, repository.getPatchFields(), Include.NON_DELETED, false);
  }

  /**
   * Variant for resources that need a resource-specific authorization decision. It must plumb
   * If-Match and the impersonation actor exactly as the standard overload does: dropping them
   * silently disables optimistic locking (a stale ETag overwrites a concurrent update instead of
   * failing the precondition) and loses impersonation attribution in the change record.
   */
  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic,
      UUID id,
      JsonPatch patch) {
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
    String ifMatchHeader =
        org.openmetadata.service.resources.filters.ETagRequestFilter.getIfMatchHeader();
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    PatchResponse<T> response =
        repository.patch(
            uriInfo,
            id,
            securityContext.getUserPrincipal().getName(),
            patchAsShown(securityContext, patch, () -> storedForPatch(id)),
            null,
            ifMatchHeader,
            impersonatedBy);
    addHref(uriInfo, response.entity());
    return withViewableReferences(securityContext, response.toResponse());
  }

  public Response patchInternal(
      UriInfo uriInfo, SecurityContext securityContext, String fqn, JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch, null);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource) {
    // Get If-Match header from ThreadLocal set by ETagRequestFilter
    String ifMatchHeader =
        org.openmetadata.service.resources.filters.ETagRequestFilter.getIfMatchHeader();
    return patchInternal(uriInfo, securityContext, fqn, patch, changeSource, ifMatchHeader);
  }

  public Response patchInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      JsonPatch patch,
      ChangeSource changeSource,
      String ifMatchHeader) {
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextByName(fqn, ResourceContextInterface.Operation.PATCH));
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    Supplier<T> stored =
        () ->
            repository.getByName(
                null, fqn, repository.getPatchFields(), Include.NON_DELETED, false);
    PatchResponse<T> response =
        repository.patch(
            uriInfo,
            fqn,
            securityContext.getUserPrincipal().getName(),
            patchAsShown(securityContext, patch, stored),
            changeSource,
            ifMatchHeader,
            impersonatedBy);
    addHref(uriInfo, response.entity());
    return withViewableReferences(securityContext, response.toResponse());
  }

  public Response delete(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.DELETE));
    DeleteResponse<T> response =
        repository.delete(securityContext.getUserPrincipal().getName(), id, recursive, hardDelete);
    if (hardDelete) {
      limits.invalidateCache(entityType);
    }
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response deleteByIdAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      UUID id,
      boolean recursive,
      boolean hardDelete) {
    String jobId = UUID.randomUUID().toString();
    T entity;
    Response response;

    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextById(id, ResourceContextInterface.Operation.DELETE));
    entity = repository.get(uriInfo, id, repository.getFields("name"), Include.ALL, false);
    String userName = securityContext.getUserPrincipal().getName();

    AsyncService.getInstance()
        .executeDatabaseTask(
            DatabaseOperation.ENTITY_DELETE_RESTORE,
            jobId,
            RequestLatencyContext.wrapWithContext(
                () -> {
                  try {
                    DeleteResponse<T> deleteResponse =
                        repository.delete(userName, id, recursive, hardDelete);
                    if (hardDelete) {
                      limits.invalidateCache(entityType);
                    }
                    repository.storeChangeEventForAsyncOperation(
                        deleteResponse.entity(), deleteResponse.changeType(), recursive, userName);
                    WebsocketNotificationHandler.sendDeleteOperationCompleteNotification(
                        jobId, securityContext, deleteResponse.entity());
                  } catch (Exception e) {
                    // Log before notifying. The WebSocket notification is the ONLY report this path
                    // had, so a failed async delete was invisible to anyone not holding a live
                    // socket
                    // — no stack trace, no error line, nothing. A 100k-table service delete that
                    // dies
                    // here looks exactly like one still grinding, which is precisely the ambiguity
                    // that made the nightly scale failures undiagnosable.
                    LOG.error(
                        "Async delete failed for {} {} (jobId {}, recursive={}, hardDelete={})",
                        entityType,
                        id,
                        jobId,
                        recursive,
                        hardDelete,
                        e);
                    WebsocketNotificationHandler.sendDeleteOperationFailedNotification(
                        jobId,
                        securityContext,
                        entity,
                        e.getMessage() == null ? e.toString() : e.getMessage());
                  }
                }));

    response =
        Response.accepted()
            .entity(
                new DeleteEntityResponse(
                    jobId,
                    "Delete operation initiated for " + entity.getName(),
                    entity.getName(),
                    hardDelete,
                    recursive))
            .build();

    return response;
  }

  public Response deleteByName(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      boolean recursive,
      boolean hardDelete) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(
        securityContext,
        operationContext,
        getResourceContextByName(name, ResourceContextInterface.Operation.DELETE));
    DeleteResponse<T> response =
        repository.deleteByName(
            securityContext.getUserPrincipal().getName(), name, recursive, hardDelete);
    addHref(uriInfo, response.entity());
    return response.toResponse();
  }

  public Response restoreEntity(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    // Read ?async=true off uriInfo so subclass resources that haven't (yet) declared the
    // QueryParam still honor the async contract. Lets SDK callers opt into async restore
    // universally regardless of which Resource subclass forwarded the parameter.
    boolean asyncFromQuery =
        uriInfo != null && Boolean.parseBoolean(uriInfo.getQueryParameters().getFirst("async"));
    return restoreEntity(uriInfo, securityContext, id, asyncFromQuery);
  }

  public Response restoreEntity(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, boolean async) {
    if (async) {
      return restoreEntityAsync(uriInfo, securityContext, id);
    }
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    repository.validateRestore(id);
    PutResponse<T> response =
        repository.restoreEntity(securityContext.getUserPrincipal().getName(), id);
    if (response == null) {
      // EntityRepository.restoreEntity now calls find(id, Include.ALL) up front, so a truly
      // missing id has already propagated EntityNotFoundException (→ 404) before we got
      // here. A null response can only mean "entity exists but is not in DELETED state" —
      // map that to 400.
      throw new BadRequestException(
          String.format("Entity %s:%s is not in deleted state", entityType, id));
    }
    repository.restoreFromSearch(response.getEntity());
    addHref(uriInfo, response.getEntity());
    LOG.info(
        "Restored {}:{}",
        Entity.getEntityTypeFromObject(response.getEntity()),
        response.getEntity().getId());
    return response.toResponse();
  }

  /**
   * Async restore variant. Returns 202 Accepted with a job ID and runs the restore on the
   * shared async executor. The caller can subscribe to
   * {@link org.openmetadata.service.socket.WebSocketManager#RESTORE_ENTITY_CHANNEL} to be
   * notified when the restore completes or fails. Used to avoid proxy / ALB idle timeouts on
   * large hierarchies (issue #4003).
   */
  public Response restoreEntityAsync(UriInfo uriInfo, SecurityContext securityContext, UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    // Cheap pre-check so we return a synchronous error instead of 202 + delayed WebSocket
    // FAILED for a request that can't succeed. Distinguish the two failure modes that the
    // raw EntityNotFoundException would conflate: 404 if the entity truly doesn't exist
    // (Include.ALL still finds nothing) and 400 if it exists but is already restored.
    // Capturing the entity here also yields a meaningful name for any later FAILED
    // notification.
    T preCheck;
    try {
      preCheck = repository.find(id, Include.DELETED);
    } catch (EntityNotFoundException notDeleted) {
      // Probe with Include.ALL to distinguish 404-missing from 400-not-deleted. Narrow
      // catch so unrelated failures (DB connectivity, auth) propagate naturally rather
      // than being mis-mapped to 400 "not in deleted state".
      boolean entityExists;
      try {
        repository.find(id, Include.ALL);
        entityExists = true;
      } catch (EntityNotFoundException missing) {
        entityExists = false;
      }
      if (entityExists) {
        throw new BadRequestException(
            String.format("Entity %s:%s is not in deleted state", entityType, id));
      }
      throw notDeleted;
    }
    repository.validateRestore(id);
    String entityName = preCheck.getName() != null ? preCheck.getName() : id.toString();
    String jobId = UUID.randomUUID().toString();
    String userName = securityContext.getUserPrincipal().getName();
    // Resolve the WebSocket user id on the request thread, while the SecurityContext is
    // still valid. JAX-RS may invalidate request-scoped state once the 202 response is
    // returned, so we cannot rely on securityContext.getUserPrincipal() inside the lambda.
    UUID notifyUserId = WebsocketNotificationHandler.resolveUserId(securityContext);
    // Intentionally don't capture uriInfo in the lambda — same request-scope concern. The
    // WebSocket notification only needs name/status, not HREFs.
    AsyncService.getInstance()
        .executeDatabaseTask(
            DatabaseOperation.ENTITY_DELETE_RESTORE,
            jobId,
            RequestLatencyContext.wrapWithContext(
                () -> {
                  try {
                    PutResponse<T> response = repository.restoreEntity(userName, id);
                    if (response == null) {
                      // Pre-check saw the entity in DELETED state; a null response now means a
                      // concurrent restore won the race. Treat as idempotent success — the
                      // operator's request is satisfied. If the entity has since been hard-
                      // deleted, surface that as a real failure.
                      handleAlreadyRestored(jobId, id, entityName, notifyUserId);
                      return;
                    }
                    repository.restoreFromSearch(response.getEntity());
                    repository.storeChangeEventForAsyncOperation(
                        response.getEntity(), response.getChangeType(), false, userName);
                    LOG.info(
                        "[AsyncRestore] Restored {}:{} (jobId={})",
                        Entity.getEntityTypeFromObject(response.getEntity()),
                        response.getEntity().getId(),
                        jobId);
                    WebsocketNotificationHandler.sendRestoreOperationCompleteNotification(
                        jobId, notifyUserId, response.getEntity());
                  } catch (Exception e) {
                    LOG.error(
                        "[AsyncRestore] Failed to restore {}:{} (name={})",
                        entityType,
                        id,
                        entityName,
                        e);
                    WebsocketNotificationHandler.sendRestoreOperationFailedNotification(
                        jobId,
                        notifyUserId,
                        entityName,
                        e.getMessage() == null ? e.toString() : e.getMessage());
                  }
                }));
    RestoreEntityResponse response =
        new RestoreEntityResponse(jobId, "Restore initiated successfully.");
    return Response.accepted().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  private void handleAlreadyRestored(String jobId, UUID id, String entityName, UUID notifyUserId) {
    try {
      T restored = repository.find(id, Include.NON_DELETED);
      LOG.info(
          "[AsyncRestore] {} {} was already restored by another request (jobId={})",
          entityType,
          id,
          jobId);
      WebsocketNotificationHandler.sendRestoreOperationCompleteNotification(
          jobId, notifyUserId, restored);
    } catch (EntityNotFoundException missing) {
      WebsocketNotificationHandler.sendRestoreOperationFailedNotification(
          jobId, notifyUserId, entityName, "Entity was hard-deleted before restore");
    }
  }

  /**
   * Authorizes a CSV export ({@code VIEW_ALL}) or import ({@code EDIT_ALL}) of {@code name}: by
   * default, of the entity that name identifies. A resource whose CSV names another entity type
   * overrides this.
   */
  protected void authorizeCsv(
      SecurityContext securityContext, String name, MetadataOperation operation) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, operation),
        getResourceContextByName(name));
  }

  public Response exportCsvInternalAsync(
      SecurityContext securityContext, String name, boolean recursive) {
    authorizeCsv(securityContext, name, MetadataOperation.VIEW_ALL);
    CsvAsyncJobManager csvJobManager = CsvAsyncJobManager.getInstance();
    CsvAsyncJob job =
        csvJobManager.createJob(
            CsvAsyncJob.Operation.EXPORT,
            entityType,
            name,
            securityContext.getUserPrincipal().getName(),
            false,
            recursive,
            null,
            null);
    String jobId = job.getJobId();
    CSVExportResponse response = new CSVExportResponse(jobId, "Export initiated successfully.");
    return Response.accepted().entity(response).type(MediaType.APPLICATION_JSON).build();
  }

  /**
   * Adds this entity (a tag) to the assets in the request. Each asset is authorized and saved as its
   * own PATCH; an asset the caller may not edit is reported as a failed row. See {@link
   * #editAssetsAsync} for which assets are saved in the background.
   */
  public Response bulkAddToAssetsAsync(
      SecurityContext securityContext, UUID entityId, BulkAssetsRequestInterface request) {
    return editAssetsAsync(
        securityContext,
        request,
        (assets, requester) ->
            repository.bulkAddAndValidateTagsToAssets(entityId, assets, requester),
        "Bulk Add tags to Asset operation initiated successfully.");
  }

  /** Removes this entity (a tag) from the assets in the request, as {@link #bulkAddToAssetsAsync}. */
  public Response bulkRemoveFromAssetsAsync(
      SecurityContext securityContext, UUID entityId, BulkAssetsRequestInterface request) {
    return editAssetsAsync(
        securityContext,
        request,
        (assets, requester) ->
            repository.bulkRemoveAndValidateTagsToAssets(entityId, assets, requester),
        "Bulk Remove tags to Asset operation initiated successfully.");
  }

  /** An Assets tab edit of the assets in a request, made as the requester. */
  @FunctionalInterface
  private interface AssetsEdit {
    BulkOperationResult apply(BulkAssetsRequestInterface request, PatchRequester requester);
  }

  // The assets whose tags an approval workflow gates are edited before the response, so it can say
  // how many change requests were submitted; the others are edited in the background. The job's
  // outcome reports them all.
  private Response editAssetsAsync(
      SecurityContext securityContext,
      BulkAssetsRequestInterface request,
      AssetsEdit edit,
      String startedMessage) {
    PatchRequester requester = PatchRequester.fromRequest(securityContext, authorizer);
    Optional<BulkOperationResult> gated =
        takeGatedAssets(request, requester).map(assets -> edit.apply(assets, requester));
    String jobId = UUID.randomUUID().toString();
    AsyncService.getInstance()
        .executeDatabaseTask(
            DatabaseOperation.BULK_ASSET_OPERATION,
            jobId,
            RequestLatencyContext.wrapWithContext(
                asRequester(
                    requester,
                    () -> {
                      try {
                        BulkOperationResult result = edit.apply(request, requester);
                        WebsocketNotificationHandler.bulkAssetsOperationCompleteNotification(
                            jobId,
                            securityContext,
                            gated
                                .map(held -> AssetEditService.combine(held, result))
                                .orElse(result));
                      } catch (Exception e) {
                        WebsocketNotificationHandler.bulkAssetsOperationFailedNotification(
                            jobId,
                            securityContext,
                            e.getMessage() == null ? e.toString() : e.getMessage());
                      }
                    })));
    BulkAssetsOperationResponse response = new BulkAssetsOperationResponse(jobId, startedMessage);
    return jobStartedResponse(response, gated.map(EntityResource::submittedCount).orElse(0));
  }

  // Moves the assets whose tags an approval workflow gates for the requester out of the request,
  // into
  // a request of their own.
  private static Optional<BulkAssetsRequestInterface> takeGatedAssets(
      BulkAssetsRequestInterface request, PatchRequester requester) {
    List<EntityReference> assets = listOrEmpty(request.getAssets());
    Set<UUID> gatedIds =
        ApprovalGate.gatedAssets(assets, Entity.FIELD_TAGS, requester.actor().userName());
    Optional<BulkAssetsRequestInterface> gated = Optional.empty();
    if (!gatedIds.isEmpty()) {
      Map<Boolean, List<EntityReference>> split =
          assets.stream().collect(Collectors.partitioningBy(a -> gatedIds.contains(a.getId())));
      BulkAssetsRequestInterface gatedRequest =
          JsonUtils.readValue(JsonUtils.pojoToJson(request), request.getClass());
      gatedRequest.setAssets(new ArrayList<>(split.get(true)));
      request.setAssets(new ArrayList<>(split.get(false)));
      gated = Optional.of(gatedRequest);
    }
    return gated;
  }

  // A dry run submits nothing.
  private static int submittedCount(BulkOperationResult result) {
    return Boolean.TRUE.equals(result.getDryRun())
        ? 0
        : Objects.requireNonNullElse(result.getNumberOfRowsPendingApproval(), 0);
  }

  // The held assets already have change requests, so the response says how many.
  private static Response jobStartedResponse(BulkAssetsOperationResponse response, int submitted) {
    Response.ResponseBuilder builder =
        Response.ok().entity(response).type(MediaType.APPLICATION_JSON);
    if (submitted > 0) {
      builder.header(RestUtil.PENDING_CHANGE_COUNT_HEADER, submitted);
    }
    return builder.build();
  }

  // The job runs on its own thread, and policy conditions such as isImpersonated() read the
  // impersonation from the thread: the job takes the request's, so each asset is authorized as the
  // request would be, and clears it when it ends.
  private static Runnable asRequester(PatchRequester requester, Runnable job) {
    return () -> {
      ImpersonationContext.setImpersonatedBy(requester.actor().impersonatedBy());
      try {
        job.run();
      } finally {
        ImpersonationContext.clear();
      }
    };
  }

  public Response importCsvInternalAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive) {
    return importCsvInternalAsync(uriInfo, securityContext, name, csv, dryRun, recursive, null);
  }

  public Response importCsvInternalAsync(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive,
      String versioningEntityType) {
    authorizeCsv(securityContext, name, MetadataOperation.EDIT_ALL);
    CsvAsyncJobManager csvJobManager = CsvAsyncJobManager.getInstance();
    CsvAsyncJob job =
        csvJobManager.createJob(
            CsvAsyncJob.Operation.IMPORT,
            entityType,
            name,
            securityContext.getUserPrincipal().getName(),
            dryRun,
            recursive,
            csv,
            versioningEntityType);
    String jobId = job.getJobId();
    CSVImportResponse responseEntity = new CSVImportResponse(jobId, "Import is in progress.");
    return Response.ok().entity(responseEntity).type(MediaType.APPLICATION_JSON).build();
  }

  public String exportCsvInternal(SecurityContext securityContext, String name, boolean recursive)
      throws IOException {
    authorizeCsv(securityContext, name, MetadataOperation.VIEW_ALL);
    return repository.exportToCsv(name, securityContext.getUserPrincipal().getName(), recursive);
  }

  protected CsvImportResult importCsvInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive)
      throws IOException {
    return importCsvInternal(uriInfo, securityContext, name, csv, dryRun, recursive, null);
  }

  protected CsvImportResult importCsvInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive,
      String versioningEntityType)
      throws IOException {
    return importCsvInternal(
        uriInfo, securityContext, name, csv, dryRun, recursive, versioningEntityType, null);
  }

  protected CsvImportResult importCsvInternal(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String csv,
      boolean dryRun,
      boolean recursive,
      String versioningEntityType,
      CsvImportProgressCallback progressCallback)
      throws IOException {
    authorizeCsv(securityContext, name, MetadataOperation.EDIT_ALL);
    CsvImportResult result =
        nullOrEmpty(versioningEntityType)
            ? repository.importFromCsv(
                name,
                csv,
                dryRun,
                securityContext.getUserPrincipal().getName(),
                recursive,
                progressCallback)
            : repository.importFromCsv(
                name,
                csv,
                dryRun,
                securityContext.getUserPrincipal().getName(),
                recursive,
                versioningEntityType,
                progressCallback);

    // Create version history for bulk import (same logic as async import)
    String effectiveVersioningEntityType =
        nullOrEmpty(versioningEntityType) ? entityType : versioningEntityType;
    if (result.getStatus() != ApiStatus.ABORTED
        && result.getNumberOfRowsProcessed() > 1
        && !dryRun) {
      EntityRepository<EntityInterface<?>> versioningRepo =
          (EntityRepository<EntityInterface<?>>)
              Entity.getEntityRepository(effectiveVersioningEntityType);

      if (versioningRepo.supportsBulkImportVersioning()) {
        processChangeEventForBulkImport(versioningRepo, uriInfo, securityContext, name, result);
      }
    }
    return result;
  }

  protected void processChangeEventForBulkImport(
      EntityRepository<EntityInterface<?>> versioningRepo,
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      CsvImportResult result) {
    BulkImportVersioning.recordVersion(
        versioningRepo, uriInfo, name, securityContext.getUserPrincipal().getName(), result);
  }

  protected ResourceContext<T> getResourceContext() {
    return new ResourceContext<>(entityType);
  }

  protected ResourceContext<T> getResourceContextById(UUID id) {
    return new ResourceContext<>(entityType, id, null);
  }

  protected ResourceContext<T> getResourceContextById(
      UUID id, ResourceContextInterface.Operation operation) {
    return new ResourceContext<>(entityType, id, null, operation);
  }

  protected ResourceContext<T> getResourceContextById(UUID id, Include include) {
    return new ResourceContext<>(entityType, id, null, include);
  }

  protected ResourceContext<T> getResourceContextById(
      UUID id, RelationIncludes relationIncludes, Fields fields) {
    Include include = relationIncludes == null ? Include.ALL : relationIncludes.getDefaultInclude();
    return new ResourceContext<>(entityType, id, null, include, fields, relationIncludes);
  }

  protected ResourceContext<T> getResourceContextByName(String name) {
    return new ResourceContext<>(entityType, null, name);
  }

  protected ResourceContext<T> getResourceContextByName(
      String name, ResourceContextInterface.Operation operation) {
    return new ResourceContext<>(entityType, null, name, operation);
  }

  protected ResourceContext<T> getResourceContextByName(String name, Include include) {
    return new ResourceContext<>(entityType, null, name, include);
  }

  protected ResourceContext<T> getResourceContextByName(
      String name, RelationIncludes relationIncludes, Fields fields) {
    Include include = relationIncludes == null ? Include.ALL : relationIncludes.getDefaultInclude();
    return new ResourceContext<>(entityType, null, name, include, fields, relationIncludes);
  }

  /**
   * Authorizes VIEW_BASIC on a parent named by FQN and returns one page of its inline child
   * collection: columns, schema fields, tasks or features depending on the entity type.
   *
   * <p>Shared here rather than copied into each resource because the body is identical for every
   * type that has such a collection.
   *
   * <p>Authorization comes first and the parent is loaded afterwards, matching how the table
   * columns endpoint has always ordered the two. The load asks for the registry's required fields
   * rather than reusing the entity the resource context resolved: several repositories null out
   * their inline child collection unless it was explicitly requested, so the context's copy can
   * carry no children at all.
   *
   * <p>Only for entity types the child-field registry knows; calling it for any other type is a
   * programming error and fails loudly.
   */
  protected ResultList<FieldInterface> getChildFieldPage(
      SecurityContext securityContext,
      String fqn,
      int limit,
      int offset,
      String fieldsParam,
      Include include,
      String sortBy,
      String sortOrder) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, VIEW_BASIC),
        getResourceContextByName(fqn, include));
    ChildFieldResolver.ChildContainerSpec spec = ChildFieldResolver.specFor(entityType);
    EntityInterface<?> parent =
        repository.getByName(
            null, fqn, repository.getFields(spec.requiredFields()), include, false);
    return new ChildFieldPageReader(repository, spec)
        .read(
            parent,
            limit,
            offset,
            fieldsParam,
            sortBy,
            sortOrder,
            ChildFieldPageReader.ChildPageEnricher.NONE);
  }

  protected static final MetadataOperation[] VIEW_ALL_OPERATIONS = {MetadataOperation.VIEW_ALL};
  protected static final MetadataOperation[] VIEW_BASIC_OPERATIONS = {VIEW_BASIC};

  protected MetadataOperation[] getViewOperations(Fields fields) {
    return ViewOperations.forFields(entityType, fields).toArray(new MetadataOperation[0]);
  }

  protected EntityReference getEntityReference(String entityType, String fqn) {
    return EntityUtil.getEntityReference(entityType, fqn);
  }

  protected static List<EntityReference> getEntityReferences(String entityType, List<String> fqns) {
    if (nullOrEmpty(fqns)) {
      return null;
    }
    return EntityUtil.getEntityReferences(entityType, fqns);
  }

  protected Response bulkCreateOrUpdateAsync(
      UriInfo uriInfo,
      List<T> entities,
      String userName,
      Map<String, T> existingByFqn,
      boolean overrideMetadata,
      List<BulkResponse> authFailedResponses,
      int totalRequests) {
    repository
        .submitAsyncBulkOperation(
            uriInfo,
            entities,
            userName,
            existingByFqn,
            overrideMetadata,
            authFailedResponses,
            totalRequests)
        .thenAccept(
            result ->
                LOG.info(
                    "Async bulk operation completed for {} {}: {} succeeded, {} failed",
                    entities.size(),
                    entityType,
                    result.getNumberOfRowsPassed(),
                    result.getNumberOfRowsFailed()));

    BulkOperationResult result = new BulkOperationResult();
    result.setNumberOfRowsProcessed(totalRequests);
    result.setNumberOfRowsPassed(0);
    result.setNumberOfRowsFailed(authFailedResponses.size());
    List<BulkResponse> acceptedResponses = new ArrayList<>(entities.size());
    for (T entity : entities) {
      BulkResponse accepted = new BulkResponse();
      accepted.setRequest(entity.getFullyQualifiedName());
      accepted.setStatus(202);
      acceptedResponses.add(accepted);
    }
    result.setSuccessRequest(acceptedResponses);
    if (!authFailedResponses.isEmpty()) {
      result.setStatus(ApiStatus.PARTIAL_SUCCESS);
      result.setFailedRequest(authFailedResponses);
    } else {
      result.setStatus(ApiStatus.SUCCESS);
    }

    return Response.accepted().entity(result).build();
  }

  protected Response bulkCreateOrUpdateSync(
      UriInfo uriInfo,
      List<T> entities,
      String userName,
      Map<String, T> existingByFqn,
      boolean overrideMetadata) {
    BulkOperationResult result =
        repository.bulkCreateOrUpdateEntities(
            uriInfo, entities, userName, existingByFqn, overrideMetadata);
    return Response.ok(result).build();
  }

  /**
   * Reads the {@code overrideMetadata} query param from the bulk request URI. When true, the bulk
   * update path is allowed to overwrite user-curated metadata (description, displayName) that a bot
   * PUT would otherwise preserve, and the sourceHash fast-path is disabled. Read from {@link
   * UriInfo} so the flag is honored uniformly across every {@code /bulk} endpoint without changing
   * each resource method signature.
   */
  protected boolean isOverrideMetadata(UriInfo uriInfo) {
    return Boolean.parseBoolean(uriInfo.getQueryParameters().getFirst("overrideMetadata"));
  }

  /**
   * Deletes entities of this type within the request scope that the ingestion connector did not
   * report in the current run. By default the deletion is soft; set {@code hardDelete=true} on the
   * request to hard-delete. Requires {@code DELETE} permission on this entity type. See {@link
   * EntityRepository#bulkDeleteStaleEntities} for the stale-detection semantics.
   */
  protected Response deleteStaleEntities(
      SecurityContext securityContext, BulkDeleteStaleRequest request) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    BulkOperationResult result =
        repository.bulkDeleteStaleEntities(request, securityContext.getUserPrincipal().getName());
    return Response.ok(result).build();
  }

  protected <C extends CreateEntity> Response processBulkRequest(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<C> createRequests,
      EntityMapper<T, C> mapper,
      boolean async) {

    boolean overrideMetadata = isOverrideMetadata(uriInfo);
    List<T> validEntities = new ArrayList<>();
    List<BulkResponse> failedResponses = new ArrayList<>();

    // Phase 1a: Validate and map all requests to entities
    List<T> mappedEntities = new ArrayList<>();
    Map<T, C> entityToCreateRequest = new IdentityHashMap<>();
    for (C createRequest : createRequests) {
      try {
        String violations = ValidatorUtil.validate(createRequest);
        if (violations != null) {
          throw new IllegalArgumentException(violations);
        }
        T entity =
            mapper.createToEntity(createRequest, securityContext.getUserPrincipal().getName());
        mappedEntities.add(entity);
        entityToCreateRequest.put(entity, createRequest);
      } catch (Exception e) {
        BulkResponse failedResponse = new BulkResponse();
        failedResponse.setRequest(createRequest);
        failedResponse.setMessage(e.getMessage());
        failedResponse.setStatus(400);
        failedResponses.add(failedResponse);
      }
    }

    // Phase 1b: Preload shared parent entities for all mapped entities (1 batch query per type)
    repository.preloadParentsForBulk(mappedEntities);

    // Phase 1c: Prepare each entity (uses preloaded parent cache)
    List<T> preparedEntities = new ArrayList<>();
    Map<String, C> entityToRequest = new HashMap<>();
    try {
      for (T entity : mappedEntities) {
        try {
          repository.prepareInternal(entity, false);
          repository.setFullyQualifiedName(entity);
          preparedEntities.add(entity);
          entityToRequest.put(entity.getFullyQualifiedName(), entityToCreateRequest.get(entity));
        } catch (Exception e) {
          C createRequest = entityToCreateRequest.get(entity);
          BulkResponse failedResponse = new BulkResponse();
          failedResponse.setRequest(createRequest);
          failedResponse.setMessage(e.getMessage());
          failedResponse.setStatus(400);
          failedResponses.add(failedResponse);
        }
      }
    } finally {
      repository.clearParentCache();
    }

    // Phase 2: Batch fetch existing entities (1 DB query instead of N)
    Map<String, T> existingByFqn = new HashMap<>();
    if (!preparedEntities.isEmpty()) {
      List<String> allFqns =
          preparedEntities.stream().map(T::getFullyQualifiedName).collect(Collectors.toList());
      List<T> existingEntities = repository.getDao().findEntityByNames(allFqns, Include.ALL);
      for (T existing : existingEntities) {
        existingByFqn.put(existing.getFullyQualifiedName(), existing);
      }
      if (!existingEntities.isEmpty()) {
        repository.enrichEntitiesForAuth(existingEntities);
        prepareCreateOrUpdateAuthorization(existingEntities);
      }
    }

    // On-demand policy fields are batch-loaded once for the whole request rather than per entity:
    // the first policy that reads tags hydrates them for every existing entity in a single query,
    // avoiding an N+1. A field no policy inspects is never loaded. New on-demand fields are added
    // here as another entry, with no change to ResourceContext.
    BulkFieldHydrator bulkFieldHydrator =
        BulkFieldHydrator.forTags(repository, new ArrayList<>(existingByFqn.values()));

    // Phase 3: Auth check using batch results
    for (T entity : preparedEntities) {
      try {
        boolean entityExists = existingByFqn.containsKey(entity.getFullyQualifiedName());

        if (!entityExists) {
          OperationContext operationContext = new OperationContext(entityType, CREATE);
          CreateResourceContext<T> createResourceContext =
              new CreateResourceContext<>(entityType, entity);
          limits.enforceLimits(securityContext, createResourceContext, operationContext);
          authorizer.authorize(securityContext, operationContext, createResourceContext);
          authorizeCreateOrUpdate(securityContext, entity, null);
        } else {
          MetadataOperation operation = MetadataOperation.EDIT_ALL;
          OperationContext operationContext = new OperationContext(entityType, operation);
          T existingEntity = existingByFqn.get(entity.getFullyQualifiedName());
          ResourceContext<T> resourceContext =
              new ResourceContext<>(entityType, existingEntity, repository, bulkFieldHydrator);
          authorizer.authorize(securityContext, operationContext, resourceContext);
          authorizeCreateOrUpdate(securityContext, entity, existingEntity);
        }

        validEntities.add(entity);
      } catch (AuthorizationException e) {
        BulkResponse failedResponse = new BulkResponse();
        failedResponse.setRequest(entityToRequest.get(entity.getFullyQualifiedName()));
        failedResponse.setMessage("Permission denied: " + e.getMessage());
        failedResponse.setStatus(403);
        failedResponses.add(failedResponse);
      } catch (Exception e) {
        BulkResponse failedResponse = new BulkResponse();
        failedResponse.setRequest(entityToRequest.get(entity.getFullyQualifiedName()));
        failedResponse.setMessage(e.getMessage());
        failedResponse.setStatus(400);
        failedResponses.add(failedResponse);
      }
    }

    if (validEntities.isEmpty()) {
      BulkOperationResult result = new BulkOperationResult();
      result.setStatus(ApiStatus.FAILURE);
      result.setNumberOfRowsProcessed(createRequests.size());
      result.setNumberOfRowsPassed(0);
      result.setNumberOfRowsFailed(createRequests.size());
      result.setFailedRequest(failedResponses);
      return Response.ok(result).build();
    }

    String userName = securityContext.getUserPrincipal().getName();
    Response response;
    if (async) {
      response =
          bulkCreateOrUpdateAsync(
              uriInfo,
              validEntities,
              userName,
              existingByFqn,
              overrideMetadata,
              failedResponses,
              createRequests.size());
    } else {
      BulkOperationResult result =
          repository.bulkCreateOrUpdateEntities(
              uriInfo, validEntities, userName, existingByFqn, overrideMetadata);

      if (!failedResponses.isEmpty()) {
        result.setStatus(ApiStatus.PARTIAL_SUCCESS);
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + failedResponses.size());
        result.setNumberOfRowsProcessed(createRequests.size());
        if (result.getFailedRequest() == null) {
          result.setFailedRequest(failedResponses);
        } else {
          result.getFailedRequest().addAll(failedResponses);
        }
      }
      response = Response.ok(result).build();
    }

    return response;
  }

  protected void addViewOperation(String fieldsParam, MetadataOperation operation) {
    String[] fields = fieldsParam.replace(" ", "").split(",");
    for (String field : fields) {
      if (allowedFields.contains(field)) {
        fieldsToViewOperations.put(field, operation);
      } else if (!"owners,followers,votes,tags,extension,domains,dataProducts,experts,reviewers"
          .contains(field)) {
        // Some common fields for all the entities might be missing. Ignore it.
        throw new IllegalArgumentException(CatalogExceptionMessage.invalidField(field));
      }
    }
  }

  @GET
  @Path("/{id}/context")
  @Produces({AIContextMarkdown.TEXT_MARKDOWN, MediaType.APPLICATION_JSON})
  @Operation(
      operationId = "getEntityAiContextById",
      summary = "Get the AI context for an entity by id",
      description =
          "Retrieve the LLM-ready AI Context (Context Profile) for the entity — its attached "
              + "business knowledge (glossary terms, Context Center articles, applied metrics), "
              + "type-specific structural context, and depth-1 lineage — as an OKF-style markdown "
              + "document (default) or the structured AIContext JSON (`?format=json`).",
      responses = {
        @ApiResponse(responseCode = "200", description = "Entity AI context"),
        @ApiResponse(responseCode = "404", description = "Entity not found")
      })
  public Response getAiContextById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity id", required = true) @PathParam("id") UUID id,
      @Parameter(description = "Output format: markdown (default) or json")
          @QueryParam("format")
          @DefaultValue("markdown")
          String format,
      @Parameter(
              description =
                  "Optional question; truncated knowledge items are excerpted to the passage most "
                      + "relevant to it instead of the positional lead")
          @QueryParam("query")
          String query) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        getResourceContextById(id));
    EntityReference reference = Entity.getEntityReferenceById(entityType, id, Include.NON_DELETED);
    return renderAiContext(reference.getFullyQualifiedName(), securityContext, format, query);
  }

  @GET
  @Path("/name/{fqn}/context")
  @Produces({AIContextMarkdown.TEXT_MARKDOWN, MediaType.APPLICATION_JSON})
  @Operation(
      operationId = "getEntityAiContextByName",
      summary = "Get the AI context for an entity by fully qualified name",
      description =
          "Retrieve the LLM-ready AI Context (Context Profile) for the entity by FQN — see "
              + "getEntityAiContextById. Returns an OKF-style markdown document by default, or the "
              + "structured AIContext JSON with `?format=json`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Entity AI context"),
        @ApiResponse(responseCode = "404", description = "Entity not found")
      })
  public Response getAiContextByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity fully qualified name", required = true) @PathParam("fqn")
          String fqn,
      @Parameter(description = "Output format: markdown (default) or json")
          @QueryParam("format")
          @DefaultValue("markdown")
          String format,
      @Parameter(
              description =
                  "Optional question; truncated knowledge items are excerpted to the passage most "
                      + "relevant to it instead of the positional lead")
          @QueryParam("query")
          String query) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        getResourceContextByName(fqn));
    return renderAiContext(fqn, securityContext, format, query);
  }

  private Response renderAiContext(
      String fqn, SecurityContext securityContext, String format, String query) {
    AIContext context =
        new AIContextBuilder(entityType, fqn)
            .withQuery(query)
            .withSecurity(authorizer, securityContext)
            .build();
    Response response;
    if (AIContextMarkdown.FORMAT_JSON.equalsIgnoreCase(format)) {
      response = Response.ok(context, MediaType.APPLICATION_JSON).build();
    } else {
      response =
          Response.ok(AIContextMarkdown.render(context), AIContextMarkdown.TEXT_MARKDOWN).build();
    }
    return response;
  }

  @GET
  @Path("/history")
  @Operation(
      operationId = "listAllEntityVersionsByTimestamp",
      summary = "List all entity versions within a time range",
      description =
          "Get a paginated list of all entity versions within a given time range "
              + "specified by `startTs` and `endTs` in milliseconds since epoch. ",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of all versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class)))
      })
  public ResultList<T> listEntityHistoryByTimestamp(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Start timestamp in milliseconds since epoch", required = true)
          @QueryParam("startTs")
          long startTs,
      @Parameter(description = "End timestamp in milliseconds since epoch", required = true)
          @QueryParam("endTs")
          long endTs,
      @Parameter(description = "Limit the number of entity returned (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 1, message = "must be greater than or equal to 1")
          @Max(value = 500, message = "must be less than or equal to 500")
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of entity versions before this cursor")
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of entity versions after this cursor")
          @QueryParam("after")
          String after) {
    return listEntityHistoryByTimestampInternal(
        securityContext, startTs, endTs, before, after, limitParam);
  }
}
