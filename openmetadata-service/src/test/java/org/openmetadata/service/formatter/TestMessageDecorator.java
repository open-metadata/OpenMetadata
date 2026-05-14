package org.openmetadata.service.formatter;

import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

public final class TestMessageDecorator implements MessageDecorator<String> {
  @Override
  public String getBold() {
    return "<b>%s</b>";
  }

  @Override
  public String getBoldWithSpace() {
    return "<b>%s</b> ";
  }

  @Override
  public String getLineBreak() {
    return "\n";
  }

  @Override
  public String getAddMarker() {
    return "<ins>";
  }

  @Override
  public String getAddMarkerClose() {
    return "</ins>";
  }

  @Override
  public String getRemoveMarker() {
    return "<del>";
  }

  @Override
  public String getRemoveMarkerClose() {
    return "</del>";
  }

  @Override
  public String getEntityUrl(String prefix, String fqn, String additionalInput) {
    return prefix + "|" + fqn + "|" + additionalInput;
  }

  @Override
  public String buildEntityMessage(String publisherName, ChangeEvent event) {
    return null;
  }

  @Override
  public String buildThreadMessage(String publisherName, ChangeEvent event) {
    return null;
  }

  @Override
  public String buildTestMessage() {
    return "test";
  }
}
