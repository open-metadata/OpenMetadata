package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.jdbi3.TagRepository.TagLabelMapper;
import org.openmetadata.catalog.type.TagLabel;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.customizers.RegisterMapper;

import java.util.List;

/**
 * Tag categories are stored as JSON in {@code tag_category} table. All the attributes are stored as JSON
 * document except href, usageCount and children tags which are constructed on the fly as needed.
 *
 * Tags are stored as JSON in {@code tag} table. All the attributes of tags are stored as JSON document except
 * href, usageCount and children tags which are constructed on the fly as needed.
 */
@RegisterMapper(TagLabelMapper.class)
public interface TagDAO {
  @SqlUpdate("INSERT INTO tag_category (json) VALUES (:json)")
  void insertCategory(@Bind("json") String json);

  @SqlUpdate("INSERT INTO tag(json) VALUES (:json)")
  void insertTag(@Bind("json") String json);

  @SqlUpdate("UPDATE tag_category SET  json = :json where name = :name")
  void updateCategory(@Bind("name") String name, @Bind("json") String json);

  @SqlUpdate("UPDATE tag SET  json = :json where fullyQualifiedName = :fqn")
  void updateTag(@Bind("fqn") String fqn, @Bind("json") String json);

  @SqlQuery("SELECT json FROM tag_category ORDER BY name")
  List<String> listCategories();

  @SqlQuery("SELECT json FROM tag WHERE fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') ORDER BY fullyQualifiedName")
  List<String> listChildrenTags(@Bind("fqnPrefix") String fqnPrefix);

  @SqlQuery("SELECT json FROM tag_category WHERE name = :name")
  String findCategory(@Bind("name") String name);

  @SqlQuery("SELECT EXISTS (SELECT * FROM tag WHERE fullyQualifiedName = :fqn)")
  boolean tagExists(@Bind("fqn") String fqn);

  @SqlQuery("SELECT json FROM tag WHERE fullyQualifiedName = :fqn")
  String findTag(@Bind("fqn") String fqn);

  @SqlUpdate("INSERT IGNORE INTO tag_usage (tagFQN, targetFQN, labelType, state) VALUES (:tagFQN, :targetFQN, " +
          ":labelType, :state)")
  void applyTag(@Bind("tagFQN") String tagFQN, @Bind("targetFQN") String targetFQN,
                @Bind("labelType") int labelType, @Bind("state") int state);

  @SqlQuery("SELECT tagFQN, labelType, state FROM tag_usage WHERE targetFQN = :targetFQN ORDER BY tagFQN")
  List<TagLabel> getTags(@Bind("targetFQN") String targetFQN);

  @SqlQuery("SELECT COUNT(*) FROM tag_usage WHERE tagFQN LIKE CONCAT(:fqnPrefix, '%')")
  int getTagCount(@Bind("fqnPrefix") String fqnPrefix);

  @SqlUpdate("DELETE FROM tag_usage where targetFQN = :targetFQN")
  void deleteTags(@Bind("targetFQN") String targetFQN);

  @SqlUpdate("DELETE FROM tag_usage where targetFQN LIKE CONCAT(:fqnPrefix, '%')")
  void deleteTagsByPrefix(@Bind("fqnPrefix") String fqnPrefix);
}
