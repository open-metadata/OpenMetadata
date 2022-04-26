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
import org.openmetadata.catalog.selenium.objectRepository.Common;
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
class UsersPageTest {

  static WebDriver webDriver;
  static Common common;
  static UserPage userPage;
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  static String url = Property.getInstance().getURL();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    userPage = new UserPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  void openUsersPage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Teams & Users"));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(1)
  void addAdminCheckCountCheck() throws InterruptedException {
    openUsersPage();
    Events.click(webDriver, userPage.users());
    Events.click(webDriver, userPage.selectUser());
    Events.click(webDriver, userPage.editRole());
    Events.click(webDriver, common.containsText("Data Consumer"));
    Events.click(webDriver, common.containsText("Admin"));
    Events.click(webDriver, userPage.saveRole());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsTeams());
    Events.click(webDriver, userPage.users());
    webDriver.navigate().refresh();
    Thread.sleep(waitTime);
    Object afterUsersCount = webDriver.findElement(userPage.userFilterCount()).getAttribute("innerHTML");
    Thread.sleep(waitTime);
    Assert.assertEquals(afterUsersCount, "101");
    Object afterAdminCount = webDriver.findElement(userPage.adminFilterCount()).getAttribute("innerHTML");
    Assert.assertEquals(afterAdminCount, "1");
  }

  @Test
  @Order(2)
  void removeAdminCheckCountCheck() throws InterruptedException {
    openUsersPage();
    Events.click(webDriver, userPage.users());
    Events.click(webDriver, userPage.selectUser());
    Events.click(webDriver, userPage.editRole());
    Events.click(webDriver, userPage.removeRole());
    Events.click(webDriver, userPage.saveRole());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsTeams());
    Events.click(webDriver, userPage.users());
    webDriver.navigate().refresh();
    Thread.sleep(waitTime);
    Object afterAdminCount = webDriver.findElement(userPage.adminFilterCountAfterDelete()).getAttribute("innerHTML");
    Thread.sleep(waitTime);
    Assert.assertEquals(afterAdminCount, "0");
    Object afterUsersCount = webDriver.findElement(userPage.userFilterCount()).getAttribute("innerHTML");
    Assert.assertEquals(afterUsersCount, "101");
  }

  @Test
  @Order(3)
  void caseSensitiveSearchCheck() throws InterruptedException {
    openUsersPage();
    Events.click(webDriver, userPage.users());
    Events.sendKeys(webDriver, userPage.userListSearchBar(), "AaR");
    Thread.sleep(waitTime);
    Object userResultsCount = webDriver.findElements(userPage.userListSearchResult()).size();
    Assert.assertEquals(userResultsCount, 3);
  }

  @AfterEach
  void closeTabs() {
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
