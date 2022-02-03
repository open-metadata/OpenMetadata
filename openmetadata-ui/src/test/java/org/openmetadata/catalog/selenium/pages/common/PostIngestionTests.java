package org.openmetadata.catalog.selenium.pages.common;

import java.io.IOException;
import java.time.Duration;
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

@Order(15)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PostIngestionTests {

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static String dashboard = "Unicode Test";
  Integer waitTime = Property.getInstance().getSleepTime();
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

  public void ingestSampleDataPostTests() throws IOException {
    String[] installIngestion = {"bash", "-c", "cd ../ && pip install ingestion/"}; // install openmetadata ingestion
    String[] ingestSampleData = {
      "bash", "-c", "cd ../ingestion && metadata ingest -c ./pipelines/sample_data.json"
    }; // ingest sample data
    Runtime.getRuntime().exec(installIngestion);
    Runtime.getRuntime().exec(ingestSampleData);
  }

  @Test
  @Order(1)
  public void setOwner() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[3]")); // Dashboard
    Thread.sleep(waitTime);
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), dashboard);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name'][id='sample_superset34']"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[3]")); // Manage
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchInputText']"), "Cloud");
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
    Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
  }

  @Test
  @Order(2)
  public void checkOwnerPostIngestion() throws InterruptedException, IOException {
    ingestSampleDataPostTests();
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    Thread.sleep(waitTime);
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), dashboard);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name'][id='sample_superset34']"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[3]")); // Manage
    Events.click(webDriver, By.xpath("//*[contains(text(), 'Cloud_Infra')]"));
  }
}
