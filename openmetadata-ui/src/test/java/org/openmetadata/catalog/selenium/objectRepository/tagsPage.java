package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class tagsPage {
  WebDriver webDriver;

  public tagsPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By tagCategories = By.className("tw-heading");

  public WebElement tagCategories() {
    return webDriver.findElement(tagCategories);
  }
}
