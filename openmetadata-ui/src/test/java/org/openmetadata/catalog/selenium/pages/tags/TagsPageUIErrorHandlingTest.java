package org.openmetadata.catalog.selenium.pages.tags;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.TagsPage;
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

public class TagsPageUIErrorHandlingTest {
  static ChromeDriver webDriver;
  static Common common;
  static DevTools devTools;
  static Interceptor interceptor;
  static TagsPage tagsPage;
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
    tagsPage = new TagsPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  public void openTagsPage() {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, tagsPage.headerSettingsTags());
  }

  @Test
  @Order(1)
  void exceptionCheckForCreateTags() {
    openTagsPage();
    Events.click(webDriver, common.addTagButton());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    interceptor.interceptor("/api/v1/tags/PersonalData", "/api/v1/testing/PersonalData");
    Events.click(webDriver, common.descriptionSaveButton());
    wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage));
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while creating tag!");
  }

  @Test
  @Order(2)
  void exceptionCheckForAddTagCategories() {
    openTagsPage();
    Events.click(webDriver, common.addTagCategory());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    interceptor.interceptor("/api/v1/tags", "/api/v1/testing");
    Events.click(webDriver, common.descriptionSaveButton());
    wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage));
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while creating tag category!");
  }

  @Test
  @Order(3)
  void exceptionCheckForFetchTagCategories() {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    interceptor.interceptor("/api/v1/tags", "/api/v1/test");
    Events.click(webDriver, tagsPage.headerSettingsTags());
    wait.until(ExpectedConditions.presenceOfElementLocated(toastMessage));
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching tags category!");
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
