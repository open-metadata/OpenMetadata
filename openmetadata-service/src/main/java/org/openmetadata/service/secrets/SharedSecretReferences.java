package org.openmetadata.service.secrets;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.secrets.SecretsManager.SecretInventory;

/** A key held outside its owning namespace can be retired only after the last config releases it. */
final class SharedSecretReferences {
  private static final String EXTENSION = "secrets.pendingSharedKey";
  private static final int PAGE_SIZE = 100;
  private final EntityExtensionDAO dao;
  private final SecretsManager manager;

  SharedSecretReferences(EntityExtensionDAO dao, SecretsManager manager) {
    this.dao = dao;
    this.manager = manager;
  }

  Set<String> rootsReleasedBy(String root, Set<String> previous, Set<String> stored) {
    Set<String> removed = canonical(previous);
    removed.removeAll(canonical(stored));
    Set<String> roots = new HashSet<>();
    for (String name : removed) {
      String json = dao.getExtensionForUpdate(idFor(name), EXTENSION);
      if (json != null) {
        String owner = JsonUtils.readValue(json, String.class);
        if (!owner.equals(root)) {
          roots.add(owner);
        }
      }
    }
    return roots;
  }

  private Set<String> canonical(Set<String> references) {
    return references.stream().map(manager::canonicalSecretName).collect(Collectors.toSet());
  }

  Set<String> unreferenced(Set<String> candidates) {
    Set<String> missing = canonical(candidates);
    // A config may predate the ownership ledger, and its reference may be Fernet-wrapped.
    // Inspect persisted rows under the existing lock before an irreversible vault deletion.
    dao.useHandle(
        handle -> {
          for (ServiceType type : ServiceType.values()) {
            if (!missing.isEmpty()) {
              findIn(
                  handle,
                  Entity.getServiceEntityRepository(type),
                  entity -> manager.secretInventory((ServiceEntityInterface) entity, type),
                  missing);
            }
          }
          if (!missing.isEmpty()) {
            findIn(
                handle,
                Entity.getEntityRepository(Entity.INGESTION_PIPELINE),
                entity -> manager.secretInventory((IngestionPipeline) entity),
                missing);
          }
        });
    return missing;
  }

  private void findIn(
      Handle handle,
      EntityRepository<?> repository,
      Function<EntityInterface<?>, SecretInventory> inventory,
      Set<String> missing) {
    String after = "";
    List<String> page;
    do {
      page =
          handle
              .createQuery("SELECT json FROM <table> WHERE id > :after ORDER BY id LIMIT :limit")
              .define("table", repository.getDao().getTableName())
              .bind("after", after)
              .bind("limit", PAGE_SIZE)
              .mapTo(String.class)
              .list();
      var rows = page.iterator();
      while (!missing.isEmpty() && rows.hasNext()) {
        EntityInterface<?> entity = JsonUtils.readValue(rows.next(), repository.getEntityClass());
        SecretInventory current = inventory.apply(entity);
        current.references().forEach(ref -> missing.remove(manager.canonicalSecretName(ref)));
        after = entity.getId().toString();
      }
    } while (!missing.isEmpty() && page.size() == PAGE_SIZE);
  }

  void defer(String canonical, String owner) {
    dao.insert(idFor(canonical), EXTENSION, EXTENSION, JsonUtils.pojoToJson(owner));
  }

  void forget(String canonical) {
    dao.delete(idFor(canonical), EXTENSION);
  }

  private static UUID idFor(String key) {
    return UUID.nameUUIDFromBytes((EXTENSION + ":" + key).getBytes(StandardCharsets.UTF_8));
  }
}
