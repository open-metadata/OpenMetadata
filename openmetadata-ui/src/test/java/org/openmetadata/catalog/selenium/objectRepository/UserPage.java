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
  By userFilterCount = By.xpath("//span[@data-testid='filter-count'][text()[contains(.,'101')]]");
  By adminFilterCount = By.xpath("//span[@data-testid='filter-count'][text()='1']");
  By userListSearchBar = By.cssSelector("[data-testid='searchbar']");
  By userListSearchResult =
      By.xpath("//div[@data-testid='user-card-container']/div/div[@data-testid='user-card-container']");
  By closeCheckBoxDropDown = By.cssSelector("[data-testid='close-dropdown']");
  By admin = By.cssSelector("[title='Admins']");
  By users = By.cssSelector("[title='Users']");

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
