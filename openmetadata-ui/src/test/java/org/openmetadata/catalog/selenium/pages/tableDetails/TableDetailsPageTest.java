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

import org.junit.jupiter.api.*;
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

@Order(4)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TableDetailsPageTest {
    WebDriver webDriver;
    static String url = Property.getInstance().getURL();
    static Faker faker = new Faker();
    static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
    Actions actions;
    static WebDriverWait wait;
    Integer waitTime = Property.getInstance().getSleepTime();
    String tableName = "dim_address";
    int counter = 2;
    String xpath = "//li[@data-testid='breadcrumb-link'][" + counter + "]";
    myDataPage myDataPage;
    tagsPage tagsPage;
    teamsPage teamsPage;
    ingestionPage ingestionPage;
    userListPage userListPage;
    tableDetails tableDetails;
    explorePage explorePage;
    topicDetails topicDetails;

    @BeforeEach
    public void openMetadataWindow() {
        System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless");
        options.addArguments("--window-size=1280,800");
        webDriver = new ChromeDriver();
        myDataPage = new myDataPage(webDriver);
        userListPage = new userListPage(webDriver);
        ingestionPage = new ingestionPage(webDriver);
        teamsPage = new teamsPage(webDriver);
        tagsPage = new tagsPage(webDriver);
        tableDetails = new tableDetails(webDriver);
        explorePage = new explorePage(webDriver);
        topicDetails = new topicDetails(webDriver);
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
        webDriver.manage().window().maximize();
        webDriver.get(url);
    }

    @Test
    @Order(1)
    public void openExplorePage(){
        Events.click(webDriver, myDataPage.closeWhatsNew());
        Events.click(webDriver, explorePage.explore());
    }

    @Test
    @Order(2)
    public void checkTabs() throws InterruptedException {
        openExplorePage();
        Events.sendKeys(webDriver, myDataPage.getSearchBox(), tableName);
        Events.click(webDriver, myDataPage.selectTable());
        Events.click(webDriver, tableDetails.profiler());
        Events.click(webDriver,tableDetails.lineage());
        Events.click(webDriver,tableDetails.sampleData());
        Events.click(webDriver,tableDetails.manage());
    }

    @Test
    @Order(3)
    public void editDescription() throws InterruptedException {
        openExplorePage();
        String sendKeys = "Description Added";
        Events.click(webDriver, explorePage.selectTable());
        Events.click(webDriver, tableDetails.editDescriptionButton());
        Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), Keys.CONTROL + "A");
        Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), sendKeys);
        Events.click(webDriver, tableDetails.saveTableDescription());
        String description = webDriver.findElement(tableDetails.descriptionBox()).getText();
        Assert.assertTrue(description.equalsIgnoreCase(sendKeys));
    }

    @Test
    @Order(4)
    public void searchColumnAndEditDescription() throws InterruptedException {
        openExplorePage();
        WebElement columnDescripitonBox;
        String sendKeys = "Description Added";
        Events.click(webDriver, explorePage.selectTable());
        for(int i=0;i<1;i++) {
            Events.click(webDriver,tableDetails.columnDescription());
            columnDescripitonBox = webDriver.findElement(tableDetails.columnDescriptionBox());
            Events.click(webDriver,tableDetails.columnDescriptionBox());
            Events.sendKeys(webDriver,tableDetails.columnDescriptionBox(),Keys.CONTROL + "A");
            actions.moveToElement(columnDescripitonBox).sendKeys(sendKeys).perform();
            Events.click(webDriver,tableDetails.saveTableDescription());
            webDriver.navigate().refresh();
        }
        String verifyDescription = webDriver.findElement(tableDetails.columnDescription()).getText();
        Assert.assertEquals(verifyDescription, sendKeys);
    /*tableDetails tableDetails = new tableDetails(webDriver);
    String sendKeys = "Description Added";
    Thread.sleep(1000);
    myDataPage myDataPage = new myDataPage(webDriver);
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    String editDescription = faker.address().toString();
    String updateDescription = faker.address().toString();
    */
    /*Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='searchbar']")));
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchbar']"), "address1");
    Thread.sleep(2000);*/
    /*
    // actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']//button"))).perform();
     Events.click(webDriver, By.xpath("//div[@data-testid='description']//button"));
     Events.sendKeys(webDriver, By.xpath(enterDescription), editDescription);
     Events.click(webDriver, By.cssSelector("[data-testid='save']"));
     webDriver.navigate().refresh();
     wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='searchbar']")));
     Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchbar']"), "address1");
     Thread.sleep(2000);
     actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']//button"))).perform();
     Events.click(webDriver, By.xpath("//div[@data-testid='description']//button"));
     webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + "')]] "));
     Events.sendKeys(webDriver, By.xpath(enterDescription), updateDescription);
     Events.click(webDriver, By.cssSelector("[data-testid='save']"));
     webDriver.navigate().refresh();
     wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='searchbar']")));
     Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchbar']"), "address1");
     Thread.sleep(2000);
     actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']//button"))).perform();
     Events.click(webDriver, By.xpath("//div[@data-testid='description']//button"));
     Thread.sleep(1000);
     webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + updateDescription + "')]] "));
     Events.click(webDriver, By.cssSelector("[data-testid='cancel']"));*/
    }

    @Test
    public void addTagsToColumn() throws InterruptedException {
        openExplorePage();
        List<WebElement> selectedTag = new ArrayList<>();
        Events.click(webDriver,explorePage.selectTable());
        ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", explorePage.addTag());
        Events.click(webDriver,explorePage.addTag());
        Events.click(webDriver,tableDetails.addTagTextBox());
        Events.sendKeys(webDriver,tableDetails.addTagTextBox(),"P");
        Events.click(webDriver,tableDetails.selectTag());
        Events.click(webDriver,tableDetails.saveTag());
        ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", explorePage.explore());
        selectedTag = webDriver.findElements(tableDetails.getSelectedTag());
        String TagDisplayed = webDriver.findElement(tableDetails.TagName()).getText();
    }

    @Test
    public void removeTags() throws InterruptedException {
        openExplorePage();
        List<WebElement> tagDisplayed = topicDetails.breadCrumbTag();
        Events.click(webDriver,explorePage.selectTable());
        Events.click(webDriver,tableDetails.tagName());
        Events.click(webDriver,tableDetails.removeTag());
        Events.click(webDriver,tableDetails.saveTag());
        webDriver.navigate().refresh();
    }

    @Test
    @Order(8)
    public void checkProfiler() throws InterruptedException {
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
        openExplorePage();
        Events.click(webDriver,explorePage.selectTable());
        Events.click(webDriver,tableDetails.profiler());
        List<WebElement> profilerColumn = tableDetails.profilerColumn();
        List<WebElement> chart = tableDetails.chart();
        for (WebElement e : profilerColumn) {
            e.click();
        }
        for (WebElement c : chart) {
            actions.moveToElement(c).build().perform();
            Assert.assertTrue(c.isDisplayed());
        }
    }

    @Test
    @Order(9)
    public void checkManage() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver,explorePage.selectTable());
        Events.click(webDriver,tableDetails.manage());
        Events.click(webDriver,tableDetails.clickOwnerDropdown());
        Events.click(webDriver,tableDetails.selectUser());
        Events.click(webDriver,tableDetails.selectTier1());
        Events.click(webDriver,tableDetails.saveManage());
    }

    @Test
    @Order(10)
    public void checkLineage() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver,explorePage.selectTable());
        Events.click(webDriver,tableDetails.lineage());
        List<WebElement> nodes = tableDetails.lineageNodes();
        // Clicking and checking all the nodes text matches to side drawer text
        WebElement sideDrawer = webDriver.findElement(tableDetails.sideDrawer());
        for (WebElement e : nodes) {
            e.click();
            Assert.assertEquals(e.getText(), sideDrawer.getText());
            actions.dragAndDropBy(e, 100, 200).perform();
        }
    }

    @Test
    @Order(11)
    public void checkBreadCrumb() throws Exception {
        openExplorePage();
        Events.click(webDriver,explorePage.selectTable());
        Thread.sleep(1000);
        List<WebElement> br = tableDetails.breadCrumb();
        // Using for loop to check breadcrumb links
        // Since after navigating back we are facing StaleElementException using try catch block.
        for (WebElement link : br) {
            try {
                counter = counter + 1;
                link.click();
                Thread.sleep(1000);
                webDriver.navigate().back();
                Thread.sleep(1000);
            } catch (StaleElementReferenceException ex) {
                Thread.sleep(2000);
                WebElement breadcrumb_link = webDriver.findElement(By.xpath(xpath));
                breadcrumb_link.click();
            }
        }
    }

  /*String editDescription = faker.address().toString();
  String updateDescription = faker.address().toString();
  Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[last()]"));
  Events.click(webDriver, By.cssSelector("[data-testid='breadcrumb-link']"));
  Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
  Events.sendKeys(webDriver, By.xpath(enterDescription), editDescription);
  Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  webDriver.navigate().refresh();
  Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
  Thread.sleep(1000);
  webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + "')]] "));
  Events.sendKeys(webDriver, By.xpath(enterDescription), updateDescription);
  Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  webDriver.navigate().refresh();
  Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
  Thread.sleep(1000);
  webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + updateDescription + "')]] "));
  Events.click(webDriver, By.cssSelector("[data-testid='cancel']"));
  Events.click(webDriver, By.xpath("(//tr[@data-testid='column']//td[1]/a)[1]")); // database
  Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
  Events.sendKeys(webDriver, By.xpath(enterDescription), editDescription);
  Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  webDriver.navigate().refresh();
  Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
  Thread.sleep(1000);
  webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + "')]] "));
  Events.sendKeys(webDriver, By.xpath(enterDescription), updateDescription);
  Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  webDriver.navigate().refresh();
  Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
  Thread.sleep(1000);
  webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + updateDescription + "')]] "));
  Events.click(webDriver, By.cssSelector("[data-testid='cancel']"));
  for (int i = 1; i <= 3; i++) { // check topics in service
      Events.click(webDriver, By.xpath("(//tr[@data-testid='tabale-column']//td[1]/a)" + "[" + i + "]")); // tables
      Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
      Events.sendKeys(webDriver, By.xpath(enterDescription), editDescription);
      Events.click(webDriver, By.cssSelector("[data-testid='save']"));
      webDriver.navigate().refresh();
      Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
      Thread.sleep(1000);
      webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + "')]] "));
      Events.sendKeys(webDriver, By.xpath(enterDescription), updateDescription);
      Events.click(webDriver, By.cssSelector("[data-testid='save']"));
      webDriver.navigate().refresh();
      Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
      Thread.sleep(1000);
      webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + updateDescription + "')]] "));
      Events.click(webDriver, By.cssSelector("[data-testid='cancel']"));
      Thread.sleep(waitTime);
      webDriver.navigate().back();*/

    @Test
    @Order(12)
    public void checkVersion() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver,explorePage.selectTable());
        Events.click(webDriver,tableDetails.version());
        Thread.sleep(1000);
        List<WebElement> versionGrid = tableDetails.versionDetailsGrid();
        List<WebElement> versionRadioButton = tableDetails.versionRadioButton();
        for (WebElement e : versionRadioButton) {
            e.click();
            ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", e);
        }
        Events.click(webDriver,tableDetails.version());
        Thread.sleep(1000);
        Events.click(webDriver,myDataPage.openWhatsNew());
    }

    @Test
    @Order(13)
    public void checkFrequentlyJoinedTables() throws InterruptedException {
        openExplorePage();
        Events.sendKeys(webDriver, myDataPage.getSearchBox(), "fact_sale");
        Events.click(webDriver, myDataPage.selectTable());
        Thread.sleep(2000);
        Events.click(webDriver, tableDetails.joinedTables());
    }

    @Test
    @Order(14)
    public void checkFrequentlyJoinedColumns() throws InterruptedException {
        openExplorePage();
        Events.sendKeys(webDriver, myDataPage.getSearchBox(), "fact_sale");
        Events.click(webDriver, myDataPage.selectTable());
        Thread.sleep(2000);
        Events.click(webDriver, tableDetails.joinedColumns());
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
