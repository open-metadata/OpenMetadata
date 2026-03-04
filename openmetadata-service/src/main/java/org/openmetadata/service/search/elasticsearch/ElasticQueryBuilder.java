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
                  if (fuzziness != null && !fuzziness.equals("0")) {
                    m.fuzziness(fuzziness);
                    m.prefixLength(1); // Require first character to match exactly
                    m.maxExpansions(10); // Limit fuzzy expansions
                    // When using fuzziness with OR operator, require minimum token match
                    // to avoid overly permissive matching (e.g., "2<70%" means 2 tokens or 70% must
                    // match)
                    if (operator == Operator.Or) {
                      m.minimumShouldMatch("2<70%");
                    }
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
                r ->
                    r.untyped(
                        u -> {
                          u.field(field);
                          if (gte != null) {
                            u.gte(es.co.elastic.clients.json.JsonData.of(gte));
                          }
                          if (lte != null) {
                            u.lte(es.co.elastic.clients.json.JsonData.of(lte));
                          }
                          if (gt != null) {
                            u.gt(es.co.elastic.clients.json.JsonData.of(gt));
                          }
                          if (lt != null) {
                            u.lt(es.co.elastic.clients.json.JsonData.of(lt));
                          }
                          return u;
                        })));
  }

  public static Query existsQuery(String field) {
    return Query.of(q -> q.exists(e -> e.field(field)));
  }

  public static Query nestedQuery(String path, Query query) {
    return Query.of(q -> q.nested(n -> n.path(path).query(query)));
  }

  public static Query functionScoreQuery(
      Query query,
      java.util.List<es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScore> functions,
      es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScoreMode scoreMode,
      es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionBoostMode boostMode,
      Float boost) {
    return Query.of(
        q ->
            q.functionScore(
                fs -> {
                  fs.query(query);
                  if (!functions.isEmpty()) {
                    fs.functions(functions);
                  }
                  if (scoreMode != null) {
                    fs.scoreMode(scoreMode);
                  }
                  if (boostMode != null) {
                    fs.boostMode(boostMode);
                  }
                  if (boost != null) {
                    fs.boost(boost);
                  }
                  return fs;
                }));
  }

  public static es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScore weightFunction(
      Query filter, double weight) {
    return es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScore.of(
        f -> f.filter(filter).weight(weight));
  }

  public static es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScore
      fieldValueFactorFunction(
          Query filter,
          String field,
          Double factor,
          Double missing,
          es.co.elastic.clients.elasticsearch._types.query_dsl.FieldValueFactorModifier modifier) {
    return es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScore.of(
        f -> {
          f.filter(filter);
          f.fieldValueFactor(
              fvf -> {
                fvf.field(field);
                if (factor != null) {
                  fvf.factor(factor);
                }
                if (missing != null) {
                  fvf.missing(missing);
                }
                if (modifier != null) {
                  fvf.modifier(modifier);
                }
                return fvf;
              });
          return f;
        });
  }
}
