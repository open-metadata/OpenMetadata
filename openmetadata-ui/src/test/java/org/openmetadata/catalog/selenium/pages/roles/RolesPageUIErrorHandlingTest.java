package org.openmetadata.catalog.selenium.pages.roles;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.RolesPage;
import org.openmetadata.catalog.selenium.pages.common.Interceptor;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class RolesPageUIErrorHandlingTest {
  static ChromeDriver webDriver;
  static Common common;
  static RolesPage rolesPage;
  static DevTools devTools;
  static Interceptor interceptor;
  Integer waitTime = Property.getInstance().getSleepTime();
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static Faker faker = new Faker();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  static By toastMessage = By.cssSelector("[data-testid='toast']");
  static String roleDisplayName = faker.name().firstName();

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
    rolesPage = new RolesPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  void openRolesPage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(1)
  void exceptionCheckForFetchRoles() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings());
    interceptor.interceptor("api/v1/roles", "api/v1/testing");
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching roles!");
  }

  @Test
  @Order(2)
  void exceptionCheckForFetchPolicyDetails() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings());
    interceptor.interceptor("api/v1/policies", "api/v1/testing");
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching policy details!");
  }

  @Test
  @Order(3)
  void exceptionCheckForCreateRole() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    interceptor.interceptor("/api/v1/roles", "api/v1/testing");
    Events.click(webDriver, common.descriptionSaveButton());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error While creating role!");
  }

  @Test
  @Order(4)
  void exceptionCheckForCreateRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    Events.click(webDriver, common.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.addRule());
    Events.click(webDriver, rolesPage.listOperation());
    Events.click(webDriver, rolesPage.selectOperation("UpdateDescription"));
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("allow"));
    Events.click(webDriver, rolesPage.ruleToggleButton());
    interceptor.interceptor("/api/v1/policies", "api/v1/testing");
    Events.click(webDriver, common.descriptionSaveButton());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error While creating rule!");
  }

  @Test
  @Order(5)
  void exceptionCheckForDeleteRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, common.containsText("Data Consumer"));
    Events.click(webDriver, rolesPage.deleteRuleButton());
    interceptor.interceptor("/api/v1/policies", "api/v1/testing");
    Events.click(webDriver, common.saveEditedService());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while deleting rule!");
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
