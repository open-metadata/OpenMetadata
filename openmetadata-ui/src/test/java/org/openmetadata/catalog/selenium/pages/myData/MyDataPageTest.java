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

  WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static String table = "dim_address";
  Integer waitTime = Property.getInstance().getSleepTime();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver();
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void checkWhatsNew() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    myDataPage.closeWhatsNew().click();
    myDataPage.openWhatsNew().click();
    myDataPage.page2();
    myDataPage.changeLog().click();
    try {
      String version = myDataPage.getVersion();
      Assert.assertEquals(version, "v0.7.0");
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Test
  @Order(2)
  public void checkOverview() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    String url;
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    myDataPage.closeWhatsNew().click();
    myDataPage.getTables().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/tables");
    webDriver.navigate().back();
    myDataPage.getTopics().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/topics");
    webDriver.navigate().back();
    myDataPage.getDashboard().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/dashboards");
    webDriver.navigate().back();
    myDataPage.getPipelines().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/pipelines");
    webDriver.navigate().back();
    myDataPage.getServices().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/services");
    webDriver.navigate().back();
    myDataPage.getIngestion().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/ingestion");
    webDriver.navigate().back();
    myDataPage.getUsers().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/teams");
    webDriver.navigate().back();
    myDataPage.getTeams().click();
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/teams");
  }

  @Test
  @Order(3)
  public void checkSearchBar() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    wait.until(ExpectedConditions.elementToBeClickable(myDataPage.getSearchBox())); // Search bar/dim
    myDataPage.getSearchBox().sendKeys("dim"); // Search bar/dim
    Thread.sleep(1000);
    myDataPage.selectTable().click(); // Search bar/dim
    Thread.sleep(1000);
  }

  @Test
  public void checkExplore() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    String url;
    explorePage explorePage = new explorePage(webDriver);
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    myDataPage.clickExplore().click();
    Thread.sleep(1000);
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/explore/tables");
    try {
      if (explorePage.tables().isDisplayed()) {
        LOG.info("Tables is displayed");
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Test
  @Order(4)
  public void checkHeaders() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    tagsPage tagsPage = new tagsPage(webDriver);
    servicesPage servicesPage = new servicesPage(webDriver);
    teamsPage teamsPage = new teamsPage(webDriver);
    ingestionPage ingestionPage = new ingestionPage(webDriver);
    userListPage userListPage = new userListPage(webDriver);
    String url;
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    myDataPage.openSettings().click();
    Thread.sleep(1000);
    myDataPage.getTeams().click();
    Thread.sleep(1000);
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/teams");
    try {
      if (teamsPage.heading().isDisplayed()) {
        LOG.info("Teams Heading is displayed");
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    webDriver.navigate().back();
    Thread.sleep(1000);
    myDataPage.openSettings().click();
    Thread.sleep(1000);
    myDataPage.getUsers().click();
    Thread.sleep(1000);
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/user-list");
    try {
      if (userListPage.allUsers().isDisplayed()) {
        LOG.info("All users is displayed");
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    webDriver.navigate().back();
    Thread.sleep(1000);
    myDataPage.openSettings().click();
    Thread.sleep(1000);
    myDataPage.getTags().click();
    Thread.sleep(1000);
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/tags");
    try {
      if (tagsPage.tagCategories().isDisplayed()) {
        LOG.info("Tag categories is displayed");
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    webDriver.navigate().back();
    Thread.sleep(1000);
    myDataPage.openSettings().click();
    Thread.sleep(1000);
    myDataPage.getServices().click();
    Thread.sleep(1000);
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/services");
    try {
      if (servicesPage.databaseService().isDisplayed()) {
        LOG.info("Database Service is displayed");
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    webDriver.navigate().back();
    myDataPage.openSettings().click();
    Thread.sleep(1000);
    myDataPage.getIngestions().click();
    Thread.sleep(1000);
    url = webDriver.getCurrentUrl();
    Assert.assertEquals(url, "http://localhost:8585/ingestion");
    try {
      if (ingestionPage.addIngestion().isDisplayed()) {
        LOG.info("Ingestion button is displayed");
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Test
  @Order(5)
  public void checkMyDataTab() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    tableDetails tableDetails = new tableDetails(webDriver);
    myDataPage.closeWhatsNew().click();
    myDataPage.getTables().click();
    myDataPage.getSearchBox().sendKeys(table);
    myDataPage.selectTable().click();
    Thread.sleep(1000);
    tableDetails.manage().click();
    Thread.sleep(1000);
    tableDetails.clickOwnerDropdown().click(); // Owner
    tableDetails.clickUsers().click();
    tableDetails.selectUser().click();
    tableDetails.saveManage().click();
    myDataPage.clickHome().click();
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
  @Order(6)
  public void checkFollowingTab() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    tableDetails tableDetails = new tableDetails(webDriver);
    myDataPage.closeWhatsNew().click();
    myDataPage.getTables().click();
    myDataPage.getSearchBox().sendKeys(table);
    myDataPage.selectTable().click();
    Thread.sleep(1000);
    // Events.click(webDriver, By.id("tabledatacard1Title"));
    String follow = tableDetails.clickFollow().getText();
    if (follow.equals("Unfollow")) {
      tableDetails.clickFollow().click();
      Thread.sleep(1000);
      tableDetails.clickFollow().click();
    } else {
      tableDetails.clickFollow().click();
    }
    Thread.sleep(2000);
    myDataPage.clickHome().click();
    Thread.sleep(1000);
    String tableName = myDataPage.following().getText();
    Assert.assertEquals(tableName, "Started Following " + table);
  }

  @Test
  @Order(7)
  public void checkRecentlyViewed() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    myDataPage.closeWhatsNew().click();
    myDataPage.getSearchBox().sendKeys(table);
    myDataPage.selectTable().click();
    myDataPage.clickHome().click();
    webDriver.navigate().refresh();
    Thread.sleep(1000);
    String table = myDataPage.recentlyViewed().getText();
    Assert.assertEquals(table, "dim_address");
  }

  @Test
  @Order(8)
  public void checkRecentlySearched() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    String searchCriteria = "dim";
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    myDataPage.getSearchBox().sendKeys(searchCriteria);
    Thread.sleep(1000);
    myDataPage.getSearchBox().sendKeys(Keys.ENTER);
    Thread.sleep(1000);
    myDataPage.clickHome().click();
    Thread.sleep(1000);
    try {
      WebElement recentSearch = myDataPage.recentSearch();
      if (recentSearch.isDisplayed()) {
        Assert.assertEquals(recentSearch.getText(), searchCriteria);
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Test
  @Order(9)
  public void checkRecentSearchWithSpaces() throws Exception {
    myDataPage myDataPage = new myDataPage(webDriver);
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    myDataPage.getSearchBox().sendKeys(" ");
    Thread.sleep(1000);
    myDataPage.getSearchBox().sendKeys(Keys.ENTER);
    Thread.sleep(1000);
    myDataPage.clickHome().click();
    Thread.sleep(1000);
    try {
      WebElement spaceSearch = myDataPage.recentSearchWithSpace();
      if (spaceSearch.isDisplayed()) {
        throw new Exception("Spaces are captured in Recent Search");
      }
    } catch (TimeoutException exception) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(10)
  public void checkHelp() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    ArrayList<String> tabs = new ArrayList<String>(webDriver.getWindowHandles());
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    myDataPage.help().click();
    Thread.sleep(1000);
    myDataPage.docs().click();
    webDriver.switchTo().window(tabs.get(0));
    Thread.sleep(1000);
    myDataPage.help().click();
    Thread.sleep(1000);
    myDataPage.api().click();
    webDriver.navigate().back();
    Thread.sleep(1000);
    webDriver.switchTo().window(tabs.get(0));
    myDataPage.help().click();
    Thread.sleep(1000);
    myDataPage.slack().click();
    Thread.sleep(1000);
    webDriver.switchTo().window(tabs.get(0));
  }

  @Test
  @Order(11)
  public void checkLogout() throws InterruptedException {
    myDataPage myDataPage = new myDataPage(webDriver);
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    myDataPage.profile().click();
    Thread.sleep(1000);
    myDataPage.userName().isDisplayed();
    Thread.sleep(1000);
    myDataPage.logout().click();
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
