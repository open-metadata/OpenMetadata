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
  By testConnection = By.cssSelector("[data-testid='test-connection-btn']");
  By connectionSuccessfulCheck = By.xpath("//span[@class='tw-ml-2'][text()='Connection test was successful']");
  By dbtDropdown = By.cssSelector("[data-testid='dbt-source']");
  By connectionScheme = By.cssSelector("[id='root_scheme']");

  public By ingestionInterval(String interval) {
    return By.xpath("//select[@id='ingestionType']/option[@value='" + interval + "']");
  }

  public By serviceName(String serviceName) {
    return By.cssSelector("[data-testid='service-name-" + serviceName + "']");
  }
}
