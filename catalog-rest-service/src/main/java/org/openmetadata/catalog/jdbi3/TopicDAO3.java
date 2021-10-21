package org.openmetadata.catalog.jdbi3;


import org.openmetadata.catalog.entity.data.Topic;

public interface TopicDAO3 extends EntityDAO<Topic> {
  @Override
  default String getTableName() { return "topic_entity"; }

  @Override
  default Class<Topic> getEntityClass() { return Topic.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
