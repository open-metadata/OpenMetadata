package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.List;
import java.util.function.Function;
import java.util.stream.IntStream;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.ContainerServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.fluent.Containers;
import org.openmetadata.sdk.fluent.DashboardDataModels;
import org.openmetadata.sdk.fluent.Pipelines;
import org.openmetadata.sdk.fluent.Topics;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Temporarily decorates the application's SQL logger")
@ExtendWith(TestNamespaceExtension.class)
class BulkTagReadIT {

  private static final URI ENDPOINT_URL = URI.create("https://localhost:8585/api/v1/test");

  @ParameterizedTest
  @SuppressWarnings("unchecked")
  @ValueSource(
      strings = {
        Entity.TOPIC,
        Entity.PIPELINE,
        Entity.CONTAINER,
        Entity.SEARCH_INDEX,
        Entity.DASHBOARD_DATA_MODEL,
        Entity.API_ENDPOINT
      })
  void entityTagsAndDerivedTagsEachUseOneQuery(final String type, final TestNamespace ns) {
    SdkClients.adminClient();
    final List<EntityInterface> entities = fixtures(type, ns);
    final var glossary = GlossaryTestFactory.createSimple(ns);
    final var term = GlossaryTermTestFactory.createSimple(ns, glossary);
    final TagLabel classification =
        label(
            SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN(),
            TagLabel.TagSource.CLASSIFICATION);
    Entity.getCollectionDAO()
        .tagUsageDAO()
        .applyTagsBatch(List.of(classification), term.getFullyQualifiedName());
    final TagLabel applied = label(term.getFullyQualifiedName(), TagLabel.TagSource.GLOSSARY);
    entities.forEach(
        entity ->
            Entity.getCollectionDAO()
                .tagUsageDAO()
                .applyTagsBatch(List.of(applied), entity.getFullyQualifiedName()));
    final EntityPolicy<EntityInterface> repository =
        (EntityPolicy<EntityInterface>) Entity.getEntityRepository(type);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from tag_usage")) {
      repository.setFieldsInBulk(repository.fieldPolicy().parse(Entity.FIELD_TAGS), entities);
      assertEquals(2, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
    for (final EntityInterface entity : entities) {
      assertEquals(2, entity.getTags().size());
      assertEquals(
          TagLabel.LabelType.DERIVED,
          entity.getTags().stream()
              .filter(tag -> tag.getTagFQN().equals(classification.getTagFQN()))
              .findFirst()
              .orElseThrow()
              .getLabelType());
      assertEquals(
          TagLabel.LabelType.MANUAL,
          entity.getTags().stream()
              .filter(tag -> tag.getTagFQN().equals(applied.getTagFQN()))
              .findFirst()
              .orElseThrow()
              .getLabelType());
    }
  }

  private List<EntityInterface> fixtures(final String type, final TestNamespace ns) {
    final Function<String, ? extends EntityInterface> create =
        switch (type) {
          case Entity.TOPIC -> topics(ns);
          case Entity.PIPELINE -> pipelines(ns);
          case Entity.CONTAINER -> containers(ns);
          case Entity.SEARCH_INDEX -> indexes(ns);
          case Entity.DASHBOARD_DATA_MODEL -> models(ns);
          case Entity.API_ENDPOINT -> endpoints(ns);
          default -> throw new IllegalArgumentException(type);
        };
    return IntStream.range(0, 3)
        .mapToObj(index -> (EntityInterface) create.apply(ns.prefix("entity_" + index)))
        .toList();
  }

  private Function<String, ? extends EntityInterface> topics(final TestNamespace ns) {
    final String service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    return name -> Topics.create().name(name).in(service).withPartitions(3).execute();
  }

  private Function<String, ? extends EntityInterface> pipelines(final TestNamespace ns) {
    final String service = PipelineServiceTestFactory.createAirflow(ns).getFullyQualifiedName();
    return name -> Pipelines.create().name(name).in(service).execute();
  }

  private Function<String, ? extends EntityInterface> containers(final TestNamespace ns) {
    final String service = ContainerServiceTestFactory.createS3(ns).getFullyQualifiedName();
    return name -> Containers.create().name(name).in(service).execute();
  }

  private Function<String, ? extends EntityInterface> indexes(final TestNamespace ns) {
    final String service = SearchServiceTestFactory.createElasticSearch(ns).getFullyQualifiedName();
    return name ->
        SdkClients.adminClient()
            .searchIndexes()
            .create(
                new CreateSearchIndex()
                    .withName(name)
                    .withService(service)
                    .withFields(
                        List.of(
                            new SearchIndexField()
                                .withName("id")
                                .withDataType(SearchIndexDataType.TEXT))));
  }

  private Function<String, ? extends EntityInterface> models(final TestNamespace ns) {
    final String service = DashboardServiceTestFactory.createMetabase(ns).getFullyQualifiedName();
    return name ->
        DashboardDataModels.create()
            .name(name)
            .in(service)
            .withDataModelType(DataModelType.MetabaseDataModel)
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .execute();
  }

  private Function<String, ? extends EntityInterface> endpoints(final TestNamespace ns) {
    final String service = APIServiceTestFactory.createRest(ns).getFullyQualifiedName();
    final var collection =
        SdkClients.adminClient()
            .apiCollections()
            .create(
                new CreateAPICollection()
                    .withName(ns.prefix("collection"))
                    .withService(service)
                    .withEndpointURL(ENDPOINT_URL));
    return name ->
        SdkClients.adminClient()
            .apiEndpoints()
            .create(
                new CreateAPIEndpoint()
                    .withName(name)
                    .withApiCollection(collection.getFullyQualifiedName())
                    .withEndpointURL(ENDPOINT_URL)
                    .withRequestMethod(APIRequestMethod.GET));
  }

  private TagLabel label(final String fqn, final TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
