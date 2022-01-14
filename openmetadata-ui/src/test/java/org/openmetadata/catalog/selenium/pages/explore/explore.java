package org.openmetadata.catalog.selenium.pages;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class explore {
  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  String tableName = "dim_address";

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
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    explorePage.explore().click();
    Thread.sleep(1000);
  }

  @Test
  @Order(2)
  public void checkTableCount() throws InterruptedException {
    openExplorePage();
    tableDetails tableDetails = new tableDetails(webDriver);
    explorePage explorePage = new explorePage(webDriver);
    int tableCount = Integer.parseInt(explorePage.getTableCount().getText());
    int getServiceCount = 0;
    By serviceName = By.xpath("//div[@class=\"filters-title tw-w-40 tw-truncate custom-checkbox-label\"]");
    By countService =
        By.xpath(
            "//span[@class=\"tw-py-px tw-px-1 tw-ml-1 tw-border tw-rounded tw-text-xs tw-min-w-badgeCount tw-text-center tw-bg-badge tw-py-0 tw-px-0\"]"); // count of services
    List<WebElement> listOfItems = webDriver.findElements(serviceName);
    List<WebElement> countOfItems = webDriver.findElements(countService);
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : listOfItems) {
      Names.add(sName.getText());
      if (Names.contains("Tier1")) {
        break;
      }
    }
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, tableCount);
  }

  @Test
  @Order(3)
  public void checkTopicCount() throws InterruptedException {
    openExplorePage();
    tableDetails tableDetails = new tableDetails(webDriver);
    explorePage explorePage = new explorePage(webDriver);
    Thread.sleep(1000);
    tableDetails.topics().click();
    int topicCount = Integer.parseInt(explorePage.getTopicCount().getText());
    int getServiceCount = 0;
    By serviceName = By.xpath("//div[@class=\"filters-title tw-w-40 tw-truncate custom-checkbox-label\"]");
    By countService =
        By.xpath(
            "//span[@class=\"tw-py-px tw-px-1 tw-ml-1 tw-border tw-rounded tw-text-xs tw-min-w-badgeCount tw-text-center tw-bg-badge tw-py-0 tw-px-0\"]"); // count of services
    List<WebElement> listOfItems = webDriver.findElements(serviceName);
    List<WebElement> countOfItems = webDriver.findElements(countService);
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : listOfItems) {
      Names.add(sName.getText());
      if (Names.contains("Tier1")) {
        break;
      }
    }
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, topicCount);
  }
}
