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

package org.openmetadata.catalog.selenium.pages.tableDetails;

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
import org.openmetadata.catalog.selenium.objectRepository.TableDetails;
import org.openmetadata.catalog.selenium.objectRepository.TagsPage;
import org.openmetadata.catalog.selenium.objectRepository.TeamsPage;
import org.openmetadata.catalog.selenium.objectRepository.TopicDetails;
import org.openmetadata.catalog.selenium.objectRepository.UserListPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(4)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TableDetailsPageTest {
  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static String searchSuggestion = "sample_dataecommerce_dbshopifydim_location";
  Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  String tableName = "dim_address";
  int counter = 2;
  String xpath = "//li[@data-testid='breadcrumb-link'][" + counter + "]";
  MyDataPage myDataPage;
  TagsPage tagsPage;
  TeamsPage teamsPage;
  UserListPage userListPage;
  TableDetails tableDetails;
  ExplorePage explorePage;
  TopicDetails topicDetails;
  Common common;
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    myDataPage = new MyDataPage(webDriver);
    userListPage = new UserListPage(webDriver);
    teamsPage = new TeamsPage(webDriver);
    tagsPage = new TagsPage(webDriver);
    tableDetails = new TableDetails(webDriver);
    explorePage = new ExplorePage(webDriver);
    topicDetails = new TopicDetails(webDriver);
    common = new Common(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  void openExplorePage() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, explorePage.explore());
    if (webDriver.findElement(explorePage.tableCount()).isDisplayed()) {
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
    Events.sendKeys(webDriver, myDataPage.searchBox(), tableName);
    Events.click(webDriver, common.selectSuggestionSearch("sample_dataecommerce_dbshopifydim_address"));
    Events.click(webDriver, tableDetails.profiler());
    Assert.assertTrue(tableDetails.schemaTableIsDisplayed());
    Events.click(webDriver, tableDetails.lineage());
    WebElement lineage = tableDetails.lineageNodes().get(1);
    Assert.assertTrue(lineage.isDisplayed());
    Events.click(webDriver, tableDetails.sampleData());
    WebElement sampleDataTable = webDriver.findElement(tableDetails.sampleDataTable());
    Assert.assertTrue(sampleDataTable.isDisplayed());
    Events.click(webDriver, tableDetails.manage());
    WebElement ownerDropdown = webDriver.findElement(tableDetails.owner());
    Assert.assertTrue(ownerDropdown.isDisplayed());
  }

  @Test
  @Order(3)
  void editDescription() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String updatedDescription = faker.address().toString();
    openExplorePage();
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, tableDetails.editDescriptionButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), updatedDescription);
    Events.click(webDriver, tableDetails.saveTableDescription());
    webDriver.navigate().refresh();
    String description = webDriver.findElement(tableDetails.descriptionBox()).getText();
    if (!description.contains(updatedDescription)) {
      Assert.fail("Description not updated");
    } else {
      LOG.info("Description Updated");
    }
  }

  @Test
  @Order(4)
  void searchColumnAndEditDescription() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    String sendKeys = "Description Added";
    Events.click(webDriver, explorePage.selectTable());
    for (int i = 0; i < 1; i++) {
      actions.moveToElement(webDriver.findElement(tableDetails.columnDescriptionButton())).perform();
      Events.click(webDriver, tableDetails.columnDescriptionButton());
      Events.sendKeys(webDriver, common.focusedDescriptionBox(), sendKeys);
      Events.click(webDriver, tableDetails.saveTableDescription());
      webDriver.navigate().refresh();
    }
    try {
      String verifyDescription = webDriver.findElement(tableDetails.columnDescription()).getText();
      if (!verifyDescription.contains(sendKeys)) {
        Assert.fail("Description not updated");
      } else {
        LOG.info("Description Updated");
      }
    } catch (NoSuchElementException e) {
      Assert.fail("Element column description not found");
    }
  }

  @Test
  @Order(5)
  void addTagsToColumn() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, common.selectTableLink(3));
    ((JavascriptExecutor) webDriver)
        .executeScript("arguments[0].scrollIntoView(true);", webDriver.findElement(explorePage.addTag()));
    Events.click(webDriver, explorePage.addTag());
    for (int i = 0; i < 2; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().refresh();
    Object tagCount = webDriver.findElements(topicDetails.breadCrumbTags()).size();
    Assert.assertEquals(tagCount, 2);
  }

  @Test
  @Order(6)
  void removeTags() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, common.selectTableLink(1));
    Object count = webDriver.findElements(tableDetails.columnTags()).size();
    Events.click(webDriver, tableDetails.editTags());
    Events.click(webDriver, tableDetails.removeTag());
    Events.click(webDriver, tableDetails.saveTag());
    webDriver.navigate().refresh();
    Object updatedCount = webDriver.findElements(tableDetails.columnTags());
    if (updatedCount.equals(count)) {
      Assert.fail("Tag not removed");
    } else {
      LOG.info("Tag removed successfully");
    }
  }

  @Test
  @Order(7)
  void checkProfiler() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    ExplorePage explorePage = new ExplorePage(webDriver);
    TableDetails tableDetails = new TableDetails(webDriver);
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
    openExplorePage();
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, tableDetails.profiler());
    Assert.assertTrue(tableDetails.schemaTableIsDisplayed());
  }

  @Test
  @Order(8)
  void checkManage() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.manage());
    Events.click(webDriver, tableDetails.owner());
    Events.click(webDriver, tableDetails.selectUser());
    Events.click(webDriver, tableDetails.selectTier1());
    Events.click(webDriver, tableDetails.selectTier());
  }

  @Test
  @Order(9)
  void checkLineage() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, tableDetails.lineage());
    List<WebElement> nodes = tableDetails.lineageNodes();
    // Clicking and checking all the nodes text matches to side drawer text
    for (WebElement e : nodes) {
      e.click();
      Events.click(webDriver, tableDetails.closeSideDrawer());
    }
    actions.dragAndDropBy(webDriver.findElement(tableDetails.lineageNode()), 100, 200).perform();
  }

  @Test
  @Order(10)
  void checkBreadCrumb() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.selectTable());
    List<WebElement> br = tableDetails.breadCrumb();
    // Using for loop to check breadcrumb links
    // Since after navigating back we are facing StaleElementException using try catch block.
    for (WebElement link : br) {
      try {
        link.click();
        Assert.assertTrue(link.isDisplayed());
      } catch (StaleElementReferenceException ex) {
        webDriver.navigate().back();
        Events.click(webDriver, By.xpath(xpath));
        Assert.assertTrue(webDriver.findElement(By.xpath(xpath)).isDisplayed());
        break;
      }
    }
  }

  @Test
  @Order(11)
  void checkVersion() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, tableDetails.version());
    List<WebElement> versionGrid = tableDetails.versionDetailsGrid();
    List<WebElement> versionRadioButton = tableDetails.versionRadioButton();
    for (WebElement e : versionRadioButton) {
      e.click();
      ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", e);
    }
    Events.click(webDriver, tableDetails.version());
    Events.click(webDriver, myDataPage.openWhatsNew());
  }

  @Test
  @Order(12)
  void checkFrequentlyJoinedTables() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.sendKeys(webDriver, myDataPage.searchBox(), "dim_location");
    Events.click(webDriver, common.selectSuggestionSearch(searchSuggestion));
    try {
      Events.click(webDriver, tableDetails.joinedTables());
    } catch (NoSuchElementException | TimeoutException e) {
      Assert.fail("No Frequently joined tables found");
    }
  }

  @Test
  @Order(13)
  void checkFrequentlyJoinedColumns() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.sendKeys(webDriver, myDataPage.searchBox(), "dim_location");
    Events.click(webDriver, common.selectSuggestionSearch(searchSuggestion));
    try {
      Events.click(webDriver, tableDetails.joinedColumns());
    } catch (NoSuchElementException | TimeoutException e) {
      Assert.fail("No Frequently joined columns found");
    }
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
