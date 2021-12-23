package org.openmetadata.catalog.selenium.pages.common;

import com.github.javafaker.Faker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.devtools.v95.fetch.Fetch;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Optional;

public class UiExceptionHandling {

  static ChromeDriver webDriver;
  static DevTools devTools;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static Faker faker = new Faker();
  static String serviceName = faker.name().firstName();


  public void interceptor(String content, String replaceContent) {
    devTools.createSession();
    devTools.send(Fetch.enable(Optional.empty(), Optional.empty()));
    devTools.addListener(Fetch.requestPaused(), request ->
    {
      if(request.getRequest().getUrl().contains(content))
      {
        String mockedUrl = request.getRequest().getUrl().replace(content, replaceContent);
        devTools.send(Fetch.continueRequest(request.getRequestId(), Optional.of(mockedUrl), Optional.of(request.getRequest().getMethod()),
            Optional.empty(), Optional.empty(), Optional.empty()));
      }
      else {
        devTools.send(Fetch.continueRequest(request.getRequestId(), Optional.of(request.getRequest().getUrl()), Optional.of(request.getRequest().getMethod()),
            Optional.empty(), Optional.empty(), Optional.empty()));
      }
    });
  }

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
    devTools = webDriver.getDevTools();
  }

  @Test
  public void exceptionCheckForUserList() {
    interceptor("users", "testing");
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Users']")); // Setting/Users
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + "Request failed with status code 400" + "')]]"));
    Events.click(webDriver, By.cssSelector("[data-testid='dismiss']"));
    Assert.assertEquals(400, 400);
  }

  @Test
  public void exceptionCheckForGetServices() throws InterruptedException {
    interceptor("databaseService", "testing");
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Services']")); // Setting/Services
    Thread.sleep(2000);
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + "No services found" + "')]]"));
    Assert.assertEquals(500, 500);
  }

  @Test
  public void exceptionCheckFor() {
    interceptor("services/databaseServices", "services/testing");
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Services']")); // Setting/Services
  }

  @Test
  public void exceptionCheckForPostService() {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Services']")); // Setting/Services
      Events.click(webDriver, By.cssSelector("[data-testid='add-new-user-button']"));
    Events.click(webDriver, By.cssSelector("[data-testid='selectService']"));
    Events.click(webDriver, By.cssSelector("[value='MySQL']"));
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='name']"), serviceName);
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='url']"), "localhost:3306");
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='database']"), "openmetadata_db");

    Events.click(webDriver, By.cssSelector("[data-testid='boldButton']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    interceptor("services/databaseServices", "services/testing");
    Events.click(webDriver, By.cssSelector("[data-testid='save-button']"));
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + "Request failed with status code 500" + "')]]"));
    Events.click(webDriver, By.cssSelector("[data-testid='dismiss']"));
    Assert.assertEquals(500, 500);
  }

  @Test
  public void exceptionCheckForUpdateService() {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Services']")); // Setting/Services
    Events.click(webDriver, By.cssSelector("[data-testid='edit-service-"+ "bigquery_gcp" + "']"));
    Events.click(webDriver, By.xpath(enterDescription));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    interceptor("services/databaseServices", "services/testing");
    Events.click(webDriver, By.cssSelector("[data-testid='save-button']"));
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + "Request failed with status code 500" + "')]]"));
    Events.click(webDriver, By.cssSelector("[data-testid='dismiss']"));
    Assert.assertEquals(500, 500);
  }

  @Test
  public void exceptionCheckForDeleteService() {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Services']")); // Setting/Services
    Events.click(webDriver, By.cssSelector("[data-testid='delete-service-"+ "bigquery_gcp" + "']"));
    interceptor("services/databaseServices", "services/testing");
    Assert.assertEquals(500, 500);
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
