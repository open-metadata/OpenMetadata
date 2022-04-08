package org.openmetadata.catalog.selenium.pages.glossary;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.GlossaryPage;
import org.openmetadata.catalog.selenium.objectRepository.TableDetails;
import org.openmetadata.catalog.selenium.pages.common.Interceptor;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class GlossaryPageUIErrorHandlingTest {
  static ChromeDriver webDriver;
  static Common common;
  static GlossaryPage glossary;
  static TableDetails tableDetails;
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
  static String glossaryName = faker.name().firstName();
  static String termName = faker.name().firstName();

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
    tableDetails = new TableDetails(webDriver);
    glossary = new GlossaryPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  void assertElements() {}

  void openGlossaryPage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(1)
  void exceptionCheckForAddGlossary() throws InterruptedException {
    openGlossaryPage();
    try {
      WebElement addGlossaryButton = webDriver.findElement(common.addTagCategory());
      if (addGlossaryButton.isDisplayed()) {
        Events.click(webDriver, common.addTagCategory());
      }
    } catch (NoSuchElementException e) {
      Events.click(webDriver, glossary.addGlossaryButton());
    }
    Events.sendKeys(webDriver, common.displayName(), glossaryName);
    interceptor.interceptor("/api/v1/glossaries", "/api/v1/testing");
    Events.click(webDriver, glossary.saveGlossary());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while adding glossary!");
  }

  @Test
  @Order(2)
  void exceptionCheckForAddTerm() throws InterruptedException {
    openGlossaryPage();
    try {
      WebElement addGlossaryButton = webDriver.findElement(common.addTagCategory());
      if (addGlossaryButton.isDisplayed()) {
        Events.click(webDriver, common.addTagCategory());
      }
    } catch (NoSuchElementException e) {
      Events.click(webDriver, glossary.addGlossaryButton());
    }
    Events.sendKeys(webDriver, common.displayName(), glossaryName);
    Events.click(webDriver, glossary.saveGlossary());
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.addTagButton());
    Events.click(webDriver, common.selectUser());
    Events.sendKeys(webDriver, common.displayName(), termName);
    interceptor.interceptor("/api/v1/glossaryTerms", "/api/v1/testingTerms");
    Events.click(webDriver, glossary.saveGlossaryTerm());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while adding glossary term!");
  }

  @Test
  @Order(3)
  void exceptionCheckForAddTags() throws InterruptedException {
    openGlossaryPage();
    try {
      WebElement addGlossaryButton = webDriver.findElement(common.addTagCategory());
      if (addGlossaryButton.isDisplayed()) {
        Events.click(webDriver, common.addTagCategory());
      }
    } catch (NoSuchElementException e) {
      Events.click(webDriver, glossary.addGlossaryButton());
    }
    Events.sendKeys(webDriver, common.displayName(), glossaryName);
    Events.click(webDriver, glossary.saveGlossary());
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.breadCrumbTags());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    interceptor.interceptor("/api/v1/glossaries", "/api/v1/testing");
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while updating tags!");
  }

  @Test
  @Order(4)
  void exceptionCheckForAddDescription() throws InterruptedException {
    openGlossaryPage();
    try {
      WebElement addGlossaryButton = webDriver.findElement(common.addTagCategory());
      if (addGlossaryButton.isDisplayed()) {
        Events.click(webDriver, common.addTagCategory());
      }
    } catch (NoSuchElementException e) {
      Events.click(webDriver, glossary.addGlossaryButton());
    }
    Events.sendKeys(webDriver, common.displayName(), glossaryName);
    Events.click(webDriver, glossary.saveGlossary());
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.editDescriptionButton());
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    interceptor.interceptor("/api/v1/glossaries", "/api/v1/testing");
    Events.click(webDriver, common.editDescriptionSaveButton());
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while updating description!");
  }

  @Test
  @Order(5)
  void exceptionCheckForFetchGlossaries() throws InterruptedException {
    openGlossaryPage();
    String glossaryDisplayName = null;
    for (int i = 0; i < 2; i++) {
      glossaryDisplayName = faker.name().firstName();
      try {
        Events.click(webDriver, common.addTagCategory());
      } catch (NoSuchElementException e) {
        Events.click(webDriver, glossary.addGlossaryButton());
      }
      Events.sendKeys(webDriver, common.displayName(), glossaryDisplayName);
      Events.click(webDriver, glossary.saveGlossary());
    }
    Thread.sleep(waitTime);
    Events.click(webDriver, common.home());
    Events.click(webDriver, common.headerSettings());
    interceptor.interceptor("/api/v1/glossaries", "/api/v1/testing");
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching glossaries!");
  }

  @Test
  @Order(6)
  void exceptionCheckForFetchGlossary() throws InterruptedException {
    openGlossaryPage();
    try {
      Events.click(webDriver, common.addTagCategory());
    } catch (NoSuchElementException e) {
      Events.click(webDriver, glossary.addGlossaryButton());
    }
    Events.sendKeys(webDriver, common.displayName(), glossaryName);
    Events.click(webDriver, glossary.saveGlossary());
    webDriver.navigate().refresh();
    Thread.sleep(waitTime);
    interceptor.interceptor("/glossary/" + glossaryName + "", "/glossary/testing");
    Events.click(webDriver, common.containsText(glossaryName));
    Thread.sleep(waitTime);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching glossary!");
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
