package org.openmetadata.catalog.selenium.pages.databaseService;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.DatabaseServicePage;
import org.openmetadata.catalog.selenium.pages.common.Interceptor;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class DatabaseServicePageUIErrorHandlingTest {
  static ChromeDriver webDriver;
  static Common common;
  static DatabaseServicePage databaseServicePage;
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
  static String serviceName = faker.name().firstName();

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
    databaseServicePage = new DatabaseServicePage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void openDatabaseServicePage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsServices()); // Setting/Services
    Thread.sleep(waitTime);
  }

  @Test
  @Order(1)
  void exceptionCheckForFetchDatabaseService() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerSettings());
    interceptor.interceptor("api/v1/services/", "api/v1/testing/");
    Events.click(webDriver, common.headerSettingsServices()); // Setting/Services
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching services!");
  }

  @Test
  @Order(2)
  void exceptionCheckForFetchServiceDetails() throws InterruptedException {
    openDatabaseServicePage();
    interceptor.interceptor("databaseServices/name/bigquery_gcp", "databaseServices/name/testing");
    Events.click(webDriver, common.containsText("bigquery_gcp"));
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching service details!");
  }

  @Test
  @Order(3)
  void exceptionCheckForAddService() throws InterruptedException {
    openDatabaseServicePage();
    try {
      Events.click(webDriver, common.noServicesAddServiceButton());
    } catch (NoSuchElementException | TimeoutException e) {
      Events.click(webDriver, common.addServiceButton());
    }
    Events.click(webDriver, common.serviceType("MySQL"));
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(webDriver, common.serviceName(), serviceName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(webDriver, common.serviceUrl(), "localhost");
    Events.sendKeys(webDriver, common.servicePort(), "3306");
    Events.sendKeys(webDriver, common.serviceUsername(), "openmetadata_user");
    Events.sendKeys(webDriver, common.servicePassword(), "openmetadata_password");
    Events.sendKeys(webDriver, common.databaseName(), "openmetadata_db");
    Events.click(webDriver, common.nextButton());
    Events.click(webDriver, common.nextButton());
    interceptor.interceptor("services/databaseServices", "services/testing");
    Events.click(webDriver, databaseServicePage.deploy());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while adding service!");
  }

  @Test
  @Order(4)
  void exceptionCheckForDeleteService() throws InterruptedException {
    openDatabaseServicePage();
    Events.click(webDriver, common.deleteServiceButton("bigquery_gcp"));
    interceptor.interceptor("api/v1/services/databaseServices", "api/v1/services/testing");
    Events.click(webDriver, common.saveEditedService());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while deleting service!");
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
