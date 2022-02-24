package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@RequiredArgsConstructor
public class MessagingServicePage {
  @Nonnull WebDriver webDriver;

  By messagingServiceBrokerUrl = By.cssSelector("[data-testid='broker-url']");
  By messagingServiceSchemaRegistry = By.cssSelector("[data-testid='schema-registry']");

  public By messagingServiceBrokerUrl() {
    return messagingServiceBrokerUrl;
  }

  public By messagingServiceSchemaRegistry() {
    return messagingServiceSchemaRegistry;
  }
}
