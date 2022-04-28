/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.selenium.pages.topicDetails;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.ExplorePage;
import org.openmetadata.catalog.selenium.objectRepository.MyDataPage;
import org.openmetadata.catalog.selenium.objectRepository.TopicDetails;
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

@Slf4j
@Order(7)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TopicDetailsPageTest {
  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static Actions actions;
  static WebDriverWait wait;
  static String topic = "orders";
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  Common common;
  TopicDetails topicDetails;
  ExplorePage explorePage;
  MyDataPage myDataPage;
  int counter = 2;
  String xpath = "//li[@data-testid='breadcrumb-link'][" + counter + "]";
  String description = "Test@1234";
  Wait<WebDriver> fluentWait;

  @BeforeEach
  void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--no-sandbox");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    topicDetails = new TopicDetails(webDriver);
    explorePage = new ExplorePage(webDriver);
    myDataPage = new MyDataPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
    fluentWait =
        new FluentWait<WebDriver>(webDriver)
            .withTimeout(Duration.ofSeconds(30))
            .pollingEvery(Duration.ofSeconds(10))
            .ignoring(NoSuchElementException.class);
  }

  @Test
  @Order(1)
  void openExplorePage() {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, explorePage.explore());
    if (fluentWait.until(ExpectedConditions.presenceOfElementLocated(common.tableCount())).isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail();
    }
  }

  @Test
  @Order(2)
  void checkTabs() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.sendKeys(webDriver, common.searchBox(), topic);
    Events.click(webDriver, topicDetails.topicName());
    Events.click(webDriver, topicDetails.config());
    Events.click(webDriver, common.manage());
  }

  @Test
  @Order(3)
  void checkFollow() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.sendKeys(webDriver, common.searchBox(), topic);
    Events.click(webDriver, topicDetails.topicName());
    String follow = webDriver.findElement(common.follow()).getText();
    if (follow.equals("Unfollow")) {
      Events.click(webDriver, common.follow());
      Events.click(webDriver, common.follow());
    } else {
      Events.click(webDriver, common.follow());
    }
    Events.click(webDriver, myDataPage.home());
    if (!webDriver.getPageSource().contains(topic)) {
      Assert.fail(topic + "topic not found");
    } else {
      LOG.info("Passed");
    }
  }

  @Test
  @Order(4)
  void addTags() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, common.selectTableLink(3));
    Events.click(webDriver, topicDetails.addTag());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i < 3; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().refresh();
    Object tagCount = webDriver.findElements(topicDetails.breadCrumbTags()).size();
    Assert.assertEquals(tagCount, 3);
  }

  @Test
  @Order(5)
  void removeTags() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, common.selectTableLink(1));
    Object count = webDriver.findElements(topicDetails.breadCrumbTags()).size();
    Events.click(webDriver, topicDetails.addTag());
    try {
      Events.click(webDriver, common.removeAssociatedTag());
    } catch (TimeoutException e) {
      Assert.fail("Tag not found");
    }
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().refresh();
    Object updatedCount = webDriver.findElements(topicDetails.breadCrumbTags()).size();
    if (updatedCount.equals(count)) {
      Assert.fail("Tag not removed");
    } else {
      LOG.info("Tag removed successfully");
    }
  }

  @Test
  @Order(6)
  void editDescription() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String updatedDescription = faker.address().toString();
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, common.editDescriptionButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), description);
    Events.click(webDriver, common.editDescriptionSaveButton());
    webDriver.navigate().refresh();
    Events.click(webDriver, common.editDescriptionButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), updatedDescription);
    Events.click(webDriver, common.editDescriptionSaveButton());
    webDriver.navigate().refresh();
    String checkDescription = webDriver.findElement(topicDetails.descriptionContainer()).getText();
    if (!checkDescription.contains(updatedDescription)) {
      Assert.fail("Description not updated");
    } else {
      LOG.info("Description Updated");
    }
  }

  @Test
  @Order(7)
  void checkManage() {
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, common.selectTableLink(2));
    Events.click(webDriver, common.manage());
    Events.click(webDriver, common.ownerDropdown());
    Events.click(webDriver, common.users());
    String user = topicDetails.getOwnerName();
    Events.click(webDriver, common.selectUser());
    Events.click(webDriver, common.selectTier1());
    Events.click(webDriver, topicDetails.selectTier());
    String ownerName = webDriver.findElement(common.ownerDropdown()).getText();
    Assert.assertEquals(ownerName, user);
  }

  @Test
  @Order(8)
  void checkBreadCrumb() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, explorePage.selectTable());
    List<WebElement> br = common.breadCrumb();
    // Using for loop to check breadcrumb links
    // Since after navigating back we are facing StaleElementException using try catch block.
    for (WebElement link : br) {
      try {
        link.click();
        webDriver.navigate().back();
      } catch (StaleElementReferenceException ex) {
        WebElement breadcrumb_link = webDriver.findElement(By.xpath(xpath));
        breadcrumb_link.click();
      }
    }
  }

  @Test
  @Order(9)
  void checkVersion() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    int counter = 1;
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, common.version());
    List<WebElement> versionRadioButton = common.versionRadioButton();
    for (WebElement e : versionRadioButton) {
      counter = counter + 1;
      if (counter == versionRadioButton.size()) {
        break;
      }
      e.click();
      ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", e);
    }
    Events.click(webDriver, common.version());
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
