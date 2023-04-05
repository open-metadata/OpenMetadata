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
import org.openmetadata.service.Entity;

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
      default:
        LOG.warn("Ignoring Entity Type {}", entityType);
    }
    return null;
  }
}
