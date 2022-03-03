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
import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(7)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TopicDetailsPageTest {
  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static Actions actions;
  static WebDriverWait wait;
  static String topic = "orders";
  Integer waitTime = Property.getInstance().getSleepTime();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  Common common;
  TopicDetails topicDetails;
  ExplorePage explorePage;
  MyDataPage myDataPage;
  int counter = 2;
  String xpath = "//li[@data-testid='breadcrumb-link'][" + counter + "]";
  String description = "Test@1234";
  String updatedDescription = "Updated Description";

  @BeforeEach
  public void openMetadataWindow() {
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
  }

  @Test
  @Order(1)
  void openExplorePage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, explorePage.explore());
    Thread.sleep(3000);
    if (webDriver.findElement(common.tableCount()).isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail();
    }
  }

  @Test
  @Order(2)
  public void checkTabs() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.sendKeys(webDriver, common.searchBox(), topic);
    Events.click(webDriver, topicDetails.topicName());
    Events.click(webDriver, topicDetails.config());
    Events.click(webDriver, common.manage());
  }

  @Test
  @Order(3)
  void checkFollow() throws InterruptedException {
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
    String tableName = webDriver.findElement(myDataPage.following()).getText();
    Assert.assertEquals(tableName, "Started following " + topic);
  }

  @Test
  @Order(4)
  public void addTags() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, common.selectTableLink(3));
    Events.click(webDriver, topicDetails.addTag());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i < 3; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
      Thread.sleep(waitTime);
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(2000);
    webDriver.navigate().refresh();
    Thread.sleep(waitTime);
    Object tagCount = webDriver.findElements(topicDetails.breadCrumbTags()).size();
    Assert.assertEquals(tagCount, 3);
  }

  @Test
  @Order(5)
  void removeTags() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, explorePage.selectTable());
    Object count = webDriver.findElements(topicDetails.breadCrumbTags()).size();
    Events.click(webDriver, topicDetails.addTag());
    Events.click(webDriver, common.removeAssociatedTag());
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(2000);
    webDriver.navigate().refresh();
    Thread.sleep(2000);
    Object updatedCount = webDriver.findElements(topicDetails.breadCrumbTags()).size();
    if (updatedCount.equals(count)) {
      Assert.fail("Tag not removed");
    } else {
      LOG.info("Tag removed successfully");
    }
  }

  @Test
  @Order(6)
  void editDescription() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String updatedDescription = faker.address().toString();
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, common.editDescriptionButton());
    Events.sendKeys(webDriver, common.editDescriptionBox(), description);
    Thread.sleep(2000);
    Events.click(webDriver, common.editDescriptionSaveButton());
    Thread.sleep(2000);
    webDriver.navigate().refresh();
    Events.click(webDriver, common.editDescriptionButton());
    Events.sendKeys(webDriver, common.editDescriptionBox(), updatedDescription);
    Thread.sleep(2000);
    Events.click(webDriver, common.editDescriptionSaveButton());
    Thread.sleep(2000);
    webDriver.navigate().refresh();
    Thread.sleep(2000);
    String checkDescription = webDriver.findElement(common.descriptionContainer()).getText();
    if (!checkDescription.contains(updatedDescription)) {
      Assert.fail("Description not updated");
    } else {
      LOG.info("Description Updated");
    }
  }

  @Test
  @Order(7)
  public void checkManage() throws InterruptedException {
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, common.selectTableLink(1));
    Thread.sleep(waitTime);
    actions.perform();
    actions.click();
    Events.click(webDriver, common.manage());
    Events.click(webDriver, common.ownerDropdown());
    Events.click(webDriver, common.users());
    Events.click(webDriver, common.selectUser());
    Events.click(webDriver, common.selectTier1());
    Events.click(webDriver, common.saveManage());
  }

  @Test
  @Order(8)
  void checkBreadCrumb() throws Exception {
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
  public void checkVersion() throws InterruptedException {
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
      Thread.sleep(waitTime);
      ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", e);
    }
    Events.click(webDriver, common.version());
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
