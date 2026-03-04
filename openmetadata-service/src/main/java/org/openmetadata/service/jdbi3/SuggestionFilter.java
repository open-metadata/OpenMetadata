package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.util.RestUtil.decodeCursor;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import org.openmetadata.schema.type.SuggestionStatus;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.service.util.FullyQualifiedName;

@Getter
@Builder
public class SuggestionFilter {
  private SuggestionType suggestionType;
  private SuggestionStatus suggestionStatus;
  private UUID createdBy;
  private String entityFQN;
  private SuggestionRepository.PaginationType paginationType;
  private String before;
  private String after;
  @Builder.Default private final Map<String, String> queryParams = new HashMap<>();

  public String getCondition(boolean includePagination) {
    StringBuilder condition = new StringBuilder();
    condition.append("WHERE TRUE ");
    if (suggestionType != null) {
      queryParams.put("suggestionType", suggestionType.value());
      condition.append(" AND suggestionType = :suggestionType ");
    }
    if (suggestionStatus != null) {
      queryParams.put("suggestionStatus", suggestionStatus.value());
      condition.append(" AND status = :suggestionStatus ");
    }
    if (entityFQN != null) {
      queryParams.put("fqnHashParam", FullyQualifiedName.buildHash(entityFQN));
      condition.append(" AND fqnHash = :fqnHashParam ");
    }
    if (createdBy != null) {
      queryParams.put("createdByParam", createdBy.toString());
      condition.append(
          " AND id in (select toId from entity_relationship where fromId = :createdByParam) ");
    }
    if (paginationType != null && includePagination) {
      String paginationCondition =
          paginationType == SuggestionRepository.PaginationType.BEFORE
              ? String.format(" AND updatedAt > %s ", Long.parseLong(decodeCursor(before)))
              : String.format(
                  " AND updatedAt < %s ",
                  after != null ? Long.parseLong(decodeCursor(after)) : Long.MAX_VALUE);
      condition.append(paginationCondition);
    }
    return condition.toString();
  }
}
