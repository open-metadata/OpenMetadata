package org.openmetadata.catalog.selenium.pages.users;

import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.DashboardServicePage;
import org.openmetadata.catalog.selenium.objectRepository.DatabaseServicePage;
import org.openmetadata.catalog.selenium.objectRepository.TagsPage;
import org.openmetadata.catalog.selenium.objectRepository.UserPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(18)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UsersPageTest {

  static WebDriver webDriver;
  static TagsPage tagsPage;
  static DatabaseServicePage databaseServicePage;
  static DashboardServicePage dashboardServicePage;
  static UserPage userPage;
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  static String url = Property.getInstance().getURL();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    tagsPage = new TagsPage(webDriver);
    databaseServicePage = new DatabaseServicePage(webDriver);
    dashboardServicePage = new DashboardServicePage(webDriver);
    userPage = new UserPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  public void openUsersPage() throws InterruptedException {
    Events.click(webDriver, tagsPage.closeWhatsNew()); // Close What's new
    Events.click(webDriver, tagsPage.headerSettings()); // Setting
    Events.click(webDriver, userPage.headerSettingsMenu("Users"));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(1)
  public void addAdminCheckCountCheck() throws InterruptedException {
    openUsersPage();
    Events.click(webDriver, tagsPage.containsText("Cloud_Infra"));
    Events.click(webDriver, userPage.selectUser());
    Thread.sleep(2000);
    Events.click(webDriver, userPage.rolesList());
    Events.click(webDriver, userPage.selectRole("Admin"));
    actions.moveToElement(userPage.closeCheckBoxDropDown(), 100, 200);
    actions.click();
    actions.perform();
    Events.click(webDriver, tagsPage.descriptionSaveButton());
    Thread.sleep(1000);
    Object afterUsersCount = webDriver.findElement(userPage.userFilterCount()).getAttribute("innerHTML");
    Thread.sleep(1000);
    Assert.assertEquals(afterUsersCount, "14");
    Object afterAdminCount = webDriver.findElement(userPage.adminFilterCount()).getAttribute("innerHTML");
    Assert.assertEquals(afterAdminCount, "1");
  }

  @Test
  @Order(2)
  public void removeAdminCheckCountCheck() throws InterruptedException {
    openUsersPage();
    Events.click(webDriver, tagsPage.containsText("Cloud_Infra"));
    Events.click(webDriver, userPage.userPageTab(1));
    Events.click(webDriver, userPage.selectUser());
    Events.click(webDriver, userPage.rolesList());
    Events.click(webDriver, userPage.selectRole("Admin"));
    actions.moveToElement(userPage.closeCheckBoxDropDown(), 100, 200);
    actions.click();
    actions.perform();
    Events.click(webDriver, tagsPage.descriptionSaveButton());
    Thread.sleep(1000);
    Object afterAdminCount = webDriver.findElement(userPage.adminFilterCount()).getAttribute("innerHTML");
    Thread.sleep(1000);
    Assert.assertEquals(afterAdminCount, "0");
    Object afterUsersCount = webDriver.findElement(userPage.userFilterCount()).getAttribute("innerHTML");
    Assert.assertEquals(afterUsersCount, "15");
  }

  @Test
  @Order(3)
  public void caseSensitiveSearchCheck() throws InterruptedException {
    openUsersPage();
    Events.sendKeys(webDriver, userPage.userListSearchBar(), "AaR");
    Thread.sleep(4000);
    Object userResultsCount = webDriver.findElements(userPage.userListSearchResult()).size();
    Assert.assertEquals(userResultsCount, 3);
  }

  @AfterEach
  public void closeTabs() {
    ArrayList<String> tabs = new ArrayList<>(webDriver.getWindowHandles());
    String originalHandle = webDriver.getWindowHandle();
    for (String handle : webDriver.getWindowHandles()) {
      if (!handle.equals(originalHandle)) {
        webDriver.switchTo().window(handle);
        webDriver.close();
      }
    }
    webDriver.switchTo().window(tabs.get(0)).close();
  }
}
