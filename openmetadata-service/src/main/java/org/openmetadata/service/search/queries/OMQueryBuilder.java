package org.openmetadata.service.search.queries;

import java.util.List;

public interface OMQueryBuilder {

  OMQueryBuilder must(List<OMQueryBuilder> queries); // Add multiple "must" conditions (AND)

  OMQueryBuilder must(OMQueryBuilder query); // Add a single "must" condition

  OMQueryBuilder should(List<OMQueryBuilder> queries); // Add multiple "should" conditions (OR)

  OMQueryBuilder should(OMQueryBuilder query); // Add a single "should" condition

  OMQueryBuilder mustNot(OMQueryBuilder query); // Add a single "mustNot" condition (NOT)

  OMQueryBuilder termQuery(
      String field, String value); // Create a term query for a specific field and value

  OMQueryBuilder existsQuery(String field); // Create an exists query for a specific field

  OMQueryBuilder minimumShouldMatch(int count); // Set minimum should match for OR conditions

  Object build(); // Returns the final query object for execution

  boolean isEmpty(); // Check if the query has no conditions

  OMQueryBuilder innerQuery(OMQueryBuilder subQuery);
}
