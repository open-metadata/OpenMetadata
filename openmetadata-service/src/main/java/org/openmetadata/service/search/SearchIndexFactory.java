package org.openmetadata.service.search;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.ContainerIndex;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DatabaseIndex;
import org.openmetadata.service.search.indexes.DatabaseSchemaIndex;
import org.openmetadata.service.search.indexes.ElasticSearchIndex;
import org.openmetadata.service.search.indexes.GlossaryTermIndex;
import org.openmetadata.service.search.indexes.MlModelIndex;
import org.openmetadata.service.search.indexes.PipelineIndex;
import org.openmetadata.service.search.indexes.QueryIndex;
import org.openmetadata.service.search.indexes.TableIndex;
import org.openmetadata.service.search.indexes.TagIndex;
import org.openmetadata.service.search.indexes.TeamIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TopicIndex;
import org.openmetadata.service.search.indexes.UserIndex;

@Slf4j
public class SearchIndexFactory {
  private SearchIndexFactory() {}

  public static ElasticSearchIndex buildIndex(String entityType, Object entity) {
    switch (entityType) {
      case Entity.TABLE:
        return new TableIndex((Table) entity);
      case Entity.DASHBOARD:
        return new DashboardIndex((Dashboard) entity);
      case Entity.TOPIC:
        return new TopicIndex((Topic) entity);
      case Entity.PIPELINE:
        return new PipelineIndex((Pipeline) entity);
      case Entity.USER:
        return new UserIndex((User) entity);
      case Entity.TEAM:
        return new TeamIndex((Team) entity);
      case Entity.GLOSSARY_TERM:
        return new GlossaryTermIndex((GlossaryTerm) entity);
      case Entity.MLMODEL:
        return new MlModelIndex((MlModel) entity);
      case Entity.TAG:
        return new TagIndex((Tag) entity);
      case Entity.QUERY:
        return new QueryIndex((Query) entity);
      case Entity.CONTAINER:
        return new ContainerIndex((Container) entity);
      case Entity.DATABASE:
        return new DatabaseIndex((Database) entity);
      case Entity.DATABASE_SCHEMA:
        return new DatabaseSchemaIndex((DatabaseSchema) entity);
      case Entity.TEST_CASE:
      case Entity.TEST_SUITE:
        return new TestCaseIndex((TestCase) entity);
      default:
        LOG.warn("Ignoring Entity Type {}", entityType);
    }
    throw new IllegalArgumentException(String.format("Entity Type [%s] is not valid for Index Factory", entityType));
  }
}
