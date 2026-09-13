package org.openmetadata.service.entity.policy;

import static org.openmetadata.service.Entity.getEntityFields;

import com.google.common.cache.Cache;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.EntityFieldPolicy;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleServices;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Startup bindings for a policy; native components are constructed once by the module factory.
 */
public final class EntityPolicyContext<T extends EntityInterface> {

  public record Schema<T extends EntityInterface>(
      String collectionPath, String entityType, Class<T> entityClass, EntityDAO<T> dao) {}

  public record WriteFields(String patch, String put, Set<String> summaries) {

    public WriteFields {
      summaries = Set.copyOf(summaries);
    }
  }

  private final Schema<T> schema;

  private final WriteFields writeFields;

  private final EntityModuleDependencies dependencies;

  private final Set<String> allowed;

  private final Set<String> supported;

  private final EntityFieldPolicy fieldPolicy;

  private final Fields patchFields;

  private final Fields putFields;

  private final EntityPolicyOptions options = new EntityPolicyOptions();

  private final EntityModuleServices<T> services = new EntityModuleServices<>();

  private final ThreadLocal<Cache<UUID, EntityInterface>> parentCache = new ThreadLocal<>();

  private EntityPolicy<T> policy;

  public EntityPolicyContext(
      Schema<T> schema, WriteFields writeFields, EntityModuleDependencies dependencies) {
    this.schema = schema;
    this.writeFields = writeFields;
    this.dependencies = dependencies;
    allowed = getEntityFields(schema.entityClass());
    supported = Set.copyOf(allowed);
    fieldPolicy = new EntityFieldPolicy(allowed);
    patchFields = fieldPolicy.parse(writeFields.patch());
    putFields = fieldPolicy.parse(writeFields.put());
    fieldPolicy.addCommonWriteFields(patchFields, putFields);
  }

  public synchronized void bind(EntityPolicy<T> policy) {
    if (this.policy != null) {
      throw new IllegalStateException(
          "Entity module has already been bound: " + schema.entityType());
    }
    this.policy = policy;
  }

  public EntityPolicy<T> policy() {
    return policy;
  }

  public Schema<T> schema() {
    return schema;
  }

  public WriteFields writeFields() {
    return writeFields;
  }

  public EntityModuleDependencies dependencies() {
    return dependencies;
  }

  public Set<String> allowedFields() {
    return allowed;
  }

  public boolean supports(String field) {
    return supported.contains(field);
  }

  public EntityFieldPolicy fieldPolicy() {
    return fieldPolicy;
  }

  public Fields patchFields() {
    return patchFields;
  }

  public Fields putFields() {
    return putFields;
  }

  public EntityPolicyOptions options() {
    return options;
  }

  public EntityModuleServices<T> services() {
    return services;
  }

  public ThreadLocal<Cache<UUID, EntityInterface>> parentCache() {
    return parentCache;
  }
}
