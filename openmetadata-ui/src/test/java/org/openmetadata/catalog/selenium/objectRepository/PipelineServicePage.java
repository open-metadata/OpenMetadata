package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class PipelineServicePage {
  WebDriver webDriver;

  public PipelineServicePage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By pipelineServiceUrl = By.cssSelector("[data-testid='pipeline-url']");

  public By pipelineServiceUrl() {
    return pipelineServiceUrl;
  }
}
