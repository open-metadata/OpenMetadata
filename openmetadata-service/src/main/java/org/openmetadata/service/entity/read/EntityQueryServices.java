package org.openmetadata.service.entity.read;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;
import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import jakarta.ws.rs.core.UriInfo;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.BooleanSupplier;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.DerivedTagLoader.FailureMode;
import org.openmetadata.service.entity.metadata.EntityExtensionService;
import org.openmetadata.service.entity.metadata.EntityTagReader;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/** Composes detail, collection, paging and inheritance reads from one retained metadata graph. */
public final class EntityQueryServices<T extends EntityInterface> {
  public record Schema<T extends EntityInterface>(
      EntityReadFactory.Schema<T> rows, EntityLookupService<T> lookup, Set<String> fields) {
    public Schema {
      fields = Set.copyOf(fields);
    }
  }

  public record Dependencies(
      CollectionDAO daos, EntityRelationshipRepository relationships, SearchRepository search) {}

  public record Values<T extends EntityInterface>(
      EntityMetadataReads<T> metadata,
      EntityTagReader<T> tags,
      EntityExtensionService extensions) {}

  @FunctionalInterface
  public interface Plan<T> {
    void augment(ReadPlanBuilder builder, T entity, Fields fields, RelationIncludes includes);
  }

  public record Detail<T>(
      BooleanSupplier quoteFqn,
      Plan<T> plan,
      EntityReadFactory.Prefetch<T> prefetch,
      BiConsumer<T, Fields> inherit,
      BiFunction<UriInfo, T, T> withHref) {}

  public record Bulk<T>(
      BiConsumer<Fields, List<T>> load,
      EntityCollectionReader.FilteredHydration<T> filtered,
      BiConsumer<List<T>, Fields> inherit,
      BiConsumer<List<T>, Fields> children,
      Supplier<FailureMode> tagFailureMode) {}

  public record Inheritance<T>(
      EntityInheritanceLoader.Policy<T> load,
      EntityInheritanceLoader.Parents<T> parents,
      BiConsumer<T, Fields> fallback,
      EntityInheritanceReader.Policy<T> read) {}

  public record Paging<T>(Function<T, String> cursor, EntityPagePolicy<T> policy) {}

  public record Policies<T>(
      Detail<T> detail, Bulk<T> bulk, Inheritance<T> inheritance, Paging<T> paging) {}

  private final Schema<T> schema;
  private final Values<T> values;
  private final Policies<T> policies;
  private final ReadPlanner planner = new ReadPlanner();
  private final EntityFieldLoading<T> fields;
  private final EntityInheritanceLoader<T> inheritance;
  private final EntityInheritanceReader<T> inheritanceReads;
  private final EntityReadService<T> reads;
  private final EntityCollectionReader<T> collections;
  private final EntityPageReader<T> pages;
  private final EntitySearchReader<T> search;

  public EntityQueryServices(
      final Schema<T> schema,
      final Dependencies dependencies,
      final Values<T> values,
      final Policies<T> policies) {
    this.schema = schema;
    this.values = values;
    this.policies = policies;
    fields = fieldLoading(values, policies.bulk());
    inheritance =
        new EntityInheritanceLoader<>(
            policies.inheritance().load(),
            policies.inheritance().parents(),
            policies.inheritance().fallback());
    inheritanceReads = inheritanceReader(dependencies.daos());
    reads = detail(bundles(dependencies));
    collections = collections(schema);
    pages =
        EntityReadFactory.pages(
            schema.rows(), rowHydration(), policies.paging().cursor(), policies.paging().policy());
    search =
        EntityReadFactory.search(
            schema.rows(), dependencies.search(), policies.detail().withHref());
  }

  public EntityReadService<T> reads() {
    return reads;
  }

  public EntityCollectionReader<T> collections() {
    return collections;
  }

  public EntityPageReader<T> pages() {
    return pages;
  }

  public EntitySearchReader<T> search() {
    return search;
  }

  public EntityFieldLoading<T> fields() {
    return fields;
  }

  public EntityInheritanceLoader<T> inheritance() {
    return inheritance;
  }

  public EntityInheritanceReader<T> inheritanceReads() {
    return inheritanceReads;
  }

  private EntityFieldLoading<T> fieldLoading(final Values<T> values, final Bulk<T> policy) {
    final EntityFieldLoading<T> loading =
        new EntityFieldLoading<>(
            (entities, selected) -> values.metadata().bulk().load(entities, selected),
            values.tags()::populate,
            policy.tagFailureMode());
    final Map<String, BiConsumer<List<T>, Fields>> defaults = new HashMap<>();
    if (schema.fields().contains(FIELD_EXTENSION)) {
      defaults.put(
          FIELD_EXTENSION,
          (entities, selected) ->
              values.extensions().populate(entities, selected.contains(FIELD_EXTENSION)));
    }
    if (schema.fields().contains(FIELD_CHILDREN)) {
      defaults.put(FIELD_CHILDREN, policy.children());
    }
    defaults.forEach(loading::register);
    return loading;
  }

  private EntityInheritanceReader<T> inheritanceReader(final CollectionDAO daos) {
    return new EntityInheritanceReader<>(
        new EntityInheritanceReader.Capabilities(
            schema.rows().type(),
            schema.fields().contains(FIELD_OWNERS),
            schema.fields().contains(FIELD_DOMAINS)),
        () -> daos.relationshipDAO(),
        new EntityInheritanceReader.Lookup<>(
            schema.lookup()::byId,
            (records, include) ->
                Entity.getEntityRelationshipRepository().getEntityReferences(records, include),
            id ->
                values
                    .metadata()
                    .relationships()
                    .singleFrom(id, Relationship.CONTAINS, null, false),
            Entity::getEntityForInheritance),
        policies.inheritance().read());
  }

  private ReadBundleLoader<T> bundles(final Dependencies dependencies) {
    return EntityReadFactory.bundles(
        schema.rows(),
        dependencies.daos(),
        dependencies.relationships(),
        schema.fields().contains(FIELD_CERTIFICATION),
        new EntityReadFactory.Metadata<>(
            values.tags()::loadBundle,
            entity ->
                values
                    .metadata()
                    .votes()
                    .readMany(List.of(entity))
                    .getOrDefault(entity.getId(), new Votes()),
            entity -> values.extensions().readMany(List.of(entity)).get(entity.getId()),
            policies.detail().prefetch()));
  }

  private EntityReadService<T> detail(final ReadBundleLoader<T> bundles) {
    return EntityReadFactory.detail(
        schema.rows(),
        name -> policies.detail().quoteFqn().getAsBoolean() ? quoteName(name) : name,
        schema.lookup(),
        new EntityReadService.Hydration<>(
            this::plan,
            bundles::load,
            values.metadata().hydrator()::hydrate,
            policies.detail().inherit(),
            values.metadata().hydrator()::clear),
        policies.detail().withHref());
  }

  private ReadPlan plan(final T entity, final Fields fields, final RelationIncludes includes) {
    final ReadPlanBuilder builder =
        planner.newBuilder(entity, fields, includes, values.metadata().plannerConfig());
    policies.detail().plan().augment(builder, entity, fields, includes);
    return builder.build();
  }

  private EntityCollectionReader<T> collections(final Schema<T> schema) {
    return new EntityCollectionReader<>(
        schema.rows(),
        new EntityCollectionReader.Lookup<>(
            schema.lookup()::byIds, schema.rows().dao()::findEntityByNames),
        new EntityCollectionReader.Hydration<>(
            policies.bulk().load(),
            policies.bulk().filtered(),
            this::hydrateCsv,
            policies.detail().withHref()));
  }

  private void hydrateCsv(final Fields selected, final List<T> entities) {
    fields.populate(entities, selected);
    policies.bulk().inherit().accept(entities, selected);
    entities.forEach(entity -> values.metadata().hydrator().clear(entity, selected));
  }

  private void hydrateSingle(final T entity, final Fields fields) {
    values.metadata().hydrator().hydrate(entity, fields, RelationIncludes.fromInclude(NON_DELETED));
    policies.detail().inherit().accept(entity, fields);
    values.metadata().hydrator().clear(entity, fields);
  }

  private EntityRowReader.Hydration<T> rowHydration() {
    return new EntityRowReader.Hydration<>() {
      @Override
      public void bulk(final List<T> entities, final EntityPageReader.Projection projection) {
        policies.bulk().filtered().hydrate(projection.fields(), entities, projection.filter());
      }

      @Override
      public void single(final T entity, final Fields fields) {
        hydrateSingle(entity, fields);
      }

      @Override
      public void clear(final T entity, final Fields fields) {
        values.metadata().hydrator().clear(entity, fields);
      }

      @Override
      public T withHref(final T entity, final UriInfo uri) {
        return policies.detail().withHref().apply(uri, entity);
      }
    };
  }
}
