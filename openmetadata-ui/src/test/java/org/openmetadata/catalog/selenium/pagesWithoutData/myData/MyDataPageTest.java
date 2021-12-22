package org.openmetadata.catalog.selenium.pagesWithoutData.myData;

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

import java.time.Duration;
import java.util.Objects;

public class MyDataPageTest {

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static String table = "dim_product_variant";
  Integer waitTime = Property.getInstance().getSleepTime();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/macM1/chromedriver");
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
  public void checkOverview() throws Exception {
    checkWhatsNew();
    String tablesCount = webDriver.findElement(By.xpath("//div[@data-testid='tables-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(tablesCount, "0")) {
      throw new Exception("Count should be 0");
    }

    String topicsCount = webDriver.findElement(By.xpath("//div[@data-testid='topics-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(topicsCount, "0")) {
      throw new Exception("Count should be 0");
    }

    String dashboardsCount = webDriver.findElement(By.xpath("//div[@data-testid='dashboards-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(dashboardsCount, "0")) {
      throw new Exception("Count should be 0");
    }

    String pipelinesCount = webDriver.findElement(By.xpath("//div[@data-testid='pipelines-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(pipelinesCount, "0")) {
      throw new Exception("Count should be 0");
    }

    String servicesCount = webDriver.findElement(By.xpath("//div[@data-testid='service-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(servicesCount, "0")) {
      throw new Exception("Count should be 0");
    }

    String ingestionCount = webDriver.findElement(By.xpath("//div[@data-testid='ingestion-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(ingestionCount, "0")) {
      throw new Exception("Count should be 0");
    }

    String usersCount = webDriver.findElement(By.xpath("//div[@data-testid='user-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(usersCount, "0")) {
      throw new Exception("Count should be 0");
    }

    String teamsCount = webDriver.findElement(By.xpath("//div[@data-testid='terms-summary']//span[@data-testid='filter-count']")).getAttribute("innerHTML");
    if (!Objects.equals(teamsCount, "0")) {
      throw new Exception("Count should be 0");
    }
  }

  @Test
  public void checkRecentViews() throws Exception {
    checkWhatsNew();
    WebElement webElement = webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "No recently viewed data!" + "')]] "));
    if (!webElement.isDisplayed()) {
      throw new Exception("There shouldn't be any viewed data");
    }
  }

  @Test
  public void checkRecentSearch() throws Exception {
    checkWhatsNew();
    WebElement webElement = webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "No searched terms!" + "')]] "));
    if (!webElement.isDisplayed()) {
      throw new Exception("There shouldn't be any searched terms");
    }
  }

  @Test
  public void checkMyDataTab() throws Exception {
    checkWhatsNew();
    WebElement webElement = webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "You have not owned anything yet!" + "')]] "));
    if (!webElement.isDisplayed()) {
      throw new Exception("There shouldn't be any owned data");
    }
  }
  @Test
  public void checkFollowingTab() throws Exception {
    checkWhatsNew();
    WebElement webElement = webDriver.findElement(By.xpath("//*[text()[contains(.,'" + "You have not followed anything yet!" + "')]] "));
    if (!webElement.isDisplayed()) {
      throw new Exception("There shouldn't be any followed data");
    }
  }
}
