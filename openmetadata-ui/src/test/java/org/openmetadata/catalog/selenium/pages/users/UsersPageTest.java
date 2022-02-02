package org.openmetadata.catalog.selenium.pages.users;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(18)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UsersPageTest {

  static WebDriver webDriver;
  static Actions actions;
  static Faker faker = new Faker();
  static String tagCategoryDisplayName = faker.name().firstName();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  static String url = Property.getInstance().getURL();
  static String urlTag = "/api/v1/tags/";
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  public void openUsersPage() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Users']")); // Setting/Users
    Thread.sleep(waitTime);
  }

  @Test
  @Order(1)
  public void addAdminCheckCountCheck() throws InterruptedException {
    openUsersPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + "Cloud_Infra" + "')]] "));
    Events.click(webDriver, By.xpath("//div[@data-testid='data-container']//p"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
    Object afterUsersCount =
        webDriver
            .findElement(By.xpath("//button[@data-testid='users']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Thread.sleep(1000);
    Assert.assertEquals(afterUsersCount, "14");
    Object afterAdminCount =
        webDriver
            .findElement(By.xpath("//button[@data-testid='assets'][1]//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Thread.sleep(1000);
    Assert.assertEquals(afterAdminCount, "1");
  }

  @Test
  @Order(2)
  public void removeAdminCheckCountCheck() throws InterruptedException {
    openUsersPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + "Cloud_Infra" + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='assets']"));
    Events.click(webDriver, By.xpath("//div[@data-testid='data-container']//p"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
    Object afterAdminCount =
        webDriver
            .findElement(By.xpath("//button[@data-testid='assets'][1]//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Thread.sleep(1000);
    Assert.assertEquals(afterAdminCount, "0");
    Object afterUsersCount =
        webDriver
            .findElement(By.xpath("//button[@data-testid='users']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Thread.sleep(1000);
    Assert.assertEquals(afterUsersCount, "15");
  }

  @Test
  @Order(3)
  public void caseSensitiveSearchCheck() throws InterruptedException {
    openUsersPage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchbar']"), "AaR");
    Thread.sleep(4000);
    Object userResultsCount =
        webDriver
            .findElements(By.xpath("//div[@data-testid='user-card-container']/div[@data-testid='user-card-container']"))
            .size();
    Assert.assertEquals(userResultsCount, 3);
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
