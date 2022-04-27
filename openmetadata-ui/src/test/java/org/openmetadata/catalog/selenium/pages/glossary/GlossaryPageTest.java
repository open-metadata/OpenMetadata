package org.openmetadata.catalog.selenium.pages.glossary;

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
import org.openmetadata.catalog.selenium.objectRepository.GlossaryPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
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
  }

  @Test
  @Order(1)
  void openGlossaryPage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Glossaries"));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  void addGlossary() throws InterruptedException {
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
  void addTagToGlossary() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.breadCrumbTags());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(waitTime);
    Object reviewerCount = webDriver.findElements(common.tagsCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "2");
  }

  @Test
  @Order(4)
  void addReviewer() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.addGlossaryReviewer());
    Events.click(webDriver, glossary.checkboxAddUser(4));
    Events.click(webDriver, common.descriptionSaveButton());
    Thread.sleep(waitTime);
    Object reviewerCount = webDriver.findElements(common.reviewCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "4");
  }

  @Test
  @Order(6)
  void removeAddedTagsToGlossary() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, glossary.editGlossaryTag());
    Thread.sleep(waitTime);
    Events.click(webDriver, glossary.editGlossaryTag());
    for (int i = 0; i < 2; i++) {
      Events.click(webDriver, common.removeAssociatedTag());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(waitTime);
    webDriver.navigate().refresh();
    Object reviewerCount = webDriver.findElements(common.tagsCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "0");
  }

  @Test
  @Order(7)
  void removeAddedReviewers() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.addGlossaryReviewer());
    for (int i = 1; i <= 4; i++) {
      Events.click(webDriver, glossary.checkboxAddUser(i));
    }
    Events.click(webDriver, common.descriptionSaveButton());
    Thread.sleep(waitTime);
    Object reviewerCount = webDriver.findElements(common.reviewCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "0");
  }

  @Test
  @Order(8)
  void addGlossaryTerm() throws InterruptedException {
    openGlossaryPage();
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
  void addTagToTerm() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(termName));
    Events.click(webDriver, common.breadCrumbTags());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(waitTime);
    Object reviewerCount = webDriver.findElements(common.tagsCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "2");
  }

  @Test
  @Order(10)
  void addTermReviewer() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(termName));
    Events.click(webDriver, common.manage());
    Events.click(webDriver, common.addGlossaryReviewer());
    Thread.sleep(waitTime);
    Events.click(webDriver, glossary.checkboxAddUser(1));
    Thread.sleep(waitTime);
    Events.click(webDriver, glossary.checkboxAddUser(2));
    Thread.sleep(waitTime);
    Events.click(webDriver, glossary.checkboxAddUser(3));
    Thread.sleep(waitTime);
    Events.click(webDriver, glossary.saveTermReviewer());
    Thread.sleep(waitTime);
    Object reviewerCount = webDriver.findElements(common.reviewCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "3");
  }

  @Test
  @Order(12)
  void removeAddedReviewersToTerm() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(termName));
    Events.click(webDriver, common.manage());
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(common.removeAssociatedTag())).perform();
    for (int i = 1; i <= 3; i++) {
      Events.click(webDriver, common.removeAssociatedTag());
      Thread.sleep(waitTime);
    }
    Object reviewerCount = webDriver.findElements(common.reviewCount()).size();
    Assert.assertEquals(reviewerCount.toString(), "0");
  }

  @Test
  @Order(13)
  void removeAddedTagsToTerm() throws InterruptedException {
    openGlossaryPage();
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.containsText(glossaryName));
    Events.click(webDriver, common.containsText(termName));
    Events.click(webDriver, glossary.editGlossaryTag());
    for (int i = 0; i < 2; i++) {
      Events.click(webDriver, common.removeAssociatedTag());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(waitTime);
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
