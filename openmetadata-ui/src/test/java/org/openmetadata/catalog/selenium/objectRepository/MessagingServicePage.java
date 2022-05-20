package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class MessagingServicePage {
  @Nonnull WebDriver webDriver;

  By messagingServiceBootstrapServers = By.cssSelector("[id='root_bootstrapServers']");
  By messagingServiceSchemaRegistry = By.cssSelector("[id='root_schemaRegistryURL']");
  By deleteMessagingService = By.cssSelector("[data-testid='delete-button']");
  By confirmationDeleteText = By.cssSelector("[data-testid='confirmation-text-input']");
  By deleteIngestion = By.cssSelector("[data-testid='delete']");
}
