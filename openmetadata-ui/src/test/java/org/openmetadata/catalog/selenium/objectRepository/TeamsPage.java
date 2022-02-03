package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class TeamsPage {
  WebDriver webDriver;

  public TeamsPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By heading = By.className("tw-heading");

  public WebElement heading() {
    return webDriver.findElement(heading);
  }
}
