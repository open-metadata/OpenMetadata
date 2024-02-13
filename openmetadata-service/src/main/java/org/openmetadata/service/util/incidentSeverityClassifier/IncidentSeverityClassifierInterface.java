package org.openmetadata.service.util.incidentSeverityClassifier;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.dataQuality.DataQualityConfiguration;
import org.openmetadata.schema.tests.type.Severity;

@Slf4j
public abstract class IncidentSeverityClassifierInterface {
  protected static IncidentSeverityClassifierInterface instance;

  public static IncidentSeverityClassifierInterface getInstance() {
    if (instance == null) {
      LOG.info(
          "Incident severity classifier instance is null. Default to LogisticRegressionClassifier");
      instance = new LogisticRegressionIncidentSeverityClassifier();
    }
    return instance;
  }

  public static void createInstance(DataQualityConfiguration dataQualityConfiguration) {
    instance = getClassifierClass(dataQualityConfiguration.getSeverityIncidentClassifier());
  }

  private static IncidentSeverityClassifierInterface getClassifierClass(
      String severityClassifierClassString) {
    IncidentSeverityClassifierInterface incidentSeverityClassifier;
    try {
      Class severityClassifierClass = Class.forName(severityClassifierClassString);
      Constructor severityClassifierConstructor = severityClassifierClass.getConstructor();
      incidentSeverityClassifier =
          (IncidentSeverityClassifierInterface) severityClassifierConstructor.newInstance();
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | IllegalAccessException
        | InstantiationException
        | InvocationTargetException e) {
      LOG.error(
          "Error occurred while initializing the incident severity classifier. Default to LogisticRegressionClassifier",
          e);
      // If we encounter an error while initializing the incident severity classifier, we default to
      // the logistic regression classifier
      incidentSeverityClassifier = new LogisticRegressionIncidentSeverityClassifier();
    }
    return incidentSeverityClassifier;
  }

  public abstract Severity classifyIncidentSeverity(EntityInterface entity);
}
