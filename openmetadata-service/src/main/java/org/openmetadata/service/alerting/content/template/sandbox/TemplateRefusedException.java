package org.openmetadata.service.alerting.content.template.sandbox;

/** A template uses a construct that the template sandbox does not offer. */
public class TemplateRefusedException extends RuntimeException {
  public TemplateRefusedException(String message) {
    super(message);
  }
}
