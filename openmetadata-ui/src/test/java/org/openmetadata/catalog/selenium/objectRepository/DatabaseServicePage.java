package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class DatabaseServicePage {
  @Nonnull WebDriver webDriver;

  By runIngestion = By.cssSelector("[data-testid='run']");
  By editIngestion = By.cssSelector("[data-testid='edit']");
  By deleteIngestion = By.cssSelector("[data-testid='delete']");
  By selectInterval = By.xpath("//select[@id='ingestionType']");
  By confirmationDeleteText = By.cssSelector("[data-testid='confirmation-text-input']");
  By viewService = By.cssSelector("[data-testid='view-service-button']");
  By clickDatabase = By.xpath("//tr[@data-testid='column']/td/a");
  By deleteDatabase = By.cssSelector("[data-testid='delete-button']");
  By databaseTable = By.cssSelector("[data-testid='Databases']");

  public By ingestionInterval(String interval) {
    return By.xpath("//select[@id='ingestionType']/option[@value='" + interval + "']");
  }

  public By serviceName(String serviceName) {
    return By.cssSelector("[data-testid='service-name-" + serviceName + "']");
  }
}
