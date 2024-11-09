package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.util.RestUtil.decodeCursor;

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

  public String getCondition(boolean includePagination) {
    StringBuilder condition = new StringBuilder();
    condition.append("WHERE TRUE ");
    if (suggestionType != null) {
      condition.append(String.format(" AND suggestionType = '%s' ", suggestionType.value()));
    }
    if (suggestionStatus != null) {
      condition.append(String.format(" AND status = '%s' ", suggestionStatus.value()));
    }
    if (entityFQN != null) {
      condition.append(
          String.format(" AND fqnHash = '%s' ", FullyQualifiedName.buildHash(entityFQN)));
    }
    if (createdBy != null) {
      condition.append(
          String.format(
              " AND id in (select toId from entity_relationship where fromId = '%s') ", createdBy));
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
