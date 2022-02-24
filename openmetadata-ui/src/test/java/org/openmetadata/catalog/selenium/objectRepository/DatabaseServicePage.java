package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@RequiredArgsConstructor
public class DatabaseServicePage {
  @Nonnull WebDriver webDriver;

  By runIngestion = By.cssSelector("[data-testid='run']");
  By editIngestion = By.cssSelector("[data-testid='edit']");
  By deleteIngestion = By.cssSelector("[data-testid='delete']");
  By selectInterval = By.xpath("//select[@id='ingestionType']");

  public By runIngestion() {
    return runIngestion;
  }

  public By editIngestion() {
    return editIngestion;
  }

  public By deleteIngestion() {
    return deleteIngestion;
  }

  public By selectInterval() {
    return selectInterval;
  }

  public By ingestionInterval(String interval) {
    return By.xpath("//select[@id='ingestionType']/option[@value='" + interval + "']");
  }
}
