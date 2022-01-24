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
import java.util.ListIterator;

import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.FindBy;
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
    public void openExplorePage() throws InterruptedException {
        myDataPage myDataPage = new myDataPage(webDriver);
        explorePage explorePage = new explorePage(webDriver);
        Thread.sleep(1000);
        myDataPage.closeWhatsNew().click();
        Thread.sleep(1000);
        explorePage.explore().click();
        Thread.sleep(1000);
    }

    @Test
    @Order(2)
    public void checkTabs() throws InterruptedException {
        myDataPage myDataPage = new myDataPage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        openExplorePage();
        myDataPage.getSearchBox().sendKeys(tableName);
        Thread.sleep(1000);
        myDataPage.selectTable().click();
        Thread.sleep(1000);
        tableDetails.profiler().click();
        Thread.sleep(1000);
        tableDetails.lineage().click();
        Thread.sleep(1000);
        tableDetails.sampleData().click();
        Thread.sleep(1000);
        tableDetails.manage().click();
        Thread.sleep(1000);
    }

    @Test
    @Order(3)
    public void editDescription() throws InterruptedException {
        openExplorePage();
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        String sendKeys = "Description Added";
        explorePage.selectTable().click();
        Thread.sleep(1000);
        wait.until(ExpectedConditions.visibilityOf(tableDetails.editDescriptionButton()));
        tableDetails.editDescriptionButton().click();
        Thread.sleep(1000);
        tableDetails.editDescriptionBox().sendKeys(Keys.CONTROL + "A");
        Thread.sleep(1000);
        tableDetails.editDescriptionBox().sendKeys(sendKeys);
        Thread.sleep(1000);
        tableDetails.saveTableDescription().click();
        Thread.sleep(1000);
        String description = tableDetails.descriptionBox().getText();
        Thread.sleep(1000);
        Assert.assertTrue(description.equalsIgnoreCase(sendKeys));
    }

    @Test
    @Order(4)
    public void searchColumnAndEditDescription() throws InterruptedException {
        openExplorePage();
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        String sendKeys = "Description Added";
        explorePage.selectTable().click();
        Thread.sleep(1000);
        tableDetails.columnDescription().click();
        Thread.sleep(1000);
        tableDetails.columnDescriptionBox().click();
        Thread.sleep(1000);
        tableDetails.columnDescriptionBox().sendKeys(Keys.CONTROL+"A");
        Thread.sleep(1000);
        actions.moveToElement(tableDetails.columnDescriptionBox()).sendKeys(sendKeys).perform();
        Thread.sleep(1000);
        tableDetails.saveTableDescription().click();
        Thread.sleep(1000);
        webDriver.navigate().refresh();
        Thread.sleep(2000);
        String verifyDescription = tableDetails.columnDescription().getText();
        Assert.assertEquals(verifyDescription,sendKeys);
        /*tableDetails tableDetails = new tableDetails(webDriver);
        String sendKeys = "Description Added";
        Thread.sleep(1000);
        myDataPage myDataPage = new myDataPage(webDriver);
        myDataPage.closeWhatsNew().click();
        Thread.sleep(1000);
        String editDescription = faker.address().toString();
        String updateDescription = faker.address().toString();
        *//*Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
        Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='searchbar']")));
        Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchbar']"), "address1");
        Thread.sleep(2000);*//*
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
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        openExplorePage();
        Thread.sleep(1000);
        explorePage.selectTable().click();
        Thread.sleep(1000);
        ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", explorePage.addTag());
        Thread.sleep(1000);
        wait.until(ExpectedConditions.visibilityOf(explorePage.addTag()));
        explorePage.addTag().click();
        Thread.sleep(1000);
        tableDetails.addTagTextBox().click();
        Thread.sleep(1000);
        tableDetails.addTagTextBox().sendKeys("P");
        Thread.sleep(1000);
        tableDetails.selectTag().click();
        Thread.sleep(1000);
        tableDetails.saveTag().click();
        ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", explorePage.explore());
        Thread.sleep(1000);
        String selectedTag = tableDetails.getSelectedTag().getText();
        String TagDisplayed = tableDetails.TagName().getText();
        Assert.assertEquals(TagDisplayed, selectedTag);
    }

    @Test
    public void removeTags() throws InterruptedException {
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        openExplorePage();
        Thread.sleep(1000);
        explorePage.selectTable().click();
        Thread.sleep(1000);
        tableDetails.tagName().click();
        Thread.sleep(1000);
        tableDetails.removeTag().click();
        Thread.sleep(1000);
        tableDetails.saveTag().click();
    }

    @Test
    @Order(8)
    public void checkProfiler() throws InterruptedException {
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
        openExplorePage();
        explorePage.selectTable().click();
        tableDetails.profiler().click();
        List<WebElement> profilerColumn = tableDetails.profilerColumn();
        List<WebElement> chart = tableDetails.chart();
        List<WebElement> toolTip = tableDetails.toolTip();
        for (WebElement e : profilerColumn) {
            e.click();
        }
        Actions builder = new Actions(webDriver);
        for (WebElement c : chart) {
            actions.moveToElement(c).build().perform();
            Assert.assertTrue(c.isDisplayed());
        }
    }

    @Test
    @Order(9)
    public void checkManage() throws InterruptedException {
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        String tierName = null;
        int counter = 1;
        webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
        openExplorePage();
        explorePage.selectTable().click();
        tableDetails.manage().click();
        tableDetails.clickOwnerDropdown().click();
        tableDetails.selectUser().click();
        tableDetails.selectTier1().click();
        tableDetails.saveManage().click();
        tierName = tableDetails.selectTier1().getText();
    }

    @Test
    @Order(10)
    public void checkLineage() throws InterruptedException {
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(1));
        openExplorePage();
        explorePage.selectTable().click();
        tableDetails.lineage().click();
        List<WebElement> nodes = tableDetails.lineageNodes();
        //Clicking and checking all the nodes text matches to side drawer text
        for (WebElement e : nodes) {
            e.click();
            Assert.assertEquals(e.getText(), tableDetails.sideDrawer().getText());
            actions.dragAndDropBy(e, 100, 200).perform();
        }
    }

    @Test
    @Order(11)
    public void checkBreadCrumb() throws Exception {
        explorePage explorePage = new explorePage(webDriver);
        tableDetails tableDetails = new tableDetails(webDriver);
        openExplorePage();
        Thread.sleep(1000);
        explorePage.selectTable().click();
        Thread.sleep(1000);
        List<WebElement> br = tableDetails.breadCrumb();
        //Using for loop to check breadcrumb links
        //Since after navigating back we are facing StaleElementException using try catch block.
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
        tableDetails tableDetails = new tableDetails(webDriver);
        explorePage explorePage = new explorePage(webDriver);
        myDataPage myDataPage = new myDataPage(webDriver);
        openExplorePage();
        explorePage.selectTable().click();
        Thread.sleep(1000);
        tableDetails.version().click();
        Thread.sleep(1000);
        List<WebElement> versionGrid = tableDetails.versionDetailsGrid();
        List<WebElement> versionRadioButton = tableDetails.versionRadioButton();
        for (WebElement e : versionRadioButton) {
            e.click();
            ((JavascriptExecutor) webDriver).executeScript("arguments[0].scrollIntoView(true);", e);
        }
        tableDetails.version().click();
        Thread.sleep(1000);
        myDataPage.openWhatsNew().click();
        addTagsToColumn();
    }

    @Test
    @Order(13)
    public void checkFrequentlyJoinedTables() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys("fact_sale");
        Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
        Thread.sleep(2000);
        Events.click(webDriver, By.xpath("(//div[@data-testid='related-tables-data']//a)"));
    }

    @Test
    @Order(14)
    public void checkFrequentlyJoinedColumns() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys("fact_sale");
        Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
        Thread.sleep(2000);
        Events.click(webDriver, By.xpath("(//div[@data-testid='frequently-joined-columns']/span/a)"));
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
