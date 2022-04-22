package org.openmetadata.catalog.selenium.objectRepository;

import java.util.List;
import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

@Getter
@RequiredArgsConstructor
public class TeamsPage {
  @Nonnull WebDriver webDriver;

  By heading = By.className("tw-heading");
  By teams = By.xpath("//a[@data-testid='terms']");
  By addTeam = By.xpath("//button[@data-testid='add-teams']");
  By name = By.name("name");
  By displayName = By.name("displayName");
  By enterDescription = By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div");
  By saveTeam = By.cssSelector("[data-testid='saveButton']");
  By addNewUser = By.cssSelector("[data-testid='add-new-user-button']");
  By checkboxAddUser = By.cssSelector("[data-testid='checkboxAddUser']");
  By saveUser = By.cssSelector("[data-testid='AddUserSave']");
  By selectedUser = By.xpath("//div[@data-testid='data-container']/p[1]");
  By editDescription = By.xpath("//button[@data-testid='edit-description']");
  By saveDescription = By.xpath("//button[@data-testid='save']");
  By asset = By.cssSelector("[data-testid='Assets']");
  By searchInput = By.xpath("//input[@data-testid='searchInputText']");
  By dataContainer = By.xpath("//div[@data-testid='data-container']");
  By myDataTeamsCount = By.xpath("//div[@data-testid='terms-summary']/span/span[@data-testid='filter-count']");
  By errorMessage = By.xpath("//strong[@data-testid='error-message']");
  By descriptionContainer = By.cssSelector("[data-testid='viewer-container']");
  By tableName = By.cssSelector("[data-testid='inactive-link']");
  By addUser = By.cssSelector("[data-testid='add-teams']");
  By ownerDropdown = By.cssSelector("[data-testid='owner-dropdown']");
  By selectOwner = By.cssSelector("[data-testid='list-item'][id='menu-item-0']");

  public List<WebElement> checkboxAddUser() {
    return webDriver.findElements(checkboxAddUser);
  }

  public WebElement heading() {
    return webDriver.findElement(heading);
  }

  public By ownerName(String owner) {
    return By.cssSelector("[title='" + owner + "']");
  }
}
