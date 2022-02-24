package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@RequiredArgsConstructor
public class PipelineServicePage {
  @Nonnull WebDriver webDriver;

  By pipelineServiceUrl = By.cssSelector("[data-testid='pipeline-url']");

  public By pipelineServiceUrl() {
    return pipelineServiceUrl;
  }
}
