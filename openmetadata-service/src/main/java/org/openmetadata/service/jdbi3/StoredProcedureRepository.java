package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.StoredProcedureResource;
import org.openmetadata.service.resources.searchindex.SearchIndexResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

import java.util.List;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.SEARCH_SERVICE;

public class StoredProcedureRepository extends EntityRepository<StoredProcedure> {
  public StoredProcedureRepository(CollectionDAO dao) {
    super(
        StoredProcedureResource.COLLECTION_PATH, Entity.SEARCH_INDEX, StoredProcedure.class, dao.storedProcedureDAO(), dao, "", "");
  }

  @Override
  public void setFullyQualifiedName(StoredProcedure storedProcedure) {
    storedProcedure.setFullyQualifiedName(
        FullyQualifiedName.add(storedProcedure.getDatabaseSchema().getFullyQualifiedName(), storedProcedure.getName()));
  }

  @Override
  public void prepare(StoredProcedure storedProcedure) {
    populateDatabaseSchema(storedProcedure.getDatabaseSchema());
    populateDatabase(storedProcedure.getDatabaseSchema());

  }

  @Override
  public void storeEntity(SearchIndex searchIndex, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = searchIndex.getService();
    searchIndex.withService(null);

    // Don't store fields tags as JSON but build it on the fly based on relationships
    List<SearchIndexField> fieldsWithTags = null;
    if (searchIndex.getFields() != null) {
      fieldsWithTags = searchIndex.getFields();
      searchIndex.setFields(cloneWithoutTags(fieldsWithTags));
      searchIndex.getFields().forEach(field -> field.setTags(null));
    }

    store(searchIndex, update);

    // Restore the relationships
    if (fieldsWithTags != null) {
      searchIndex.setFields(fieldsWithTags);
    }
    searchIndex.withService(service);
  }

  @Override
  public void storeRelationships(StoredProcedure storedProcedure) {
    setService(searchIndex, searchIndex.getService());
  }

  @Override
  public StoredProcedure setInheritedFields(StoredProcedure storedProcedure, EntityUtil.Fields fields) {
    DatabaseSchema schema = Entity.getEntity(DATABASE_SCHEMA, storedProcedure.getDatabaseSchema().getId(), "owner,domain", ALL);
    inheritOwner(storedProcedure, fields, schema);
    inheritDomain(storedProcedure, fields, schema);

  }

  @Override
  public SearchIndex setFields(SearchIndex searchIndex, EntityUtil.Fields fields) {
    searchIndex.setService(getContainer(searchIndex.getId()));
    searchIndex.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(searchIndex) : null);
    if (searchIndex.getFields() != null) {
      getFieldTags(fields.contains(FIELD_TAGS), searchIndex.getFields());
    }
    return searchIndex;
  }

  @Override
  public SearchIndex clearFields(SearchIndex searchIndex, EntityUtil.Fields fields) {
    return searchIndex;
  }

  @Override
  public SearchIndexRepository.SearchIndexUpdater getUpdater(SearchIndex original, SearchIndex updated, Operation operation) {
    return new SearchIndexRepository.SearchIndexUpdater(original, updated, operation);
  }

  public void setService(SearchIndex searchIndex, EntityReference service) {
    if (service != null && searchIndex != null) {
      addRelationship(
          service.getId(), searchIndex.getId(), service.getType(), Entity.SEARCH_INDEX, Relationship.CONTAINS);
      searchIndex.setService(service);
    }
  }

  private void populateDatabase(StoredProcedure storedProcedure) {
    Database database = Entity.getEntity(storedProcedure.getDatabaseSchema(), "", ALL);
    storedProcedure
        .withDatabase(database.getEntityReference())
        .withService(database.getService())
        .withServiceType(database.getServiceType());
  }
  private void populateDatabaseSchema(DatabaseSchema schema) {
    Database database = Entity.getEntity(schema.getDatabase(), "", ALL);
    schema
        .withDatabase(database.getEntityReference())
        .withService(database.getService())
        .withServiceType(database.getServiceType());
  }
}
