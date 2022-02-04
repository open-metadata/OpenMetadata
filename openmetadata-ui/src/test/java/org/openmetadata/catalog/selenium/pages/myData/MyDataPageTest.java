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

package org.openmetadata.catalog.selenium.pages.myData;

import java.time.Duration;
import java.util.ArrayList;
import java.util.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(1)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MyDataPageTest {

  private static final Logger LOG = Logger.getLogger(MyDataPageTest.class.getName());

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static String table = "dim_address";
  Integer waitTime = Property.getInstance().getSleepTime();
  MyDataPage myDataPage;
  TagsPage tagsPage;
  TeamsPage teamsPage;
  UserListPage userListPage;
  TableDetails tableDetails;
  DatabaseServicePage databaseService;
  ExplorePage explorePage;
  Common common;
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  public void openMetadataWindow() {
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
    common = new Common(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void checkWhatsNew() {
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.openWhatsNew());
    Events.click(webDriver, myDataPage.page2());
    Events.click(webDriver, myDataPage.changeLog());
    try {
      WebElement version = webDriver.findElement(myDataPage.getVersion());
      Assert.assertTrue(version.isDisplayed());
    } catch (Exception e) {
      Assert.fail();
    }
  }

  @Test
  @Order(2)
  void checkOverview() {
    MyDataPage myDataPage = new MyDataPage(webDriver);
    String url;
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.getTables());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/tables/");
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.getTopics());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/topics/");
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.getDashboard());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/dashboards/");
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.getPipelines());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/pipelines/");
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.getServices());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/services");
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.getUsers());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/user-list");
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.getTeams());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/teams");
  }

  @Test
  @Order(3)
  public void checkSearchBar() throws InterruptedException {
    String sendkeys = "dim";
    Events.click(webDriver, myDataPage.closeWhatsNew());
    wait.until(ExpectedConditions.elementToBeClickable(myDataPage.getSearchBox())); // Search bar/dim
    Events.sendKeys(webDriver, myDataPage.getSearchBox(), sendkeys); // Search bar/dim
    Events.click(webDriver, myDataPage.selectTable());
    Thread.sleep(1000);
    WebElement tableName =
        tableDetails
            .breadCrumb()
            .get(tableDetails.breadCrumb().size() - 1); // getting the last element as it would match the table name
    Assert.assertTrue(tableName.getText().contains(sendkeys));
  }

  @Test
  @Order(4)
  void checkExplore() {
    String url;
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.clickExplore());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/tables");
    try {
      if (webDriver.findElement(explorePage.tables()).isDisplayed()) {
        LOG.info("Tables is displayed");
      }
    } catch (Exception e) {
      Assert.fail();
    }
  }

  @Test
  @Order(5)
  void checkHeaders() {
    String url;
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.openSettings());
    Events.click(webDriver, myDataPage.getTeams());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/teams");
    try {
      if (teamsPage.heading().isDisplayed()) {
        LOG.info("Teams Heading is displayed");
      }
    } catch (Exception e) {
      Assert.fail();
    }
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.openSettings());
    Events.click(webDriver, myDataPage.getUsers());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/user-list");
    try {
      if (userListPage.allUsers().isDisplayed()) {
        LOG.info("All users is displayed");
      }
    } catch (Exception e) {
      Assert.fail();
    }
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.openSettings());
    Events.click(webDriver, myDataPage.getTags());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/tags");
    try {
      if (webDriver.findElement(tagsPage.addTagButton()).isDisplayed()) {
        LOG.info("Tag categories is displayed");
      }
    } catch (Exception e) {
      Assert.fail();
    }
    webDriver.navigate().back();
    Events.click(webDriver, myDataPage.openSettings());
    Events.click(webDriver, myDataPage.getServices());
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/services");
    try {
      if (webDriver.findElement(common.serviceName()).isDisplayed()) {
        LOG.info("Database Service is displayed");
      }
    } catch (Exception e) {
      Assert.fail();
    }
    webDriver.navigate().back();
  }

  @Test
  @Order(6)
  public void checkMyDataTab() {
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.getTables());
    Events.sendKeys(webDriver, myDataPage.getSearchBox(), table);
    Events.click(webDriver, myDataPage.selectTable());
    Events.click(webDriver, tableDetails.manage());
    Events.click(webDriver, tableDetails.clickOwnerDropdown()); // Owner
    Events.click(webDriver, tableDetails.clickUsers());
    Events.click(webDriver, tableDetails.selectUser());
    Events.click(webDriver, tableDetails.saveManage());
    Events.click(webDriver, myDataPage.clickHome());
    webDriver.navigate().refresh();
    try {
      WebElement tableName = wait.until(ExpectedConditions.presenceOfElementLocated(By.linkText(table)));
      if (tableName.isDisplayed()) {
        Assert.assertEquals(tableName.getText(), "dim_address");
        webDriver.findElement(By.linkText(table)).click();
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Test
  @Order(7)
  void checkFollowingTab() {
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.getTables());
    Events.sendKeys(webDriver, myDataPage.getSearchBox(), table);
    Events.click(webDriver, myDataPage.selectTable());
    String follow = webDriver.findElement(tableDetails.clickFollow()).getText();
    if (follow.equals("Unfollow")) {
      Events.click(webDriver, tableDetails.clickFollow());
      Events.click(webDriver, tableDetails.clickFollow());
    } else {
      Events.click(webDriver, tableDetails.clickFollow());
    }
    Events.click(webDriver, myDataPage.clickHome());
    String tableName = myDataPage.following().toString();
    Assert.assertEquals(tableName, "Started Following " + table);
  }

  @Test
  @Order(8)
  void checkRecentlyViewed() {
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.sendKeys(webDriver, myDataPage.getSearchBox(), table);
    Events.click(webDriver, myDataPage.selectTable());
    Events.click(webDriver, myDataPage.clickHome());
    webDriver.navigate().refresh();
    String table = webDriver.findElement(myDataPage.recentlyViewed()).getText();
    Assert.assertEquals(table, "dim_address");
  }

  @Test
  @Order(8)
  public void checkRecentlySearched() {
    String searchCriteria = "dim";
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.sendKeys(webDriver, myDataPage.getSearchBox(), searchCriteria);
    Events.sendEnter(webDriver, myDataPage.getSearchBox());
    Events.click(webDriver, myDataPage.clickHome());
    try {
      WebElement recentSearch = webDriver.findElement(myDataPage.recentSearch());
      if (recentSearch.isDisplayed()) {
        Assert.assertEquals(recentSearch.getText(), searchCriteria);
      }
    } catch (Exception e) {
      Assert.fail();
    }
  }

  @Test
  @Order(9)
  public void checkRecentSearchWithSpaces() throws Exception {
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.sendKeys(webDriver, myDataPage.getSearchBox(), " ");
    Events.sendEnter(webDriver, myDataPage.getSearchBox());
    Events.click(webDriver, myDataPage.clickHome());
    try {
      WebElement spaceSearch = webDriver.findElement(myDataPage.recentSearchWithSpace());
      if (spaceSearch.isDisplayed()) {
        Assert.fail("Spaces are displayed in recent search terms");
      }
    } catch (TimeoutException exception) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(10)
  public void checkHelp() throws InterruptedException {
    ArrayList<String> tabs = new ArrayList<String>(webDriver.getWindowHandles());
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.help());
    Events.click(webDriver, myDataPage.docs());
    webDriver.switchTo().window(tabs.get(0));
    Events.click(webDriver, myDataPage.help());
    Events.click(webDriver, myDataPage.api());
    webDriver.navigate().back();
    webDriver.switchTo().window(tabs.get(0));
    Events.click(webDriver, myDataPage.help());
    Thread.sleep(1000);
    Events.click(webDriver, myDataPage.slack());
    Thread.sleep(1000);
    webDriver.switchTo().window(tabs.get(0));
  }

  @Test
  @Order(11)
  public void checkLogout() {
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, myDataPage.profile());
    Events.click(webDriver, myDataPage.userName());
    Events.click(webDriver, myDataPage.logout());
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
