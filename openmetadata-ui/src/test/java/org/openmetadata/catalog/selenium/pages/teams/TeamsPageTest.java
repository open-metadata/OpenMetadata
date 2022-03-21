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
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(2)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TeamsPageTest {

  static WebDriver webDriver;
  static String URL = Property.getInstance().getURL();
  Integer waitTime = Property.getInstance().getSleepTime();
  static Faker faker = new Faker();
  static String teamDisplayName = faker.name().lastName();
  static Actions actions;
  static WebDriverWait wait;
  Common common;
  TeamsPage teamsPage;
  ExplorePage explorePage;
  MyDataPage myDataPage;
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  String xpath = "//p[@title = '" + teamDisplayName + "']";

  @BeforeEach
  public void openMetadataWindow() {
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
  }

  @Test
  @Order(1)
  public void openTeamsPage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, teamsPage.teams()); // Setting/Teams
    Thread.sleep(waitTime);
    Assert.assertTrue(teamsPage.heading().isDisplayed());
  }

  @Test
  @Order(2)
  public void createTeam() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, teamsPage.teams());
    Events.click(webDriver, teamsPage.addTeam()); // add team
    Events.sendKeys(webDriver, teamsPage.name(), faker.name().firstName()); // name
    Events.sendKeys(webDriver, teamsPage.displayName(), teamDisplayName); // displayname
    Events.sendKeys(webDriver, teamsPage.enterDescription(), faker.address().toString());
    Events.click(webDriver, teamsPage.saveTeam());
    Thread.sleep(waitTime);
    webDriver.navigate().refresh();
    Thread.sleep(waitTime);
    try {
      webDriver.findElement(By.xpath(xpath));
    } catch (NoSuchElementException e) {
      Assert.fail("Team not added");
      System.out.println("xpath" + xpath);
    }
  }

  @Test
  @Order(3)
  public void addUser() throws InterruptedException {
    int counter = 1;
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    createTeam();
    Events.click(webDriver, By.xpath(xpath));
    Events.click(webDriver, teamsPage.addNewUser());
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
      Thread.sleep(waitTime);
    }
    Events.click(webDriver, teamsPage.saveUser());
    Thread.sleep(waitTime);
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
  public void editDescription() throws InterruptedException {
    String sendKeys = faker.address().toString();
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    createTeam();
    // Select the created listed team
    Events.click(webDriver, By.xpath(xpath));
    Events.click(webDriver, teamsPage.editDescription());
    wait.until(ExpectedConditions.presenceOfElementLocated(teamsPage.enterDescription()));
    Events.click(webDriver, teamsPage.enterDescription());
    Events.sendKeys(webDriver, teamsPage.enterDescription(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, teamsPage.enterDescription(), sendKeys);
    Events.click(webDriver, teamsPage.saveDescription());
    String description = webDriver.findElement(common.descriptionContainer()).getText();
    Thread.sleep(2000);
    Assert.assertEquals(description, sendKeys);
  }

  @Test
  @Order(5)
  public void addAsset() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    createTeam();
    Thread.sleep(waitTime);
    // Select the created listed team
    Events.click(webDriver, By.xpath(xpath));
    Events.click(webDriver, teamsPage.asset()); // Assets
    Events.click(webDriver, explorePage.explore()); // Explore
    String table = webDriver.findElement(common.selectTable()).getText();
    Events.click(webDriver, common.selectTable());
    Events.click(webDriver, common.manage()); // Manage
    Events.click(webDriver, common.ownerDropdown()); // Owner
    Events.sendKeys(webDriver, teamsPage.searchInput(), teamDisplayName);
    Events.click(webDriver, common.selectUser()); // Select User/Team
    Events.click(webDriver, common.saveManage()); // Save
    Thread.sleep(waitTime);
    Events.click(webDriver, myDataPage.home());
    Events.click(webDriver, teamsPage.teams());
    Events.click(webDriver, By.xpath(xpath));
    Thread.sleep(waitTime);
    Events.click(webDriver, teamsPage.asset());
    String asset = webDriver.findElement(teamsPage.dataContainer()).getText();
    if (!asset.contains(table)) {
      Assert.fail("Asset not added");
    }
  }

  @Test
  @Order(6)
  public void ownerNameIsConsistentCheck() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    addAsset();
    // Select the created listed team
    Events.click(webDriver, By.xpath(xpath));
    Thread.sleep(waitTime);
    // Events.click(webDriver,teamsPage.getAsset());
    Events.click(webDriver, teamsPage.dataContainer());
    Thread.sleep(waitTime);
    String ownerName = webDriver.findElement(teamsPage.ownerName()).getText();
    Events.click(webDriver, teamsPage.ownerLink());
    String displayName = webDriver.findElement(By.xpath(xpath)).getText();
    if (!ownerName.equalsIgnoreCase(displayName)) {
      Assert.fail();
    }
  }

  @Test
  @Order(7)
  public void checkTeamsFilterCount() throws InterruptedException {
    for (int i = 0; i < 5; i++) {
      createTeam();
      webDriver.navigate().back();
      Events.click(webDriver, myDataPage.openWhatsNew()); // What's New
    }
    Events.click(webDriver, common.closeWhatsNew());
    String teamsListCount = String.valueOf(webDriver.findElements(teamsPage.teamsCount()).size());
    Thread.sleep(waitTime);
    Events.click(webDriver, myDataPage.home());
    Thread.sleep(waitTime);
    String teamsFilterCount = webDriver.findElement(teamsPage.teamsFilterCount()).getText();
    Events.click(webDriver, explorePage.explore()); // Tables
    Events.click(webDriver, common.selectTable());
    Events.click(webDriver, common.manage()); // Manage
    Events.click(webDriver, common.ownerDropdown()); // Owner
    Thread.sleep(waitTime);
    String teamsCount = webDriver.findElement(teamsPage.teamsDropdownCount()).getText();
    if (!teamsCount.equals(teamsListCount) && teamsListCount.equals(teamsFilterCount)) {
      Assert.fail("Team count is mismatched");
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
