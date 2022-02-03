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
import org.openmetadata.catalog.selenium.objectRepository.DashboardServicePage;
import org.openmetadata.catalog.selenium.objectRepository.DatabaseServicePage;
import org.openmetadata.catalog.selenium.objectRepository.RolesPage;
import org.openmetadata.catalog.selenium.objectRepository.TagsPage;
import org.openmetadata.catalog.selenium.objectRepository.UserPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(19)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class RolesPageTest {

  private static final Logger LOG = Logger.getLogger(RolesPageTest.class.getName());

  static WebDriver webDriver;
  static TagsPage tagsPage;
  static DatabaseServicePage databaseServicePage;
  static DashboardServicePage dashboardServicePage;
  static UserPage userPage;
  static RolesPage rolesPage;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String roleDisplayName = faker.name().firstName();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver();
    tagsPage = new TagsPage(webDriver);
    databaseServicePage = new DatabaseServicePage(webDriver);
    dashboardServicePage = new DashboardServicePage(webDriver);
    userPage = new UserPage(webDriver);
    rolesPage = new RolesPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void openRolesPage() throws InterruptedException {
    Events.click(webDriver, tagsPage.closeWhatsNew()); // Close What's new
    Events.click(webDriver, tagsPage.headerSettings()); // Setting
    Events.click(webDriver, userPage.headerSettingsMenu("Roles"));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addRole() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, tagsPage.displayName(), faker.name().firstName());
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, tagsPage.descriptionBoldButton());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, tagsPage.addDescriptionString());
    Events.sendEnter(webDriver, tagsPage.addDescriptionString());
    Events.click(webDriver, tagsPage.descriptionItalicButton());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, tagsPage.addDescriptionString());
    Events.sendEnter(webDriver, tagsPage.addDescriptionString());
    Events.click(webDriver, tagsPage.descriptionLinkButton());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, tagsPage.descriptionSaveButton());
  }

  @Test
  @Order(3)
  public void editDescription() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, tagsPage.containsText(roleDisplayName));
    Events.click(webDriver, tagsPage.editTagCategoryDescription());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, tagsPage.editDescriptionSaveButton());
  }

  @Test
  @Order(4)
  public void addRules() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, tagsPage.containsText(roleDisplayName));
    Events.click(webDriver, databaseServicePage.noServicesAddServiceButton());
    Events.click(webDriver, rolesPage.listOperation());
    Events.click(webDriver, rolesPage.selectOperation("UpdateDescription"));
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("allow"));
    Events.click(webDriver, rolesPage.ruleToggleButton());
    Events.click(webDriver, tagsPage.descriptionSaveButton());
  }

  @Test
  @Order(5)
  public void editRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, tagsPage.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.editRuleButton());
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("deny"));
    Events.click(webDriver, tagsPage.descriptionSaveButton());
    String access = webDriver.findElement(rolesPage.accessValue()).getAttribute("innerHTML");
    Assert.assertEquals(access, "DENY");
  }

  @Test
  @Order(6)
  public void deleteRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, tagsPage.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.deleteRuleButton());
    Events.click(webDriver, databaseServicePage.saveEditedService());
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
