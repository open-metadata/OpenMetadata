package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import static org.openmetadata.service.search.elasticsearch.ElasticSearchClient.xContentRegistry;

import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.search.aggregations.Aggregation;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.bucket.filter.ParsedFilter;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import es.org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import es.org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import es.org.elasticsearch.search.aggregations.bucket.histogram.LongBounds;
import es.org.elasticsearch.search.aggregations.bucket.histogram.ParsedDateHistogram;
import es.org.elasticsearch.search.aggregations.bucket.terms.ParsedTerms;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import es.org.elasticsearch.search.aggregations.metrics.ParsedSingleValueNumericMetricsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.ParsedValueCount;
import es.org.elasticsearch.search.aggregations.support.ValuesSourceAggregationBuilder;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.xcontent.XContentParser;
import es.org.elasticsearch.xcontent.XContentType;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.api.dataInsightNew.CreateDIChart;
import org.openmetadata.schema.dataInsightNew.DIChart;
import org.openmetadata.schema.dataInsightNew.DIChartResult;
import org.openmetadata.schema.dataInsightNew.DIChartResultList;
import org.openmetadata.schema.dataInsightNew.FormulaHolder;
import org.openmetadata.service.jdbi3.DIChartRepository;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.springframework.expression.Expression;

public class ElasticSearchDynamicChartAggregator {
  private ValuesSourceAggregationBuilder getSubAggregationsByFunction(
      CreateDIChart.Function function, String field, int index) {
    switch (function) {
      case COUNT:
        return AggregationBuilders.count(field + index).field(field);
      case SUM:
        return AggregationBuilders.sum(field + index).field(field);
      case AVG:
        return AggregationBuilders.avg(field + index).field(field);
      case MIN:
        return AggregationBuilders.min(field + index).field(field);
      case MAX:
        return AggregationBuilders.max(field + index).field(field);
    }
    return null;
  }

  public void getDateHistogramByFormula(
      @NotNull DIChart diChart,
      DateHistogramAggregationBuilder dateHistogramAggregationBuilder,
      List<FormulaHolder> formulas) {
    Pattern pattern = Pattern.compile(DIChartRepository.FORMULA_FUNC_REGEX);
    Matcher matcher = pattern.matcher(diChart.getFormula());
    int index = 0;
    while (matcher.find()) {
      FormulaHolder holder = new FormulaHolder();
      holder.setFormula(matcher.group());
      holder.setFunction(CreateDIChart.Function.valueOf(matcher.group(1).toUpperCase()));
      holder.setField(matcher.group(2));
      ValuesSourceAggregationBuilder subAgg =
          getSubAggregationsByFunction(
              CreateDIChart.Function.valueOf(matcher.group(1).toUpperCase()),
              matcher.group(2),
              index);
      if (matcher.group(4) != null) {
        QueryBuilder queryBuilder = QueryBuilders.queryStringQuery(matcher.group(4));
        dateHistogramAggregationBuilder.subAggregation(
            AggregationBuilders.filter("filer" + index, queryBuilder).subAggregation(subAgg));
        holder.setQuery(matcher.group(4));
      } else {
        dateHistogramAggregationBuilder.subAggregation(subAgg);
      }
      formulas.add(holder);
      index++;
    }
  }

  private List<DIChartResult> processMultiAggregations(
      List<Aggregation> aggregations, DIChart diChart, String group, List<FormulaHolder> holder) {
    List<DIChartResult> finalList = new ArrayList<>();

    List<List<DIChartResult>> results = processAggregationsInternal(aggregations, group);
    String formula = diChart.getFormula();
    for (List<DIChartResult> result : results) {
      String formulaCopy = new String(formula);
      if (holder.size() != result.size()) {
        continue;
      }
      boolean evaluate = true;
      String day = null;
      for (int i = 0; i < holder.size(); i++) {
        if (result.get(i).getCount() == null) {
          evaluate = false;
          break;
        }
        day = result.get(i).getDay();
        formulaCopy =
            formulaCopy.replace(holder.get(i).getFormula(), result.get(i).getCount().toString());
      }
      if (evaluate
          && formulaCopy.matches(DIChartRepository.NUMERIC_VALIDATION_REGEX)
          && day != null) {
        Expression expression = CompiledRule.parseExpression(formulaCopy);
        Double value = (Double) expression.getValue();
        if (value.isNaN() || value.isInfinite()) {
          value = null;
        }
        finalList.add(new DIChartResult().withCount(value).withGroup(group).withDay(day));
      }
    }
    return finalList;
  }

  private void populateDateHistogram(
      @NotNull DIChart diChart,
      DateHistogramAggregationBuilder dateHistogramAggregationBuilder,
      List<FormulaHolder> formulas)
      throws IOException {
    if (diChart.getFormula() != null) {
      getDateHistogramByFormula(diChart, dateHistogramAggregationBuilder, formulas);
      return;
    }

    // process non formula date histogram
    ValuesSourceAggregationBuilder subAgg =
        getSubAggregationsByFunction(diChart.getFunction(), diChart.getField(), 0);
    if (diChart.getFilter() != null) {
      XContentParser filterParser =
          XContentType.JSON
              .xContent()
              .createParser(
                  xContentRegistry, LoggingDeprecationHandler.INSTANCE, diChart.getFilter());
      QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
      dateHistogramAggregationBuilder.subAggregation(
          AggregationBuilders.filter("filer", filter).subAggregation(subAgg));
    }
    dateHistogramAggregationBuilder.subAggregation(subAgg);
  }

  public SearchRequest prepareSearchRequest(
      @NotNull DIChart diChart, long start, long end, List<FormulaHolder> formulas)
      throws IOException {
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram("1")
            .field(DIChartRepository.TIMESTAMP_FIELD)
            .calendarInterval(DateHistogramInterval.DAY)
            .extendedBounds(new LongBounds(start, end));
    populateDateHistogram(diChart, dateHistogramAggregationBuilder, formulas);

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();

    if (diChart.getGroupBy() != null) {
      TermsAggregationBuilder termsAggregationBuilder =
          AggregationBuilders.terms("0").field(diChart.getGroupBy());
      termsAggregationBuilder.subAggregation(dateHistogramAggregationBuilder);
      searchSourceBuilder.size(0);
      searchSourceBuilder.aggregation(termsAggregationBuilder);
    } else {
      searchSourceBuilder.aggregation(dateHistogramAggregationBuilder);
    }
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(DIChartRepository.DI_SEARCH_INDEX);
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  public DIChartResultList processSearchResponse(
      @NotNull DIChart diChart, SearchResponse searchResponse, List<FormulaHolder> formulas) {
    DIChartResultList resultList = new DIChartResultList();
    if (diChart.getGroupBy() != null) {
      List<DIChartResult> diChartResults = new ArrayList<>();
      for (Aggregation arg : searchResponse.getAggregations().asList()) {
        ParsedTerms parsedTerms = (ParsedTerms) arg;
        for (Terms.Bucket bucket : parsedTerms.getBuckets()) {
          diChartResults.addAll(
              processAggregations(
                  bucket.getAggregations().asList(), diChart, bucket.getKeyAsString(), formulas));
        }
      }
      resultList.setResults(diChartResults);
      return resultList;
    }
    List<DIChartResult> results =
        processAggregations(searchResponse.getAggregations().asList(), diChart, null, formulas);
    resultList.setResults(results);
    return resultList;
  }

  private List<DIChartResult> processAggregations(
      List<Aggregation> aggregations, DIChart diChart, String group, List<FormulaHolder> holder) {
    if (diChart.getFormula() != null) {
      return processMultiAggregations(aggregations, diChart, group, holder);
    }
    return processSingleAggregations(aggregations, group);
  }

  private List<DIChartResult> processSingleAggregations(
      List<Aggregation> aggregations, String group) {
    List<List<DIChartResult>> rawResultList = processAggregationsInternal(aggregations, group);
    List<DIChartResult> finalResult = new ArrayList<>();
    for (List<DIChartResult> diResultList : rawResultList) {
      diResultList.forEach((result) -> finalResult.add(result));
    }
    return finalResult;
  }

  private List<List<DIChartResult>> processAggregationsInternal(
      List<Aggregation> aggregations, String group) {
    List<List<DIChartResult>> results = new ArrayList<>();
    for (Aggregation arg : aggregations) {
      ParsedDateHistogram parsedDateHistogram = (ParsedDateHistogram) arg;
      for (Histogram.Bucket bucket : parsedDateHistogram.getBuckets()) {
        List<DIChartResult> subResults = new ArrayList<>();
        for (Aggregation subAggr : bucket.getAggregations().asList()) {
          addByAggregationType(subAggr, subResults, bucket.getKeyAsString(), group);
        }
        results.add(subResults);
      }
    }
    return results;
  }

  private void addByAggregationType(
      Aggregation subAggr, List<DIChartResult> diChartResults, String day, String group) {
    if (subAggr instanceof ParsedValueCount)
      addProcessedSubResult((ParsedValueCount) subAggr, diChartResults, day, group);
    else if (subAggr instanceof ParsedSingleValueNumericMetricsAggregation)
      addProcessedSubResult(
          (ParsedSingleValueNumericMetricsAggregation) subAggr, diChartResults, day, group);
    else if (subAggr instanceof ParsedFilter)
      addProcessedSubResult((ParsedFilter) subAggr, diChartResults, day, group);
  }

  private void addProcessedSubResult(
      ParsedValueCount aggregation, List<DIChartResult> diChartResults, String day, String group) {
    ParsedValueCount parsedValueCount = aggregation;
    DIChartResult diChartResult =
        new DIChartResult()
            .withCount((double) parsedValueCount.getValue())
            .withDay(day)
            .withGroup(group);
    diChartResults.add(diChartResult);
  }

  private void addProcessedSubResult(
      ParsedSingleValueNumericMetricsAggregation aggregation,
      List<DIChartResult> diChartResults,
      String day,
      String group) {
    ParsedSingleValueNumericMetricsAggregation parsedValueCount = aggregation;
    Double value = parsedValueCount.value();
    if (Double.isInfinite(value) || Double.isNaN(value)) {
      value = null;
    }
    DIChartResult diChartResult =
        new DIChartResult().withCount(value).withDay(day).withGroup(group);
    diChartResults.add(diChartResult);
  }

  private void addProcessedSubResult(
      ParsedFilter aggregation, List<DIChartResult> diChartResults, String day, String group) {
    ParsedFilter parsedValueCount = aggregation;
    for (Aggregation agg : parsedValueCount.getAggregations().asList()) {
      addByAggregationType(agg, diChartResults, day, group);
    }
  }
}
