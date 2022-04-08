package org.openmetadata.catalog.selenium.pages.users;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.UserPage;
import org.openmetadata.catalog.selenium.pages.common.Interceptor;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class UsersPageUIErrorHandlingTest {
  static ChromeDriver webDriver;
  static Common common;
  static DevTools devTools;
  static Interceptor interceptor;
  static UserPage userPage;
  Integer waitTime = Property.getInstance().getSleepTime();
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static Faker faker = new Faker();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  static By toastMessage = By.cssSelector("[data-testid='toast']");

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    devTools = webDriver.getDevTools();
    interceptor = new Interceptor(devTools);
    userPage = new UserPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  public void openUsersPage() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Users"));
  }

  @Test
  @Order(1)
  void exceptionCheckForFetchUsers() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    interceptor.interceptor("api/v1/users", "api/v1/test");
    Events.click(webDriver, common.headerSettingsMenu("Users"));
    wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage));
    String errorMessage = wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage)).getText();
    Assert.assertEquals(errorMessage, "Error while fetching user details!");
  }

  @Test
  @Order(2)
  void exceptionCheckForAddUser() {
    openUsersPage();
    Events.click(webDriver, userPage.addUser());
    Events.click(webDriver, userPage.emailTextBox());
    Events.sendKeys(webDriver, userPage.emailTextBox(), "test@gmail.com");
    interceptor.interceptor("api/v1/users", "api/v1/test");
    Events.click(webDriver, userPage.createUserButton());
    String errorMessage = wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage)).getText();
    Assert.assertEquals(errorMessage, "Error while creating user!");
  }

  @Test
  @Order(3)
  void exceptionCheckForDeleteUser() throws InterruptedException {
    String userName = faker.name().firstName();
    openUsersPage();
    Events.click(webDriver, userPage.addUser());
    Events.click(webDriver, userPage.emailTextBox());
    Events.sendKeys(webDriver, userPage.emailTextBox(), userName + "@gmail.com");
    Events.click(webDriver, userPage.createUserButton());
    Events.click(webDriver, userPage.searchBar());
    Events.sendKeys(webDriver, userPage.searchBar(), userName);
    actions.moveToElement(webDriver.findElement(userPage.deleteUser())).perform();
    Events.click(webDriver, userPage.deleteUser());
    interceptor.interceptor("api/v1/users", "api/v1/test");
    Events.click(webDriver, userPage.deleteSave());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while deleting user!");
  }

  @Test
  @Order(4)
  void exceptionCheckForUpdateUser() throws InterruptedException {
    String userName = faker.name().firstName();
    openUsersPage();
    Events.click(webDriver, userPage.addUser());
    Events.click(webDriver, userPage.emailTextBox());
    Events.sendKeys(webDriver, userPage.emailTextBox(), userName + "@gmail.com");
    Events.click(webDriver, userPage.createUserButton());
    Events.click(webDriver, userPage.searchBar());
    Events.sendKeys(webDriver, userPage.searchBar(), userName);
    Events.click(webDriver, common.containsText(userName));
    Events.click(webDriver, userPage.rolesList());
    userPage.selectDataSteward();
    actions.click();
    actions.perform();
    interceptor.interceptor("api/v1/users", "api/v1/test");
    Events.click(webDriver, userPage.saveButton());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while updating user!");
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
