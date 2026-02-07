package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.Script;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval;

public class ElasticAggregationBuilder {

  private ElasticAggregationBuilder() {}

  public static Aggregation termsAggregation(String field, int size) {
    return Aggregation.of(a -> a.terms(t -> t.field(field).size(size)));
  }

  public static Aggregation termsAggregationWithScript(String script, int size) {
    return Aggregation.of(
        a ->
            a.terms(
                t ->
                    t.script(
                            Script.of(
                                s ->
                                    s.source(ss -> ss.scriptString(script))
                                        .lang(
                                            es.co.elastic.clients.elasticsearch._types
                                                .ScriptLanguage.Painless)))
                        .size(size)));
  }

  public static Aggregation termsAggregation(String field) {
    return Aggregation.of(a -> a.terms(t -> t.field(field)));
  }

  public static Aggregation cardinalityAggregation(String field) {
    return Aggregation.of(a -> a.cardinality(c -> c.field(field)));
  }

  public static Aggregation dateHistogramAggregation(String field, String interval, String format) {
    return Aggregation.of(
        a ->
            a.dateHistogram(
                d -> {
                  d.field(field).calendarInterval(CalendarInterval._DESERIALIZER.parse(interval));
                  if (format != null) {
                    d.format(format);
                  }
                  return d;
                }));
  }

  public static Aggregation sumAggregation(String field) {
    return Aggregation.of(a -> a.sum(s -> s.field(field)));
  }

  public static Aggregation avgAggregation(String field) {
    return Aggregation.of(a -> a.avg(av -> av.field(field)));
  }

  public static Aggregation maxAggregation(String field) {
    return Aggregation.of(a -> a.max(m -> m.field(field)));
  }

  public static Aggregation minAggregation(String field) {
    return Aggregation.of(a -> a.min(m -> m.field(field)));
  }
}
