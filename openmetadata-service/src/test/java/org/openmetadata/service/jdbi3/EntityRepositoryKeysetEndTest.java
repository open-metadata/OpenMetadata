package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil;

/** A keyset read bounded by an end cursor never returns, or continues to, rows after that cursor. */
class EntityRepositoryKeysetEndTest {

  private static final int LIMIT = 3;

  private CollectionDAO.PipelineDAO pipelineDAO;
  private PipelineRepo repo;

  private static class PipelineRepo extends EntityRepository<Pipeline> {
    PipelineRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes r) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() {
    CollectionDAO daoCollection = mock(CollectionDAO.class);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(daoCollection);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    repo = new PipelineRepo(pipelineDAO);
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
  }

  @Test
  void pageStopsAtTheEndWhenTheBoundaryRowIsDeletedDuringTheRead() {
    Pipeline a1 = pipeline("a1");
    Pipeline a2 = pipeline("a2");
    Pipeline end = pipeline("a3");
    Pipeline boundary = pipeline("b");
    Pipeline c1 = pipeline("c1");
    Pipeline c2 = pipeline("c2");
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1), eq("a3"), eq(id(end))))
        .thenReturn(List.of(json(boundary)), List.of(json(c1)));
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(LIMIT + 1), any(), any()))
        .thenReturn(List.of(json(a1), json(a2), json(c1), json(c2)));

    ResultList<Pipeline> page =
        repo.listAfterKeyset(
            new ListFilter(Include.ALL), LIMIT, null, cursor(end), 0, true, new Fields(Set.of()));

    assertEquals(List.of("a1", "a2"), page.getData().stream().map(Pipeline::getName).toList());
    assertNull(page.getPaging().getAfter());
  }

  @Test
  void pageContinuesWhenTheBoundaryRowIsStillAfterIt() {
    Pipeline a1 = pipeline("a1");
    Pipeline a2 = pipeline("a2");
    Pipeline a3 = pipeline("a3");
    Pipeline a4 = pipeline("a4");
    Pipeline end = pipeline("a9");
    Pipeline boundary = pipeline("b");
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1), eq("a9"), eq(id(end))))
        .thenReturn(List.of(json(boundary)));
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(LIMIT + 1), any(), any()))
        .thenReturn(List.of(json(a1), json(a2), json(a3), json(a4)));

    ResultList<Pipeline> page =
        repo.listAfterKeyset(
            new ListFilter(Include.ALL), LIMIT, null, cursor(end), 0, true, new Fields(Set.of()));

    assertEquals(
        List.of("a1", "a2", "a3"), page.getData().stream().map(Pipeline::getName).toList());
    assertEquals(cursor(a3), page.getPaging().getAfter());
  }

  private static Pipeline pipeline(String name) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("service." + name);
  }

  private static String json(Pipeline pipeline) {
    return JsonUtils.pojoToJson(pipeline);
  }

  private static String id(Pipeline pipeline) {
    return pipeline.getId().toString();
  }

  private String cursor(Pipeline pipeline) {
    return RestUtil.encodeCursor(repo.getCursorValue(pipeline));
  }
}
