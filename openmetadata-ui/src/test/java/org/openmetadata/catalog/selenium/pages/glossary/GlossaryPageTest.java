package org.openmetadata.catalog.selenium.pages.glossary;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.GlossaryPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.FluentWait;
import org.openqa.selenium.support.ui.Wait;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(21)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class GlossaryPageTest {

  static WebDriver webDriver;
  static Common common;
  static GlossaryPage glossary;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static Actions actions;
  static WebDriverWait wait;
  static String glossaryName = faker.name().firstName();
  static String termName = faker.name().firstName();
  Integer waitTime = Property.getInstance().getSleepTime();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  Wait<WebDriver> fluentWait;

  @BeforeEach
  void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    glossary = new GlossaryPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
    fluentWait =
        new FluentWait<WebDriver>(webDriver)
            .withTimeout(Duration.ofSeconds(10))
            .pollingEvery(Duration.ofSeconds(10))
            .ignoring(NoSuchElementException.class);
  }

  public void pause(Integer milliseconds) {
    try {
      TimeUnit.MILLISECONDS.sleep(milliseconds);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
  }

  @Test
  @Order(1)
  void openGlossaryPage() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
  }

  @Test
  @Order(2)
  void addGlossary() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    try {
      Events.click(webDriver, common.addTagCategory());
    } catch (NoSuchElementException | TimeoutException e) {
      Events.click(webDriver, glossary.addGlossaryButton());
    }
    Events.sendKeys(webDriver, common.displayName(), glossaryName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendEnter(webDriver, common.focusedDescriptionBox());
    Events.click(webDriver, common.descriptionItalicButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendEnter(webDriver, common.focusedDescriptionBox());
    Events.click(webDriver, glossary.addReviewerButton());
    for (int i = 1; i <= 3; i++) {
      Events.click(webDriver, glossary.checkboxAddUser(i));
    }
    Events.click(webDriver, common.descriptionSaveButton());
    Events.click(webDriver, glossary.saveGlossary());
  }

  @Test
  @Order(3)
  void addTagToGlossary() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.breadCrumbTags());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Object reviewerCount =
        fluentWait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(common.tagsCount())).size();
    Assert.assertEquals(reviewerCount.toString(), "2");
  }

  @Test
  @Order(4)
  void addReviewer() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.addGlossaryReviewer());
    Events.click(webDriver, glossary.checkboxAddUser(4));
    Events.click(webDriver, common.descriptionSaveButton());
    pause(waitTime);
    Object reviewerCount =
        fluentWait.until(ExpectedConditions.visibilityOfAllElementsLocatedBy(common.reviewCount())).size();
    Assert.assertEquals(reviewerCount.toString(), "4");
  }

  @Test
  @Order(6)
  void removeAddedTagsToGlossary() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, glossary.editGlossaryTag());
    Events.click(webDriver, glossary.editGlossaryTag());
    for (int i = 0; i < 2; i++) {
      Events.click(webDriver, common.removeAssociatedTag());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().refresh();
    Object reviewerCount = webDriver.findElements(common.tagsCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "0");
  }

  @Test
  @Order(7)
  void removeAddedReviewers() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.addGlossaryReviewer());
    for (int i = 1; i <= 4; i++) {
      Events.click(webDriver, glossary.checkboxAddUser(i));
    }
    Events.click(webDriver, common.descriptionSaveButton());
    pause(waitTime);
    Object reviewerCount = webDriver.findElements(common.reviewCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "0");
  }

  @Test
  @Order(8)
  void addGlossaryTerm() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.addTagButton());
    Events.sendKeys(webDriver, common.displayName(), termName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendEnter(webDriver, common.focusedDescriptionBox());
    Events.click(webDriver, common.descriptionItalicButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendEnter(webDriver, common.focusedDescriptionBox());
    Events.click(webDriver, common.descriptionLinkButton());
    Events.sendKeys(webDriver, common.urlLink(), faker.address().toString());
    Events.sendKeys(webDriver, common.linkText(), faker.address().firstName());
    Events.click(webDriver, common.okButton());
    Events.click(webDriver, glossary.saveGlossaryTerm());
  }

  @Test
  @Order(9)
  void addTagToTerm() {
    openGlossaryPage();
    Events.click(webDriver, common.textEquals(termName));
    Events.click(webDriver, common.breadCrumbTags());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Object reviewerCount =
        fluentWait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(common.tagsCount())).size();
    Assert.assertEquals(reviewerCount.toString(), "2");
  }

  @Test
  @Order(10)
  void addTermReviewer() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.textEquals(termName));
    Events.click(webDriver, common.manage());
    Events.click(webDriver, common.addGlossaryReviewer());
    Events.click(webDriver, glossary.checkboxAddUser(1));
    Events.click(webDriver, glossary.checkboxAddUser(2));
    Events.click(webDriver, glossary.checkboxAddUser(3));
    Events.click(webDriver, glossary.saveTermReviewer());
    pause(waitTime);
    Object reviewerCount =
        fluentWait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(common.reviewCount())).size();
    Assert.assertEquals(reviewerCount.toString(), "3");
  }

  @Test
  @Order(12)
  void removeAddedReviewersToTerm() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.textEquals(termName));
    Events.click(webDriver, common.manage());
    actions.moveToElement(webDriver.findElement(common.removeAssociatedTag())).perform();
    for (int i = 1; i <= 3; i++) {
      Events.click(webDriver, common.removeAssociatedTag());
      pause(waitTime);
    }
    Object reviewerCount = webDriver.findElements(common.reviewCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "0");
  }

  @Test
  @Order(13)
  void removeAddedTagsToTerm() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Events.click(webDriver, common.textEquals(termName));
    Events.click(webDriver, glossary.editGlossaryTag());
    for (int i = 0; i < 2; i++) {
      Events.click(webDriver, common.removeAssociatedTag());
      pause(waitTime);
    }
    Events.click(webDriver, common.saveAssociatedTag());
    pause(waitTime);
    Object reviewerCount = webDriver.findElements(common.tagsCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "0");
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
