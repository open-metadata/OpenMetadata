/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.selenium.pages.tags;

import com.github.javafaker.Faker;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.ArrayList;

public class TagsPageTest {

    static WebDriver webDriver;
    static String url = Property.getInstance().getURL();
    Integer waitTime = Property.getInstance().getSleepTime();
    static Faker faker = new Faker();
    static String tagCategoryDisplayName = faker.name().firstName();
    static String tagDisplayName = faker.name().firstName();
    static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
    static Actions actions;
    static WebDriverWait wait;

    @BeforeMethod
    public void openMetadataWindow() {
        System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/macM1/chromedriver");
        webDriver = new ChromeDriver();
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(5));
        webDriver.manage().window().maximize();
        webDriver.get(url);
    }

    @Test(priority = 1)
    public void openTagsPage() throws InterruptedException {
        webDriver.findElement(By.cssSelector("[data-testid='closeWhatsNew']")).click(); // Close What's new
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")));
        webDriver.findElement(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")).click(); // Setting
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Tags']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Tags']")).click(); // Setting/Tags
        Thread.sleep(waitTime);
    }

    @Test(priority = 2)
    public void addTagCategory() throws InterruptedException {
        openTagsPage();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='add-category']")));
        webDriver.findElement(By.cssSelector("[data-testid='add-category']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(webDriver.findElement(By.name("name"))));
        webDriver.findElement(By.name("name")).sendKeys(tagCategoryDisplayName);
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='boldButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='boldButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(webDriver.findElement(By.xpath(enterDescription)))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(Keys.ENTER);
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='italicButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='italicButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(webDriver.findElement(By.xpath(enterDescription)))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(Keys.ENTER);
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='linkButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='linkButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='saveButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='saveButton']")).click();
    }

    @Test(priority = 3)
    public void editTagCategoryDescription() throws InterruptedException {
        openTagsPage();
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.xpath("//*[text()[contains(.,'"+ tagCategoryDisplayName +"')]] ")));
        webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ tagCategoryDisplayName +"')]] "))
                .click(); // Select the created listed team
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='add-description']")));
        webDriver.findElement(By.cssSelector("[data-testid='add-description']")).click();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(enterDescription)));
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='save']")));
        webDriver.findElement(By.cssSelector("[data-testid='save']")).click();
    }

    @Test(priority = 4)
    public void addTag() throws InterruptedException {
        openTagsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//*[text()[contains(.,'"+ tagCategoryDisplayName +"')]] ")));
        webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ tagCategoryDisplayName +"')]] "))
                .click(); // Select the created listed team
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='add-new-tag-button']")));
        webDriver.findElement(By.cssSelector("[data-testid='add-new-tag-button']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.name("name")));
        webDriver.findElement(By.name("name")).sendKeys(tagDisplayName);
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='boldButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='boldButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(webDriver.findElement(By.xpath(enterDescription)))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(Keys.ENTER);
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='italicButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='italicButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(webDriver.findElement(By.xpath(enterDescription)))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(Keys.ENTER);
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='linkButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='linkButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath(enterDescription)))).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='saveButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='saveButton']")).click();
    }

    @Test(priority = 5)
    public void changeTagDescription() throws InterruptedException {
        openTagsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ tagCategoryDisplayName +"')]] "))))
                .click(); // Select the created listed team
        actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='editTagDescription']"))).perform();
        webDriver.findElement(By.cssSelector("[data-testid='editTagDescription']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath(enterDescription)));
        webDriver.findElement(By.xpath(enterDescription)).sendKeys(faker.address().toString());
        webDriver.findElement(By.cssSelector("[data-testid='save']")).click();
    }

    @Test(priority = 6)
    public void addAssociatedTag() throws InterruptedException {
        openTagsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ tagCategoryDisplayName +"')]] "))))
                .click(); // Select the created listed team
        actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='tags']"))).perform();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='tags']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='associatedTagName']")))).click();
        for (int i = 0; i <=1; i++){
            wait.until(ExpectedConditions.elementToBeClickable(
                    webDriver.findElement(By.cssSelector("[data-testid='associatedTagName']"))))
                    .sendKeys("P");
            wait.until(ExpectedConditions.elementToBeClickable(
                    webDriver.findElement(By.cssSelector("[data-testid='list-item']")))).click();
        }
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='saveAssociatedTag']")))).click();
    }

    @Test(priority = 7)
    public void removeAssociatedTag() throws InterruptedException {
        openTagsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ tagCategoryDisplayName +"')]] "))))
                .click(); // Select the created listed team
        actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='tags']"))).perform();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='tags']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='remove']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='remove']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='saveAssociatedTag']")))).click();
    }

    @Test(priority = 8)
    public void addTagToTableColumn() throws InterruptedException {
        webDriver.findElement(By.cssSelector("[data-testid='closeWhatsNew']")).click(); // Close What's new
        webDriver.findElement(By.cssSelector("[data-testid='appbar-item'][id='explore']")).click(); // Explore
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='sortBy']")));
        webDriver.findElement(By.cssSelector("[data-testid='sortBy']")).click(); // Sort By
        webDriver.findElement(By.cssSelector("[data-testid='list-item']")).click(); // Last Updated
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//div[@data-testid='search-container']//div//div[10]//div//div//h6")));
        webDriver.findElement(By.xpath("//div[@data-testid='search-container']//div//div[10]//div//div//h6")).click();
        Thread.sleep(waitTime);
        actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='tags']"))).perform();
        Thread.sleep(waitTime);
        webDriver.findElement(By.cssSelector("[data-testid='tags']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='associatedTagName']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='associatedTagName']"))))
                .sendKeys(tagCategoryDisplayName + "." + tagDisplayName);
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='list-item']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='saveAssociatedTag']")))).click();
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")));
        webDriver.findElement(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")).click(); // Setting
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Tags']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Tags']")).click(); // Setting/Tags
        webDriver.navigate().refresh();
    }

    @AfterMethod
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
