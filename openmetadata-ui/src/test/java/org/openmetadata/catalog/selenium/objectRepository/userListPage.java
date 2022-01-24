package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class userListPage {
  WebDriver webDriver;

  public userListPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By all_users = By.xpath("(//p[@class='tw-text-center tag-category tw-self-center'])[1]");

  public WebElement allUsers() {
    return webDriver.findElement(all_users);
  }
}
