package org.openmetadata.catalog.selenium.pages.common;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.devtools.v95.fetch.Fetch;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;

@Order(16)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UiExceptionHandling {

  static ChromeDriver webDriver;
  static Common common;
  static DevTools devTools;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static Faker faker = new Faker();
  static String serviceName = faker.name().firstName();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  public void interceptor(String content, String replaceContent) {
    devTools.createSession();
    devTools.send(Fetch.enable(Optional.empty(), Optional.empty()));
    devTools.addListener(
        Fetch.requestPaused(),
        request -> {
          if (request.getRequest().getUrl().contains(content)) {
            String mockedUrl = request.getRequest().getUrl().replace(content, replaceContent);
            devTools.send(
                Fetch.continueRequest(
                    request.getRequestId(),
                    Optional.of(mockedUrl),
                    Optional.of(request.getRequest().getMethod()),
                    Optional.empty(),
                    Optional.empty(),
                    Optional.empty()));
          } else {
            devTools.send(
                Fetch.continueRequest(
                    request.getRequestId(),
                    Optional.of(request.getRequest().getUrl()),
                    Optional.of(request.getRequest().getMethod()),
                    Optional.empty(),
                    Optional.empty(),
                    Optional.empty()));
          }
        });
  }

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
    devTools = webDriver.getDevTools();
  }

  @Test
  public void exceptionCheckForUserList() {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    interceptor("/api/v1/teams", "/api/v1/testing");
    Events.click(webDriver, common.headerSettingsMenu("Users"));
    Events.click(webDriver, common.containsText("Error while fetching teams!"));
    Events.click(webDriver, common.closeErrorMessage());
    //    Assert.assertEquals(400, 400);
  }

  @Test
  public void exceptionCheckForGetServices() throws InterruptedException {
    interceptor("databaseService", "testing");
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Services"));
    Thread.sleep(2000);
    Events.click(webDriver, common.containsText("No services found"));
    //    Assert.assertEquals(500, 500);
  }

  @Test
  public void exceptionCheckFor() {
    interceptor("services/databaseServices", "services/testing");
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Services")); // Setting/Services
  }

  @Test
  public void exceptionCheckForPostService() {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Services")); // Setting/Services
    Events.click(webDriver, common.noServicesAddServiceButton());
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
    interceptor("services/databaseServices", "services/testing");
    Events.click(webDriver, common.nextButton());
    Events.click(webDriver, common.nextButton());
    Events.click(webDriver, common.saveServiceButton());
    //    Assert.assertEquals(500, 500);
  }

  @Test
  public void exceptionCheckForUpdateService() {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Services")); // Setting/Services
    Events.click(webDriver, common.containsText("bigquery_gcp"));
    Events.click(webDriver, common.editTagCategoryDescription());
    Events.click(webDriver, common.addDescriptionString());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    interceptor("services/databaseServices", "services/testing");
    Events.click(webDriver, common.editDescriptionSaveButton());
    Events.click(webDriver, common.containsText("Error while updating description!"));
    Events.click(webDriver, common.closeErrorMessage());
    //    Assert.assertEquals(500, 500);
  }

  @Test
  public void exceptionCheckForDeleteService() {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Services")); // Setting/Services
    Events.click(webDriver, common.deleteServiceButton("bigquery_gcp"));
    interceptor("services/databaseServices", "services/testing");
    //    Assert.assertEquals(500, 500);
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
