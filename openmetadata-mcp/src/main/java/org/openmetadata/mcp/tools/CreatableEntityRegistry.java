package org.openmetadata.mcp.tools;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.context.ContextMemoryMapper;
import org.openmetadata.service.resources.domains.DataProductMapper;
import org.openmetadata.service.resources.domains.DomainMapper;
import org.openmetadata.service.resources.glossary.GlossaryMapper;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;
import org.openmetadata.service.resources.metrics.MetricMapper;
import org.openmetadata.service.resources.tags.ClassificationMapper;
import org.openmetadata.service.resources.tags.TagMapper;

/**
 * The entity types {@code create_entity} can write, and what each one needs: the request class the
 * caller's fields bind to, the mapper that turns it into an entity, the fields that type cannot be
 * created without, and any preparation only that type needs.
 *
 * <p>One registry, so an advertised type is always a dispatchable one. This replaced eight
 * near-identical create tools that had drifted apart in exactly that way - {@code extension} was
 * accepted by three of them and silently ignored by the rest.
 *
 * <p>{@code testCase} is deliberately absent. It identifies its target by entity link rather than
 * by name and must authorize before {@code prepare} (which persists a test suite as the ingestion
 * bot), so it keeps its own tool rather than bending this pipeline.
 */
public final class CreatableEntityRegistry {

  /**
   * @param entityType the {@link Entity} constant this type is stored under
   * @param requestClass the generated request POJO the caller's fields bind to
   * @param mapper turns that request into the entity to persist
   * @param required fields beyond {@code name} this type cannot be created without, carrying over
   *     what each replaced tool declared in its own schema
   * @param preparer type-specific derivation and existence checks, run just before mapping
   */
  public record CreatableType<E extends EntityInterface, C extends CreateEntity>(
      String entityType,
      Class<C> requestClass,
      EntityMapper<E, C> mapper,
      List<String> required,
      Consumer<C> preparer) {

    /**
     * The one unchecked cast in the generic create path. It holds because {@link #TYPES} pairs each
     * request class with the mapper and preparer declared over that same class, and the only
     * requests reaching here are instances {@link #requestClass} itself produced.
     */
    @SuppressWarnings("unchecked")
    public EntityInterface toEntity(CreateEntity request, String updatedBy) {
      C typed = (C) request;
      preparer.accept(typed);
      return mapper.createToEntity(typed, updatedBy);
    }
  }

  private static final String DESCRIPTION = "description";

  private static final Map<String, CreatableType<?, ?>> TYPES = buildTypes();

  private CreatableEntityRegistry() {}

  private static Map<String, CreatableType<?, ?>> buildTypes() {
    Map<String, CreatableType<?, ?>> types = new LinkedHashMap<>();
    put(
        types,
        Entity.GLOSSARY,
        CreateGlossary.class,
        new GlossaryMapper(),
        List.of(DESCRIPTION),
        noPreparation());
    put(
        types,
        Entity.GLOSSARY_TERM,
        CreateGlossaryTerm.class,
        new GlossaryTermMapper(),
        List.of(DESCRIPTION, "glossary"),
        noPreparation());
    put(
        types,
        Entity.CLASSIFICATION,
        CreateClassification.class,
        new ClassificationMapper(),
        List.of(DESCRIPTION),
        CreatePreparers::classification);
    put(
        types,
        Entity.TAG,
        CreateTag.class,
        new TagMapper(),
        List.of(DESCRIPTION),
        CreatePreparers::tag);
    put(
        types,
        Entity.DOMAIN,
        CreateDomain.class,
        new DomainMapper(),
        List.of(DESCRIPTION),
        CreatePreparers::domain);
    put(
        types,
        Entity.DATA_PRODUCT,
        CreateDataProduct.class,
        new DataProductMapper(),
        List.of(DESCRIPTION, "domains"),
        CreatePreparers::dataProduct);
    put(
        types,
        Entity.METRIC,
        CreateMetric.class,
        new MetricMapper(),
        List.of("metricExpression"),
        noPreparation());
    put(
        types,
        Entity.CONTEXT_MEMORY,
        CreateContextMemory.class,
        new ContextMemoryMapper(),
        List.of("question", "answer"),
        noPreparation());
    return Map.copyOf(types);
  }

  private static <C extends CreateEntity> Consumer<C> noPreparation() {
    return request -> {};
  }

  private static <E extends EntityInterface, C extends CreateEntity> void put(
      Map<String, CreatableType<?, ?>> types,
      String entityType,
      Class<C> requestClass,
      EntityMapper<E, C> mapper,
      List<String> required,
      Consumer<C> preparer) {
    types.put(
        entityType, new CreatableType<>(entityType, requestClass, mapper, required, preparer));
  }

  /** The advertised types, in the order {@code tools.json} lists them. */
  public static Set<String> names() {
    return TYPES.keySet();
  }

  /**
   * The registration for {@code entityType}, or a failure naming every type that would have
   * worked. A caller that guessed the wrong name can fix it from the error without a lookup call.
   */
  public static CreatableType<?, ?> require(String entityType) {
    CreatableType<?, ?> type = TYPES.get(entityType);
    if (type == null) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter 'entityType': '%s' cannot be created. Valid types: %s."
                  + " To create a test case use create_test_case, and for lineage use"
                  + " create_lineage.",
              entityType, names()));
    }
    return type;
  }
}
