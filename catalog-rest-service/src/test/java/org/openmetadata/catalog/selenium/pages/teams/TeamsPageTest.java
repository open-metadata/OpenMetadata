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

package org.openmetadata.catalog.selenium.pages.teams;

import com.github.javafaker.Faker;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
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

public class TeamsPageTest {

    static WebDriver webDriver;
    static String URL = Property.getInstance().getURL();
    Integer waitTime = Property.getInstance().getSleepTime();
    static Faker faker = new Faker();
    static String teamDisplayName = faker.name().lastName();
    static Actions actions;
    static WebDriverWait wait;

    @BeforeMethod
    public void openMetadataWindow() {
        System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/macM1/chromedriver");
        webDriver = new ChromeDriver();
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(5));
        webDriver.manage().window().maximize();
        webDriver.get(URL);
    }

    @Test(priority = 1)
    public void openTeamsPage() throws InterruptedException {
        webDriver.findElement(By.cssSelector("[data-testid='closeWhatsNew']")).click(); // Close What's new
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")));
        webDriver.findElement(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")).click(); // Setting
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Teams']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Teams']")).click(); // Setting/Teams
        Thread.sleep(waitTime);
    }

    @Test(priority = 2)
    public void createTeam() throws InterruptedException {
        openTeamsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='add-teams']"))));
        webDriver.findElement(By.cssSelector("[data-testid='add-teams']")).click(); // add team
        webDriver.findElement(By.name("name")).sendKeys(faker.name().firstName()); // name
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.name("displayName")))).sendKeys(teamDisplayName); // displayname
        webDriver.findElement(
                By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div"))
                .sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='boldButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='boldButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='italicButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='italicButton']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='linkButton']")));
        webDriver.findElement(By.cssSelector("[data-testid='linkButton']")).click();
        webDriver.findElement(By.cssSelector("[data-testid='saveButton']")).click();
    }

    @Test(priority = 3)
    public void addUser() throws InterruptedException {
        openTeamsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "))))
                .click(); // Select the created listed team
        for(int i = 0; i <=10; i++) {
            wait.until(ExpectedConditions.elementToBeClickable(
                    By.cssSelector("[data-testid='add-new-user-button']"))); // select add user button
            webDriver.findElement(
                    By.cssSelector("[data-testid='add-new-user-button']")).click(); // select add user button
            wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='checkboxAddUser']")));
            webDriver.findElement(By.cssSelector("[data-testid='checkboxAddUser']")).click();
            wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='AddUserSave']")));
            webDriver.findElement(By.cssSelector("[data-testid='AddUserSave']")).click();
            Thread.sleep(waitTime);
        }
    }

    @Test(priority = 4)
    public void editDescription() throws InterruptedException {
        openTeamsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "))); // Select the created listed team
        webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "))
                .click(); // Select the created listed team
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='add-description']")));
        webDriver.findElement(By.cssSelector("[data-testid='add-description']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div")));
        webDriver.findElement(By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div"))
                .sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='save']")));
        webDriver.findElement(By.cssSelector("[data-testid='save']")).click();
    }

    @Test(priority = 5)
    public void addAsset() throws InterruptedException {
        openTeamsPage();
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "))); // Select the created listed team
        webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "))
                .click(); // Select the created listed team
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='assets']"))); // Assets
        webDriver.findElement(By.cssSelector("[data-testid='assets']")).click(); // Assets
        webDriver.findElement(By.cssSelector("[data-testid='appbar-item'][id='explore']")).click(); // Explore
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='sortBy']")));
        webDriver.findElement(By.cssSelector("[data-testid='sortBy']")).click(); // Sort By
        webDriver.findElement(By.cssSelector("[data-testid='list-item']")).click(); // Last Updated // Last Updated
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//div[@data-testid='search-container']//div//div[10]//div//div//h6")));
        webDriver.findElement(By.xpath("//div[@data-testid='search-container']//div//div[10]//div//div//h6")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//button[@data-testid='tab'])[4]"))); // Manage
        webDriver.findElement(By.xpath("(//button[@data-testid='tab'])[4]")).click(); // Manage
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='owner-dropdown']"))); // Owner
        webDriver.findElement(By.cssSelector("[data-testid='owner-dropdown']")).click(); // Owner
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='searchInputText']"))));
        webDriver.findElement(By.cssSelector("[data-testid='searchInputText']")).sendKeys(teamDisplayName);
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='list-item']")))); // Select User/Team
        webDriver.findElement(By.cssSelector("[data-testid='list-item']")).click(); // Select User/Team
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='saveManageTab']"))); // Save
        webDriver.findElement(By.cssSelector("[data-testid='saveManageTab']")).click(); // Save
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")));
        webDriver.findElement(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")).click(); // Setting
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Teams']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Teams']")).click(); // Setting/Teams
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "))); // Select the created listed team
        webDriver.findElement(By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "))
                .click(); // Select the created listed team
        Thread.sleep(waitTime);
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='assets']"))));
        webDriver.findElement(By.cssSelector("[data-testid='assets']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='user-card-container']"))));
        webDriver.findElement(By.cssSelector("[data-testid='user-card-container']")).click();
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
