package org.openmetadata.service.util.incidentSeverityClassifier;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.type.Severity;

@Slf4j
public abstract class IncidentSeverityClassifierInterface {
  protected static IncidentSeverityClassifierInterface instance;

  public static IncidentSeverityClassifierInterface getInstance() {
    if (instance == null) {
      createInstance();
    }
    return instance;
  }

  public static void createInstance() {
    instance = getClassifierClass();
  }

  private static IncidentSeverityClassifierInterface getClassifierClass() {
    return new LogisticRegressionIncidentSeverityClassifier();
  }

  public abstract Severity classifyIncidentSeverity(EntityInterface entity);
}
