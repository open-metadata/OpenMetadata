package org.openmetadata.service.elasticsearch;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
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
import org.openmetadata.service.elasticsearch.indexes.ContainerIndex;
import org.openmetadata.service.elasticsearch.indexes.DashboardIndex;
import org.openmetadata.service.elasticsearch.indexes.ElasticSearchIndex;
import org.openmetadata.service.elasticsearch.indexes.GlossaryTermIndex;
import org.openmetadata.service.elasticsearch.indexes.MlModelIndex;
import org.openmetadata.service.elasticsearch.indexes.PipelineIndex;
import org.openmetadata.service.elasticsearch.indexes.QueryIndex;
import org.openmetadata.service.elasticsearch.indexes.TableIndex;
import org.openmetadata.service.elasticsearch.indexes.TagIndex;
import org.openmetadata.service.elasticsearch.indexes.TeamIndex;
import org.openmetadata.service.elasticsearch.indexes.TopicIndex;
import org.openmetadata.service.elasticsearch.indexes.UserIndex;

@Slf4j
public class ElasticSearchIndexFactory {
  private ElasticSearchIndexFactory() {}

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
      case Entity.TEST_CASE:
      case Entity.TEST_SUITE:
        return new TestCaseIndex((TestCase) entity);
      default:
        LOG.warn("Ignoring Entity Type {}", entityType);
    }
    throw new IllegalArgumentException(String.format("Entity Type [%s] is not valid for Index Factory", entityType));
  }
}
