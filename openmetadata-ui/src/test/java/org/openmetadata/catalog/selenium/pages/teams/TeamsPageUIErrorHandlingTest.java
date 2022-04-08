package org.openmetadata.catalog.selenium.pages.teams;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.TeamsPage;
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

public class TeamsPageUIErrorHandlingTest {
  static ChromeDriver webDriver;
  static Common common;
  static DevTools devTools;
  static Interceptor interceptor;
  static TeamsPage teamsPage;
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
    teamsPage = new TeamsPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  public void openTeamsPage() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, teamsPage.teams()); // Setting/Teams
    Assert.assertTrue(teamsPage.heading().isDisplayed());
  }

  @Test
  @Order(1)
  void exceptionCheckForCreateTeam() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, teamsPage.teams());
    Events.click(webDriver, teamsPage.addTeam()); // add team
    Events.sendKeys(webDriver, teamsPage.name(), faker.name().firstName()); // name
    Events.sendKeys(webDriver, teamsPage.displayName(), faker.name().firstName()); // displayname
    Events.sendKeys(webDriver, teamsPage.enterDescription(), faker.address().toString());
    interceptor.interceptor("/api/v1/teams", "api/v1/testing");
    Events.click(webDriver, teamsPage.saveTeam());
    String errorMessage = wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage)).getText();
    Assert.assertEquals(errorMessage, "Error while creating team!");
  }

  @Test
  @Order(2)
  void exceptionCheckForDeleteTeam() {
    openTeamsPage();
    String teamName = faker.name().firstName();
    Events.click(webDriver, teamsPage.addTeam()); // add team
    Events.sendKeys(webDriver, teamsPage.name(), teamName); // name
    Events.sendKeys(webDriver, teamsPage.displayName(), teamName); // displayname
    Events.sendKeys(webDriver, teamsPage.enterDescription(), faker.address().toString());
    Events.click(webDriver, teamsPage.saveTeam());
    Events.click(webDriver, common.containsText(teamName));
    Events.click(webDriver, teamsPage.deleteTeam());
    interceptor.interceptor("/api/v1/teams", "api/v1/testing");
    Events.click(webDriver, teamsPage.saveDeletedTeam());
    String errorMessage = wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage)).getText();
    Assert.assertEquals(errorMessage, "Error while deleting team!");
  }

  @Test
  @Order(3)
  void exceptionCheckForFetchTeam() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings());
    interceptor.interceptor("/api/v1/teams", "api/v1/testing");
    Events.click(webDriver, common.headerSettingsMenu("Teams"));
    wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage));
    String errorMessage = wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage)).getText();
    Assert.assertEquals(errorMessage, "Error while fetching teams!");
  }

  @Test
  @Order(4)
  void exceptionCheckForUpdateTeam() {
    openTeamsPage();
    Events.click(webDriver, teamsPage.addNewUser());
    Events.click(webDriver, teamsPage.selectUser());
    interceptor.interceptor("/api/v1/teams", "api/v1/testing");
    Events.click(webDriver, teamsPage.saveUser());
    wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage));
    String errorMessage = wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage)).getText();
    Assert.assertEquals(errorMessage, "Error while updating team!");
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
