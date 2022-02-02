package org.openmetadata.catalog.selenium.pagesWithoutData.myData;

import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class MyDataPageTest {

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
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

  @Test
  @Order(1)
  public void checkWhatsNew() {
    Events.click(webDriver, By.xpath("//ul[@class='slick-dots testid-dots-button']//li[2]")); // What's new page 2
    Events.click(webDriver, By.cssSelector("[data-testid='WhatsNewModalChangeLogs']")); // Change Logs
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
  }

  @Test
  @Order(2)
  public void checkOverview() {
    checkWhatsNew();
    String tablesCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='tables-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(tablesCount, "0");

    String topicsCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='topics-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(topicsCount, "0");

    String dashboardsCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='dashboards-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(dashboardsCount, "0");

    String pipelinesCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='pipelines-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(pipelinesCount, "0");

    String servicesCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='service-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(servicesCount, "0");

    String ingestionCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='ingestion-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(ingestionCount, "0");

    String usersCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='user-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(usersCount, "0");

    String teamsCount =
        webDriver
            .findElement(By.xpath("//div[@data-testid='terms-summary']//span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(teamsCount, "0");
  }

  @Test
  @Order(3)
  public void checkRecentViews() throws Exception {
    checkWhatsNew();
    WebElement recentViews =
        webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "No recently viewed data." + "')]] "));
    if (!recentViews.isDisplayed()) {
      throw new Exception("There shouldn't be any viewed data");
    }
  }

  @Test
  @Order(4)
  public void checkRecentSearch() throws Exception {
    checkWhatsNew();
    WebElement recentSearch =
        webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "No searched terms." + "')]] "));
    if (!recentSearch.isDisplayed()) {
      throw new Exception("There shouldn't be any searched terms");
    }
  }

  @Test
  @Order(5)
  public void checkMyDataTab() throws Exception {
    checkWhatsNew();
    WebElement myDataResults =
        webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "You have not owned anything yet." + "')]] "));
    if (!myDataResults.isDisplayed()) {
      throw new Exception("There shouldn't be any owned data");
    }
  }

  @Test
  @Order(6)
  public void checkFollowingTab() throws Exception {
    checkWhatsNew();
    WebElement followResults =
        webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "You have not followed anything yet." + "')]] "));
    if (!followResults.isDisplayed()) {
      throw new Exception("There shouldn't be any followed data");
    }
  }

  @Test
  @Order(7)
  public void checkSearchResults() throws Exception {
    checkWhatsNew();
    Events.sendEnter(webDriver, By.cssSelector("[id='searchBox']"));
    Thread.sleep(2000);
    String searchedEntity =
        webDriver.findElement(By.cssSelector("[data-testid='no-search-results']")).getAttribute("innerHTML");
    Assert.assertEquals(searchedEntity, "No matching data assets found");
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
