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

package org.openmetadata.catalog.selenium.pages.teams;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.catalog.selenium.objectRepository.TeamsPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.Keys;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.FluentWait;
import org.openqa.selenium.support.ui.Wait;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(2)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TeamsPageTest {

  static WebDriver webDriver;
  static String URL = Property.getInstance().getURL();
  Integer waitTime = Property.getInstance().getSleepTime();
  static Faker faker = new Faker();
  static String teamDisplayName = faker.name().lastName();
  static String teamName = faker.name().lastName();
  static Actions actions;
  static WebDriverWait wait;
  Common common;
  TeamsPage teamsPage;
  ExplorePage explorePage;
  MyDataPage myDataPage;
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
    actions = new Actions(webDriver);
    common = new Common(webDriver);
    teamsPage = new TeamsPage(webDriver);
    explorePage = new ExplorePage(webDriver);
    myDataPage = new MyDataPage(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(URL);
    fluentWait =
        new FluentWait<WebDriver>(webDriver)
            .withTimeout(Duration.ofSeconds(10))
            .pollingEvery(Duration.ofSeconds(10))
            .ignoring(NoSuchElementException.class);
  }

  @Test
  @Order(1)
  void openTeamsPage() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, teamsPage.teams()); // Setting/Teams
    fluentWait.until(ExpectedConditions.visibilityOfElementLocated(teamsPage.addTeam()));
    Assert.assertTrue(teamsPage.heading().isDisplayed());
  }

  @Test
  @Order(2)
  void createTeam() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, teamsPage.teams());
    Events.click(webDriver, teamsPage.addTeam()); // add team
    Events.sendKeys(webDriver, teamsPage.name(), teamName); // name
    Events.sendKeys(webDriver, teamsPage.displayName(), teamDisplayName); // displayname
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, teamsPage.saveTeam());
    webDriver.navigate().refresh();
    try {
      Events.click(webDriver, common.containsText(teamDisplayName));
    } catch (NoSuchElementException e) {
      Assert.fail("Team not added");
    }
  }

  @Test
  @Order(3)
  void addUser() {
    int counter = 1;
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openTeamsPage();
    Events.click(webDriver, common.containsText(teamDisplayName));
    Events.click(webDriver, common.containsText("Add new user"));
    List<WebElement> checkbox = teamsPage.checkboxAddUser();
    List<String> selectedUser = new ArrayList<>();
    // Select the created listed team
    for (WebElement c : checkbox) {
      c.click();
      selectedUser.add(webDriver.findElement(teamsPage.selectedUser()).getText());
      counter = counter + 1;
      if (counter == 10) {
        break;
      }
    }
    Events.click(webDriver, teamsPage.saveUser());
    webDriver.navigate().refresh();
    List<WebElement> checkUser = webDriver.findElements(teamsPage.selectedUser());
    List<String> getUser = new ArrayList<>();
    for (WebElement c : checkUser) {
      getUser.add(c.getText());
    }
    for (int i = 1; i <= checkUser.size(); i++) {
      if (selectedUser.size() != getUser.size()) {
        Assert.fail("User Not added");
      }
    }
  }

  @Test
  @Order(4)
  void editDescription() throws InterruptedException {
    String sendKeys = faker.address().toString();
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openTeamsPage();
    // Select the created listed team
    Events.click(webDriver, common.containsText(teamDisplayName));
    Events.click(webDriver, teamsPage.editDescription());
    wait.until(ExpectedConditions.presenceOfElementLocated(common.focusedDescriptionBox()));
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), sendKeys);
    Events.click(webDriver, teamsPage.saveDescription());
    String description = webDriver.findElement(teamsPage.descriptionContainer()).getText();
    Assert.assertEquals(description, sendKeys);
  }

  @Test
  @Order(5)
  void addAsset() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openTeamsPage();
    Events.click(webDriver, common.containsText(teamDisplayName));
    Events.click(webDriver, teamsPage.asset()); // Assets
    Events.click(webDriver, explorePage.explore()); // Explore
    Events.click(webDriver, common.selectTableLink(4));
    String tableName = webDriver.findElement(teamsPage.tableName()).getText();
    webDriver.navigate().refresh();
    Events.click(webDriver, common.manage()); // Manage
    Events.click(webDriver, common.ownerDropdown()); // Owner
    Events.sendKeys(webDriver, teamsPage.searchInput(), teamDisplayName);
    Events.click(webDriver, common.selectUser()); // Select User/Team
    Events.click(webDriver, myDataPage.home());
    Events.click(webDriver, teamsPage.teams());
    Events.click(webDriver, common.containsText(teamDisplayName));
    Events.click(webDriver, teamsPage.asset());
    String asset =
        wait.until(ExpectedConditions.visibilityOf(webDriver.findElement(teamsPage.dataContainer()))).getText();
    if (!asset.contains(tableName)) {
      Assert.fail("Asset not added");
    }
  }

  @Test
  @Order(6)
  void ownerNameIsConsistentCheck() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openTeamsPage();
    // Select the created listed team
    Events.click(webDriver, common.containsText(teamDisplayName));
    // Events.click(webDriver,teamsPage.getAsset());
    Events.click(webDriver, common.manage());
    Events.click(webDriver, teamsPage.ownerDropdown());
    String ownerName = webDriver.findElement(teamsPage.selectOwner()).getText();
    Events.click(webDriver, teamsPage.selectOwner());
    webDriver.navigate().refresh();
    if (!webDriver.findElement(teamsPage.ownerName(ownerName)).isDisplayed()) {
      Assert.fail("Owner not added");
    }
  }

  @Test
  @Order(7)
  void checkTeamsFilterCount() {
    String teamName = faker.name().firstName();
    String teamDisplayName = faker.name().firstName();
    Events.click(webDriver, common.closeWhatsNew());
    String myDataTeamsCount = webDriver.findElement(teamsPage.myDataTeamsCount()).getText();
    Events.click(webDriver, teamsPage.teams());
    Events.click(webDriver, teamsPage.addTeam()); // add team
    Events.sendKeys(webDriver, teamsPage.name(), teamName); // name
    Events.sendKeys(webDriver, teamsPage.displayName(), teamDisplayName); // displayname
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, teamsPage.saveTeam());
    Events.click(webDriver, myDataPage.home());
    Events.waitForElementToDisplay(webDriver, teamsPage.myDataTeamsCount(), 10);
    String updatedCount = webDriver.findElement(teamsPage.myDataTeamsCount()).getText();
    if (updatedCount.equals(myDataTeamsCount)) {
      Assert.fail("Team filter not updated");
    }
  }

  // DO NOT DELETE
  /*@Test
  @Order(8)
  public void teamsWithSameDisplayNameCheck() throws Exception {
    String firstName = faker.name().firstName();
    String displayName = teamDisplayName;
    String[] checkTeams;
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openTeamsPage();
    for (int i = 0; i < 2; i++) {
      Events.click(webDriver, teamsPage.addTeam()); // add team
      Events.sendKeys(webDriver, teamsPage.name(), firstName); // name
      Events.sendKeys(webDriver, teamsPage.displayName(), teamDisplayName); // displayname
      Events.sendKeys(webDriver, teamsPage.editDescription(), faker.address().toString());
      Events.click(webDriver, teamsPage.saveTeam());
      Thread.sleep(waitTime);
    }
    Thread.sleep(waitTime);
    WebElement errorMessage = webDriver.findElement(teamsPage.errorMessage());
    if (!errorMessage.isDisplayed()) {
      Assert.fail();
    }
    webDriver.navigate().back();
    Events.click(webDriver, teamsPage.teams());
    List<WebElement> teamsList = webDriver.findElements(teamsPage.teamsCount());
    List<String> teamNames = new ArrayList<>();
    for (WebElement e : teamsList) {
      teamNames.add(e.getText());
    }
    checkTeams = new String[teamNames.size()];
    checkTeams = teamNames.toArray(checkTeams);
    for (int i = 0; i < checkTeams.length - 1; i++) {
      if (checkTeams[i].equals(checkTeams[i + 1])) {
        Assert.fail("2 teams with same name exists");
      }
    }
  }*/

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
