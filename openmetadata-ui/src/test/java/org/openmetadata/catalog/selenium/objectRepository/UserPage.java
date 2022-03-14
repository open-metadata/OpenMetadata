package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

@Getter
@RequiredArgsConstructor
public class UserPage {
  @Nonnull WebDriver webDriver;

  By rolesList = By.cssSelector("[data-testid='menu-button'][id='menu-button-User']");
  By selectUser = By.xpath("//div[@data-testid='data-container']//p");
  By userFilterCount = By.xpath("//button[@data-testid='users']//span[@data-testid='filter-count']");
  By adminFilterCount = By.xpath("//button[@data-testid='assets'][1]//span[@data-testid='filter-count']");
  By userListSearchBar = By.cssSelector("[data-testid='searchbar']");
  By userListSearchResult =
      By.xpath("//div[@data-testid='user-card-container']/div/div[@data-testid='user-card-container']");
  By closeCheckBoxDropDown = By.cssSelector("[data-testid='close-dropdown']");

  public By selectRole(String role) {
    return By.cssSelector("[data-testid='" + role + "']");
  }

  public By userPageTab(int index) {
    return By.xpath("//button[@data-testid='assets'][" + index + "]");
  }

  public WebElement closeCheckBoxDropDown() {
    return webDriver.findElement(closeCheckBoxDropDown);
  }
}
