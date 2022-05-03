package org.openmetadata.catalog.selenium.pages.Webhooks;

import com.github.javafaker.Faker;
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
import org.openmetadata.catalog.selenium.objectRepository.Webhooks;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(20)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class WebhooksPageTest {

  static WebDriver webDriver;
  static Common common;
  static Webhooks webhooks;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String webhookName = faker.name().firstName();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
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
    webhooks = new Webhooks(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  void openWebHookPage() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, webhooks.webhookLink());
  }

  @Test
  @Order(2)
  void addWebHook() {
    openWebHookPage();
    Events.click(webDriver, webhooks.addWebhook());
    Events.sendKeys(webDriver, webhooks.name(), webhookName);
    Events.click(webDriver, webhooks.descriptionBox());
    Events.sendKeys(webDriver, webhooks.focusedDescriptionBox(), faker.address().toString());
    Events.sendKeys(webDriver, webhooks.endpoint(), "https://www.example.com");
    ((JavascriptExecutor) webDriver)
        .executeScript("arguments[0].scrollIntoView(true);", webDriver.findElement(common.saveWebhook()));
    Events.click(webDriver, webhooks.checkbox());
    Events.click(webDriver, webhooks.entityCreatedMenu());
    Events.click(webDriver, webhooks.allEntities());
    Events.click(webDriver, webhooks.clickToCloseDropdown());
    Events.click(webDriver, common.saveWebhook());
    WebElement checkName = wait.until(ExpectedConditions.presenceOfElementLocated(webhooks.checkWebhook(webhookName)));
    Assert.assertEquals(checkName.getText(), webhookName);
  }

  @Test
  @Order(3)
  void checkDuplicateWebhookName() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, webhooks.webhookLink());
    Events.click(webDriver, webhooks.addWebhook());
    Events.sendKeys(webDriver, webhooks.name(), webhookName);
    Events.click(webDriver, webhooks.descriptionBox());
    Events.sendKeys(webDriver, webhooks.focusedDescriptionBox(), "test");
    Events.sendKeys(webDriver, webhooks.endpoint(), "https://www.example.com");
    ((JavascriptExecutor) webDriver)
        .executeScript("arguments[0].scrollIntoView(true);", webDriver.findElement(common.saveWebhook()));
    Events.click(webDriver, webhooks.checkbox());
    Events.click(webDriver, webhooks.entityCreatedMenu());
    Events.click(webDriver, webhooks.allEntities());
    Events.click(webDriver, webhooks.clickToCloseDropdown());
    Events.click(webDriver, common.saveWebhook());
    Events.waitForElementToDisplay(webDriver, webhooks.toast(), 10, 2);
    WebElement errorMessage = webDriver.findElement(webhooks.toast());
    Assert.assertEquals(errorMessage.getText(), "Entity already exists");
  }

  @Test
  @Order(4)
  void checkBlankName() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openWebHookPage();
    Events.click(webDriver, webhooks.addWebhook());
    Events.sendKeys(webDriver, webhooks.name(), "");
    Events.click(webDriver, webhooks.descriptionBox());
    Events.sendKeys(webDriver, webhooks.focusedDescriptionBox(), "test");
    Events.sendKeys(webDriver, webhooks.endpoint(), "http://www.test.com");
    ((JavascriptExecutor) webDriver)
        .executeScript("arguments[0].scrollIntoView(true);", webDriver.findElement(common.saveWebhook()));
    Events.click(webDriver, webhooks.checkbox());
    Events.click(webDriver, webhooks.entityCreatedMenu());
    Events.click(webDriver, webhooks.allEntities());
    Events.click(webDriver, webhooks.clickToCloseDropdown());
    Events.click(webDriver, common.saveWebhook());
    WebElement errorMessage = webDriver.findElement(common.errorMessage());
    Assert.assertEquals(errorMessage.getText(), "Webhook name is required.");
  }

  @Test
  @Order(5)
  void checkBlankEndpoint() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openWebHookPage();
    Events.click(webDriver, webhooks.addWebhook());
    Events.sendKeys(webDriver, webhooks.name(), "test");
    Events.click(webDriver, webhooks.descriptionBox());
    Events.sendKeys(webDriver, webhooks.focusedDescriptionBox(), "test");
    Events.sendKeys(webDriver, webhooks.endpoint(), "");
    ((JavascriptExecutor) webDriver)
        .executeScript("arguments[0].scrollIntoView(true);", webDriver.findElement(common.saveWebhook()));
    Events.click(webDriver, webhooks.checkbox());
    Events.click(webDriver, webhooks.entityCreatedMenu());
    Events.click(webDriver, webhooks.allEntities());
    Events.click(webDriver, webhooks.clickToCloseDropdown());
    Events.click(webDriver, common.saveWebhook());
    WebElement errorMessage = webDriver.findElement(common.errorMessage());
    Assert.assertEquals(errorMessage.getText(), "Webhook endpoint is required.");
  }

  @Test
  @Order(6)
  void checkBlankEntityCheckbox() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openWebHookPage();
    Events.click(webDriver, webhooks.addWebhook());
    Events.sendKeys(webDriver, webhooks.name(), "test");
    Events.click(webDriver, webhooks.descriptionBox());
    Events.sendKeys(webDriver, webhooks.focusedDescriptionBox(), "test");
    Events.sendKeys(webDriver, webhooks.endpoint(), "https://www.test.com");
    ((JavascriptExecutor) webDriver)
        .executeScript("arguments[0].scrollIntoView(true);", webDriver.findElement(common.saveWebhook()));
    Events.click(webDriver, common.saveWebhook());
    WebElement errorMessage = webDriver.findElement(common.errorMessage());
    Assert.assertEquals(errorMessage.getText(), "Webhook event filters are required.");
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
