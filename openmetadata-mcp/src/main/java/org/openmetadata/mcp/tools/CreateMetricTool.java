package org.openmetadata.mcp.tools;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricGranularity;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.metrics.MetricMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class CreateMetricTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateMetricTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    Object nameRaw = params.get("name");
    if (!(nameRaw instanceof String name) || name.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'name' is required and must be a non-blank string. Received: " + nameRaw);
    }

    CreateMetric createMetric = new CreateMetric();
    createMetric.setName(name);

    if (params.containsKey("description")) {
      createMetric.setDescription((String) params.get("description"));
    }
    if (params.containsKey("displayName")) {
      createMetric.setDisplayName((String) params.get("displayName"));
    }

    String lang = (String) params.get("metricExpressionLanguage");
    String code = (String) params.get("metricExpressionCode");
    if (lang == null || lang.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'metricExpressionLanguage' is required. Valid values are: SQL, Java, JavaScript, Python, External");
    }
    if (code == null || code.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'metricExpressionCode' is required. Provide the expression that computes this metric (e.g. a SQL query).");
    }
    try {
      createMetric.setMetricExpression(
          new MetricExpression().withLanguage(MetricExpressionLanguage.fromValue(lang)).withCode(code));
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(
          "Parameter 'metricExpressionLanguage' has invalid value '"
              + lang
              + "'. Valid values are: SQL, Java, JavaScript, Python, External");
    }

    if (params.containsKey("metricType")) {
      String rawValue = (String) params.get("metricType");
      try {
        createMetric.setMetricType(MetricType.fromValue(rawValue));
      } catch (IllegalArgumentException e) {
        throw new IllegalArgumentException(
            "Parameter 'metricType' has invalid value '"
                + rawValue
                + "'. Valid values are: COUNT, SUM, AVERAGE, RATIO, PERCENTAGE, MIN, MAX, MEDIAN, MODE, STANDARD_DEVIATION, VARIANCE, OTHER");
      }
    }
    if (params.containsKey("granularity")) {
      String rawValue = (String) params.get("granularity");
      try {
        createMetric.setGranularity(MetricGranularity.fromValue(rawValue));
      } catch (IllegalArgumentException e) {
        throw new IllegalArgumentException(
            "Parameter 'granularity' has invalid value '"
                + rawValue
                + "'. Valid values are: SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, YEAR");
      }
    }
    if (params.containsKey("unitOfMeasurement")) {
      String rawValue = (String) params.get("unitOfMeasurement");
      try {
        createMetric.setUnitOfMeasurement(MetricUnitOfMeasurement.fromValue(rawValue));
      } catch (IllegalArgumentException e) {
        throw new IllegalArgumentException(
            "Parameter 'unitOfMeasurement' has invalid value '"
                + rawValue
                + "'. Valid values are: COUNT, DOLLARS, PERCENTAGE, TIMESTAMP, SIZE, REQUESTS, EVENTS, TRANSACTIONS, OTHER");
      }
    }
    if (params.containsKey("customUnitOfMeasurement")) {
      createMetric.setCustomUnitOfMeasurement((String) params.get("customUnitOfMeasurement"));
    }
    if (params.containsKey("owners")) {
      CommonUtils.setOwners(createMetric, params);
    }
    if (params.containsKey("reviewers")) {
      createMetric.setReviewers(CommonUtils.getTeamsOrUsers(params.get("reviewers")));
    }
    if (params.containsKey("relatedMetrics")) {
      createMetric.setRelatedMetrics(
          JsonUtils.readOrConvertValues(params.get("relatedMetrics"), String.class));
    }
    if (params.containsKey("tags")) {
      List<TagLabel> tags = new ArrayList<>();
      for (String tagFqn : JsonUtils.readOrConvertValues(params.get("tags"), String.class)) {
        tags.add(
            new TagLabel()
                .withTagFQN(tagFqn)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL));
      }
      createMetric.setTags(tags);
    }

    MetricMapper mapper = new MetricMapper();
    Metric metric =
        mapper.createToEntity(createMetric, securityContext.getUserPrincipal().getName());

    OperationContext operationContext =
        new OperationContext(Entity.METRIC, MetadataOperation.CREATE);
    CreateResourceContext<Metric> createResourceContext =
        new CreateResourceContext<>(Entity.METRIC, metric);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);

    MetricRepository repo = (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    repo.prepare(metric, true);
    repo.setFullyQualifiedName(metric);

    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    RestUtil.PutResponse<Metric> response =
        repo.createOrUpdate(
            null, metric, securityContext.getUserPrincipal().getName(), impersonatedBy);
    return JsonUtils.getMap(response.getEntity());
  }
}
