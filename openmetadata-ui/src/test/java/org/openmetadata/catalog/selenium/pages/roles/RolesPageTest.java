package org.openmetadata.catalog.selenium.pages.roles;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.logging.Logger;
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
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(19)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class RolesPageTest {

  private static final Logger LOG = Logger.getLogger(RolesPageTest.class.getName());

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String roleDisplayName = faker.name().firstName();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();

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
  }

  @Test
  @Order(1)
  public void openRolesPage() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Roles']")); // Setting/Roles
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addRole() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, By.cssSelector("[data-testid='add-role']"));
    Events.sendKeys(webDriver, By.name("name"), faker.name().firstName()); // name
    Events.sendKeys(webDriver, By.name("displayName"), roleDisplayName); // displayName
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='boldButton']"));
    Events.click(webDriver, By.cssSelector("[data-testid='italicButton']"));
    Events.click(webDriver, By.cssSelector("[data-testid='linkButton']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
  }

  @Test
  @Order(3)
  public void editDescription() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + roleDisplayName + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
    wait.until(ExpectedConditions.elementToBeClickable(By.xpath(enterDescription)));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  }

  @Test
  @Order(4)
  public void addRules() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + roleDisplayName + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='add-new-user-button']"));
    Events.click(webDriver, By.cssSelector("[data-testid='select-operation']"));
    Events.click(webDriver, By.cssSelector("[value='UpdateDescription']"));
    Events.click(webDriver, By.cssSelector("[data-testid='select-access']"));
    Events.click(webDriver, By.cssSelector("[value='allow']"));
    Events.click(webDriver, By.cssSelector("[data-testid='rule-switch']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
  }

  @Test
  @Order(5)
  public void editRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + roleDisplayName + "')]] "));
    Events.click(webDriver, By.xpath("//tbody[@data-testid='table-body']/tr/td[4]/div/span"));
    Events.click(webDriver, By.cssSelector("[data-testid='select-access']"));
    Events.click(webDriver, By.cssSelector("[value='deny']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
    Thread.sleep(2000);
    String access =
        webDriver.findElement(By.xpath("//tbody[@data-testid='table-body']/tr/td[2]/p")).getAttribute("innerHTML");
    Assert.assertEquals(access, "DENY");
  }

  @Test
  @Order(6)
  public void deleteRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + roleDisplayName + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='image'][title='Delete']"));
    Events.click(webDriver, By.cssSelector("[data-testid='save-button']"));
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
