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
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer;

import java.time.Duration;
import java.util.ArrayList;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TeamsPageTest {

    static WebDriver webDriver;
    static String URL = Property.getInstance().getURL();
    Integer waitTime = Property.getInstance().getSleepTime();
    static Faker faker = new Faker();
    static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
    static String teamDisplayName = faker.name().lastName();
    static Actions actions;
    static WebDriverWait wait;

    @BeforeEach
    public void openMetadataWindow() {
        System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--headless");
        webDriver = new ChromeDriver(options);
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
        webDriver.manage().window().maximize();
        webDriver.get(URL);
    }

    @Test
    @Order(1)
    public void openTeamsPage() throws InterruptedException {
        Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
        Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
        Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Teams']")); // Setting/Teams
        Thread.sleep(waitTime);
    }

    @Test
    @Order(2)
    public void createTeam() throws InterruptedException {
        openTeamsPage();
        Events.click(webDriver, By.cssSelector("[data-testid='add-teams']")); // add team
        Events.sendKeys(webDriver, By.name("name"), faker.name().firstName()); // name
        Events.sendKeys(webDriver, By.name("displayName"), teamDisplayName); // displayname
        Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
        Events.click(webDriver, By.cssSelector("[data-testid='boldButton']"));
        Events.click(webDriver, By.cssSelector("[data-testid='italicButton']"));
        Events.click(webDriver, By.cssSelector("[data-testid='linkButton']"));
        Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
    }

//    @Test
//    @Order(3)
//    public void addUser() throws InterruptedException {
//        openTeamsPage();
//        Events.click(webDriver, By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "));
//        // Select the created listed team
//        for(int i = 0; i <=10; i++) {
//            Events.click(webDriver, By.cssSelector("[data-testid='add-new-user-button']")); // select add user button
//            Events.click(webDriver, By.cssSelector("[data-testid='checkboxAddUser']"));
//            Events.click(webDriver, By.cssSelector("[data-testid='AddUserSave']"));
//            Thread.sleep(waitTime);
//        }
//    }

    @Test
    @Order(4)
    public void editDescription() throws InterruptedException {
        openTeamsPage();
        Events.click(webDriver, By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "));
        // Select the created listed team
        Events.click(webDriver, By.cssSelector("[data-testid='add-description']"));
        wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath(enterDescription)));
        Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
        Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    }

    @Test
    @Order(5)
    public void addAsset() throws InterruptedException {
        openTeamsPage();
        Events.click(webDriver, By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "));
        // Select the created listed team
        Events.click(webDriver, By.cssSelector("[data-testid='assets']")); // Assets
        Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
        Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated // Last Updated
        Events.click(webDriver, By.xpath("//div[@data-testid='search-container']//div//div[10]//div//div//h6"));
        Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[4]")); // Manage
        Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
        Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchInputText']"), teamDisplayName);
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
        Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
        Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
        Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Teams']")); // Setting/Teams
        Events.click(webDriver, By.xpath("//*[text()[contains(.,'"+ teamDisplayName +"')]] "));
        // Select the created listed team
        Thread.sleep(waitTime);
        Events.click(webDriver, By.cssSelector("[data-testid='assets']"));
        Events.click(webDriver, By.cssSelector("[data-testid='user-card-container']"));
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
