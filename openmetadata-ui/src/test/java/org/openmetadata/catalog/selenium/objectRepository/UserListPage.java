package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

@RequiredArgsConstructor
public class UserListPage {
  @Nonnull WebDriver webDriver;

  By all_users = By.xpath("(//p[@class='tw-text-center tag-category tw-self-center'])[1]");

  public WebElement allUsers() {
    return webDriver.findElement(all_users);
  }
}
