package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class ingestionPage {
  public WebDriver webDriver;

  public ingestionPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By addIngestion = By.xpath("//button[@data-testid=\"add-new-ingestion-button\"]");

  public WebElement addIngestion() {
    return webDriver.findElement(addIngestion);
  }
}
