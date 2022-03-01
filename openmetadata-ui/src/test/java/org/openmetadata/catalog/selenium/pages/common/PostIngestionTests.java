package org.openmetadata.catalog.selenium.pages.common;

import java.io.IOException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;

@Order(15)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PostIngestionTests {

  static WebDriver webDriver;
  static Common common;
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
    common = new Common(webDriver);
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
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerItem("explore"));
    Events.click(webDriver, common.entityTabIndex(3));
    Thread.sleep(waitTime);
    Events.sendKeys(webDriver, common.searchBar(), dashboard);
    Events.click(webDriver, common.selectSuggestionSearch("sample_superset34"));
    Events.click(webDriver, common.entityTabIndex(4));
    Events.click(webDriver, common.ownerDropdown());
    Events.sendKeys(webDriver, common.ownerSearchBox(), "Cloud");
    Events.click(webDriver, common.tagListItem());
    Events.click(webDriver, common.saveConnectionConfig());
  }

  @Test
  @Order(2)
  public void checkOwnerPostIngestion() throws InterruptedException, IOException {
    ingestSampleDataPostTests();
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerItem("explore"));
    Thread.sleep(waitTime);
    Events.sendKeys(webDriver, common.searchBar(), dashboard);
    Events.click(webDriver, common.selectSuggestionSearch("sample_superset34"));
    Events.click(webDriver, common.entityTabIndex(4));
    Events.click(webDriver, common.containsText("Cloud_Infra"));
  }
}
