package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.query_dsl.Operator;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch._types.query_dsl.QueryStringQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ElasticQueryBuilder {

  private ElasticQueryBuilder() {}

  public static Query matchAllQuery() {
    return Query.of(q -> q.matchAll(m -> m));
  }

  public static Query termQuery(String field, String value) {
    return Query.of(q -> q.term(t -> t.field(field).value(value)));
  }

  public static Query termQuery(String field, boolean value) {
    return Query.of(q -> q.term(t -> t.field(field).value(value)));
  }

  public static Query termQuery(String field, int value) {
    return Query.of(q -> q.term(t -> t.field(field).value(value)));
  }

  public static Query matchQuery(String field, String value) {
    return Query.of(q -> q.match(m -> m.field(field).query(value)));
  }

  public static Query matchPhraseQuery(String field, String value) {
    return Query.of(q -> q.matchPhrase(m -> m.field(field).query(value)));
  }

  public static Query wildcardQuery(String field, String value) {
    return Query.of(q -> q.wildcard(w -> w.field(field).value(value)));
  }

  public static Query multiMatchQuery(String query, Map<String, Float> fields) {
    List<String> fieldList = new ArrayList<>();
    fields.forEach(
        (field, boost) -> {
          if (boost != null && boost != 1.0f) {
            fieldList.add(field + "^" + boost);
          } else {
            fieldList.add(field);
          }
        });
    return Query.of(
        q ->
            q.multiMatch(
                m -> {
                  m.query(query);
                  m.fields(fieldList);
                  return m;
                }));
  }

  public static Query multiMatchQuery(
      String query,
      Map<String, Float> fields,
      TextQueryType type,
      Operator operator,
      String tieBreaker,
      String fuzziness) {
    List<String> fieldList = new ArrayList<>();
    fields.forEach(
        (field, boost) -> {
          if (boost != null && boost != 1.0f) {
            fieldList.add(field + "^" + boost);
          } else {
            fieldList.add(field);
          }
        });
    return Query.of(
        q ->
            q.multiMatch(
                m -> {
                  m.query(query);
                  m.fields(fieldList);
                  if (type != null) {
                    m.type(type);
                  }
                  if (operator != null) {
                    m.operator(operator);
                  }
                  if (tieBreaker != null) {
                    m.tieBreaker(Double.parseDouble(tieBreaker));
                  }
                  if (fuzziness != null) {
                    m.fuzziness(fuzziness);
                  }
                  return m;
                }));
  }

  public static Query queryStringQuery(String query) {
    return Query.of(q -> q.queryString(QueryStringQuery.of(qs -> qs.query(query))));
  }

  public static Query queryStringQuery(String query, Map<String, Float> fields) {
    List<String> fieldList = new ArrayList<>();
    fields.forEach(
        (field, boost) -> {
          if (boost != null && boost != 1.0f) {
            fieldList.add(field + "^" + boost);
          } else {
            fieldList.add(field);
          }
        });
    return Query.of(
        q ->
            q.queryString(
                qs -> {
                  qs.query(query);
                  qs.fields(fieldList);
                  return qs;
                }));
  }

  public static Query queryStringQuery(
      String query,
      Map<String, Float> fields,
      Operator operator,
      String fuzziness,
      int fuzzyMaxExpansions,
      int fuzzyPrefixLength,
      double tieBreaker,
      TextQueryType type) {
    List<String> fieldList = new ArrayList<>();
    fields.forEach(
        (field, boost) -> {
          if (boost != null && boost != 1.0f) {
            fieldList.add(field + "^" + boost);
          } else {
            fieldList.add(field);
          }
        });
    return Query.of(
        q ->
            q.queryString(
                qs -> {
                  qs.query(query);
                  qs.fields(fieldList);
                  if (operator != null) {
                    qs.defaultOperator(operator);
                  }
                  if (fuzziness != null) {
                    qs.fuzziness(fuzziness);
                  }
                  if (fuzzyMaxExpansions > 0) {
                    qs.fuzzyMaxExpansions(fuzzyMaxExpansions);
                  }
                  if (fuzzyPrefixLength > 0) {
                    qs.fuzzyPrefixLength(fuzzyPrefixLength);
                  }
                  qs.tieBreaker(tieBreaker);
                  if (type != null) {
                    qs.type(type);
                  }
                  return qs;
                }));
  }

  public static BoolQueryBuilder boolQuery() {
    return new BoolQueryBuilder();
  }

  public static class BoolQueryBuilder {
    private final List<Query> must = new ArrayList<>();
    private final List<Query> should = new ArrayList<>();
    private final List<Query> mustNot = new ArrayList<>();
    private final List<Query> filter = new ArrayList<>();
    private Integer minimumShouldMatch;
    private String minimumShouldMatchString;

    public BoolQueryBuilder must(Query query) {
      this.must.add(query);
      return this;
    }

    public BoolQueryBuilder should(Query query) {
      this.should.add(query);
      return this;
    }

    public BoolQueryBuilder mustNot(Query query) {
      this.mustNot.add(query);
      return this;
    }

    public BoolQueryBuilder filter(Query query) {
      this.filter.add(query);
      return this;
    }

    public BoolQueryBuilder minimumShouldMatch(int minimumShouldMatch) {
      this.minimumShouldMatch = minimumShouldMatch;
      return this;
    }

    public BoolQueryBuilder minimumShouldMatch(String minimumShouldMatch) {
      this.minimumShouldMatchString = minimumShouldMatch;
      return this;
    }

    public Query build() {
      return Query.of(
          q ->
              q.bool(
                  b -> {
                    if (!must.isEmpty()) {
                      b.must(must);
                    }
                    if (!should.isEmpty()) {
                      b.should(should);
                    }
                    if (!mustNot.isEmpty()) {
                      b.mustNot(mustNot);
                    }
                    if (!filter.isEmpty()) {
                      b.filter(filter);
                    }
                    if (minimumShouldMatch != null) {
                      b.minimumShouldMatch(String.valueOf(minimumShouldMatch));
                    } else if (minimumShouldMatchString != null) {
                      b.minimumShouldMatch(minimumShouldMatchString);
                    }
                    return b;
                  }));
    }
  }

  public static Query rangeQuery(String field, String gte, String lte, String gt, String lt) {
    return Query.of(
        q ->
            q.range(
                r -> {
                  r.field(field);
                  if (gte != null) {
                    r.gte(es.co.elastic.clients.json.JsonData.of(gte));
                  }
                  if (lte != null) {
                    r.lte(es.co.elastic.clients.json.JsonData.of(lte));
                  }
                  if (gt != null) {
                    r.gt(es.co.elastic.clients.json.JsonData.of(gt));
                  }
                  if (lt != null) {
                    r.lt(es.co.elastic.clients.json.JsonData.of(lt));
                  }
                  return r;
                }));
  }

  public static Query existsQuery(String field) {
    return Query.of(q -> q.exists(e -> e.field(field)));
  }

  public static Query nestedQuery(String path, Query query) {
    return Query.of(q -> q.nested(n -> n.path(path).query(query)));
  }
}
