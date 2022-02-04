package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class MessagingServicePage {
  WebDriver webDriver;

  public MessagingServicePage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By messagingServiceBrokerUrl = By.cssSelector("[data-testid='broker-url']");
  By messagingServiceSchemaRegistry = By.cssSelector("[data-testid='schema-registry']");

  public By messagingServiceBrokerUrl() {
    return messagingServiceBrokerUrl;
  }

  public By messagingServiceSchemaRegistry() {
    return messagingServiceSchemaRegistry;
  }
}
