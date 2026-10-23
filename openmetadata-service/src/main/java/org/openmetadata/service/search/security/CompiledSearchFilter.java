package org.openmetadata.service.search.security;

import org.openmetadata.service.search.queries.OMQueryBuilder;

/**
 * The search filter a caller's existing access policies compile to, for one kind of document.
 *
 * @param query the clause to AND into a search, as {@link RBACConditionEvaluator#evaluateConditions}
 *     has always returned it
 * @param grantsEverything true when no deny rule restricts anything and the allow rules admit every
 *     document of this kind, so the clause filters nothing
 */
public record CompiledSearchFilter(OMQueryBuilder query, boolean grantsEverything) {}
