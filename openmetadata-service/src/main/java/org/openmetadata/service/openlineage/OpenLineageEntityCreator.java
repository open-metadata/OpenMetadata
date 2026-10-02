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

package org.openmetadata.service.openlineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.INVALID_ENTITY;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.MISSING_COLUMNS;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.MISSING_DATABASE;
import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.SERVICE_NOT_FOUND;
import static org.openmetadata.service.openlineage.OpenLineageResolution.resolved;
import static org.openmetadata.service.openlineage.OpenLineageResolution.unresolved;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.DocumentationFacet;
import org.openmetadata.schema.api.lineage.openlineage.Owner;
import org.openmetadata.schema.api.lineage.openlineage.OwnershipFacet;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.databases.DatabaseMapper;
import org.openmetadata.service.resources.databases.DatabaseSchemaMapper;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Creates the table an OpenLineage dataset names, together with any missing database and schema,
 * under the database service its namespace is mapped to. Everything goes through the same create
 * mappers as the REST API, so new entities carry audit fields and pass the same validation. A table
 * is only created when the event carries its columns; an empty shell is never created.
 */
@Slf4j
public class OpenLineageEntityCreator {

  private static final String SERVICE_FILTER = "service";

  /** Where a missing table goes. {@code database} is null when the dataset name omits it. */
  public record TableLocation(String service, String database, String schema, String table) {}

  private record TableDraft(
      TableLocation location,
      List<Column> columns,
      String description,
      List<EntityReference> owners,
      String createdBy) {}

  private final DatabaseMapper databaseMapper = new DatabaseMapper();
  private final DatabaseSchemaMapper schemaMapper = new DatabaseSchemaMapper();
  private final TableMapper tableMapper = new TableMapper();

  public OpenLineageResolution createTable(
      TableLocation location, DatasetFacets facets, String createdBy) {
    List<Column> columns = OpenLineageColumnMapper.toColumns(facets);
    OpenLineageResolution result;
    if (columns.isEmpty()) {
      result =
          unresolved(
              MISSING_COLUMNS,
              "No matching table exists and the event carries no schema facet fields to create one with");
    } else {
      result =
          createUnderService(
              new TableDraft(location, columns, description(facets), owners(facets), createdBy));
    }
    return result;
  }

  private OpenLineageResolution createUnderService(TableDraft draft) {
    String serviceName = draft.location().service();
    EntityRepository<DatabaseService> services = repository(Entity.DATABASE_SERVICE);
    DatabaseService service =
        services.findByNameOrNull(FullyQualifiedName.build(serviceName), Include.NON_DELETED);
    return service == null
        ? unresolved(
            SERVICE_NOT_FOUND,
            String.format(
                "The namespace maps to database service '%s', which does not exist", serviceName))
        : createUnderDatabase(service.getEntityReference(), draft);
  }

  private OpenLineageResolution createUnderDatabase(EntityReference service, TableDraft draft) {
    String database =
        draft.location().database() != null ? draft.location().database() : onlyDatabase(service);
    return database == null
        ? unresolved(
            MISSING_DATABASE,
            String.format(
                "The dataset name has no database, and service '%s' does not have exactly one",
                service.getName()))
        : createValidated(service, database, draft);
  }

  /**
   * Columns are validated before anything is written, so a table that would be rejected never
   * leaves an empty database or schema behind.
   */
  private OpenLineageResolution createValidated(
      EntityReference service, String databaseName, TableDraft draft) {
    OpenLineageResolution result;
    try {
      DatabaseUtil.validateColumns(draft.columns());
      Database database = findOrCreateDatabase(service, databaseName, draft.createdBy());
      DatabaseSchema schema = findOrCreateSchema(database, draft);
      result = resolved(findOrCreateTable(schema, draft).getEntityReference());
    } catch (IllegalArgumentException e) {
      result = unresolved(INVALID_ENTITY, e.getMessage());
    }
    return result;
  }

  private Database findOrCreateDatabase(EntityReference service, String name, String createdBy) {
    return findOrCreate(
        Entity.DATABASE,
        FullyQualifiedName.add(service.getFullyQualifiedName(), name),
        () ->
            databaseMapper.createToEntity(
                new CreateDatabase().withName(name).withService(service.getFullyQualifiedName()),
                createdBy));
  }

  private DatabaseSchema findOrCreateSchema(Database database, TableDraft draft) {
    String name = draft.location().schema();
    return findOrCreate(
        Entity.DATABASE_SCHEMA,
        FullyQualifiedName.add(database.getFullyQualifiedName(), name),
        () ->
            schemaMapper.createToEntity(
                new CreateDatabaseSchema()
                    .withName(name)
                    .withDatabase(database.getFullyQualifiedName()),
                draft.createdBy()));
  }

  private Table findOrCreateTable(DatabaseSchema schema, TableDraft draft) {
    String name = draft.location().table();
    CreateTable request =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(draft.columns())
            .withDescription(draft.description())
            .withOwners(draft.owners().isEmpty() ? null : draft.owners());
    return findOrCreate(
        Entity.TABLE,
        FullyQualifiedName.add(schema.getFullyQualifiedName(), name),
        () -> tableMapper.createToEntity(request, draft.createdBy()));
  }

  private static <T extends EntityInterface> T findOrCreate(
      String entityType, String fqn, Supplier<T> newEntity) {
    EntityRepository<T> repository = repository(entityType);
    T existing = requireNotDeleted(entityType, repository.findByNameOrNull(fqn, Include.ALL));
    return existing != null ? existing : createOrAdoptConcurrent(repository, fqn, newEntity.get());
  }

  /**
   * A soft-deleted entity still owns its name, so creating a new one would collide with it. Asking
   * for a restore is the only way the lineage can land on it.
   */
  private static <T extends EntityInterface> T requireNotDeleted(String entityType, T entity) {
    if (entity != null && Boolean.TRUE.equals(entity.getDeleted())) {
      throw new IllegalArgumentException(
          String.format(
              "%s '%s' is soft-deleted; restore it to record lineage against it",
              entityType, entity.getFullyQualifiedName()));
    }
    return entity;
  }

  /**
   * Two events naming the same missing entity can race to create it. The loser's insert fails on
   * the unique name, and the winner's row is the one both events should use.
   */
  private static <T extends EntityInterface> T createOrAdoptConcurrent(
      EntityRepository<T> repository, String fqn, T entity) {
    T created;
    try {
      created = repository.create(null, entity);
      LOG.info("Created {} {} from an OpenLineage event", repository.getEntityType(), fqn);
    } catch (UnableToExecuteStatementException e) {
      created = repository.findByNameOrNull(fqn, Include.NON_DELETED);
      if (created == null) {
        throw e;
      }
    }
    return created;
  }

  /** Two rows are enough to tell "exactly one" apart from "several" without listing them all. */
  private static String onlyDatabase(EntityReference service) {
    EntityRepository<Database> databases = repository(Entity.DATABASE);
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam(SERVICE_FILTER, service.getFullyQualifiedName());
    List<Database> firstTwo =
        databases.listAfter(null, databases.getFields(""), filter, 2, null).getData();
    return firstTwo.size() == 1 ? firstTwo.getFirst().getName() : null;
  }

  private static String description(DatasetFacets facets) {
    DocumentationFacet documentation = facets != null ? facets.getDocumentation() : null;
    return documentation != null ? documentation.getDescription() : null;
  }

  /** Owners the event names but OpenMetadata does not know are dropped rather than invented. */
  private static List<EntityReference> owners(DatasetFacets facets) {
    OwnershipFacet ownership = facets != null ? facets.getOwnership() : null;
    List<Owner> named =
        ownership == null || nullOrEmpty(ownership.getOwners()) ? List.of() : ownership.getOwners();
    return named.stream()
        .map(Owner::getName)
        .filter(name -> !nullOrEmpty(name))
        .map(OpenLineageEntityCreator::findUser)
        .filter(Objects::nonNull)
        .map(User::getEntityReference)
        .collect(Collectors.toCollection(ArrayList::new));
  }

  private static User findUser(String name) {
    EntityRepository<User> users = repository(Entity.USER);
    return users.findByNameOrNull(FullyQualifiedName.build(name), Include.NON_DELETED);
  }

  @SuppressWarnings("unchecked")
  private static <T extends EntityInterface> EntityRepository<T> repository(String entityType) {
    return (EntityRepository<T>) Entity.getEntityRepository(entityType);
  }
}
