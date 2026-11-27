# A categorical Data Insights axis lists only the categories its chart counts

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** pmbrull
- **Guard:** `OpenSearchCategoricalAxisRealEngineTest` and `ElasticSearchCategoricalAxisRealEngineTest` (`theAxisHoldsExactlyTheServicesTheChartCounts`, `aServiceTheChartCountsKeepsItsBucketWhenTheMetricFindsNothingThere`, `aMetricReportsZeroForAServiceOnlyAnotherMetricCounts`, `aGroupedChartListsOnlyTheGroupsItsMetricCounts`, `aBuiltInChartReadForOneServiceListsOnlyThatService`); `OpenSearchLineChartAggregatorTest` and `ElasticSearchLineChartAggregatorTest` (`aFilteredCategoricalChartQueriesOnlyTheDocumentsItCounts`, `metricsThatDisagreeQueryTheDocumentsEitherCounts`, `aMetricWithoutAFilterKeepsTheRequestWide`, `aTimestampAxisIsNeitherRankedNorNarrowed`); `DataInsightMetricFilterTest` (`aMetricThatCountsEveryDocumentLeavesNoPopulation`)
- **Related:** #32115, open-metadata/ai-platform#2269

## Context

A categorical (terms) x-axis bucketed every document in range and applied each metric's `filter`
only inside the bucket. #32115 ranked the axis by that filter, so the categories a chart counts are
picked first. It kept the request wide so that a category the filter empties still reports 0.

When the filter is the chart's scope, those zero rows are categories held only outside the scope.
For example, a "tables per owner" chart listed every owner of a dashboard at 0. On one instance,
28 of its 45 rows were such zeros, and an AI chat answer built on the chart said 45 owners hold
tables when 17 do. These zeros never formed a complete list either:
- they appeared only while fewer than 100 categories held matching documents;
- which ones appeared depended on how the engine broke ties;
- a category that no document of the day holds never appeared at all.

## Decision

For a categorical x-axis, the request queries the chart's population: the documents that at least
one metric's `filter` matches (`DataInsightMetricFilter.populationFilters`). That is one `should`
clause per distinct filter, with `minimum_should_match: 1`, combined with the snapshot range when
the request is not live.

- **A category the chart counts keeps its bucket.** A term's own `q=` never narrows the population,
  so a real 0 stays. With several metrics, a metric reads 0 for a category that only another metric
  counts.
- **A `groupBy` on a categorical chart draws its groups from the same population.**
- **A metric with no filter counts every document**, so the request stays wide. An unreadable filter
  counts as no filter, as before.
- **An `@timestamp` axis stays wide, groups included.** A date histogram has no top N to align, and
  narrowing it would move the first and last days it plots.

## Consequences

- Breakdowns with metric filters stop showing zero bars for categories outside their scope. That
  covers custom charts, AI chat charts and Collate's pinned-chart refresh.
- **Built-in categorical charts are narrowed when read for a scope.** They declare no filter of
  their own, but `DataInsightSystemChartRepository` merges the caller's filter and the navbar domain
  into every metric. So a built-in chart read for one service or domain no longer lists other
  services, tag groups or entity types at 0. That applies to the service page's PII and tier
  distributions, and to the total data assets chart under a domain.
- **A scope that matches no document returns no buckets**, instead of a breakdown of zeros.
- **A filter can carry a condition rather than a scope.** Collate's chart builder in function mode
  puts its advanced filter in `metrics[i].filter`. In that case a category where nothing matches the
  condition gets no bucket. To keep its 0, use formula mode: the scope goes in `filter` and the
  condition in the formula's `q=`.
- A complete list of categories, such as every tier whether held or not, needs an explicit list of
  values. A terms axis cannot provide one.
