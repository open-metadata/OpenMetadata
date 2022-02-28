package org.openmetadata.catalog.selenium.pages.roles;

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
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.RolesPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(19)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class RolesPageTest {
  static WebDriver webDriver;
  static Common common;
  static RolesPage rolesPage;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String roleDisplayName = faker.name().firstName();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  String xpath = "//p[@title = '" + roleDisplayName + "']";
  static String pageLoadStatus = null;
  JavascriptExecutor js;

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver();
    common = new Common(webDriver);
    rolesPage = new RolesPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  public void waitForPageLoad() {
    do {
      js = (JavascriptExecutor) webDriver;
      pageLoadStatus = (String) js.executeScript("return document.readyState");
    } while (!pageLoadStatus.equals("complete"));
  }

  @Test
  @Order(1)
  public void openRolesPage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addRole() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openRolesPage();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.addDescriptionString());
    Events.sendEnter(webDriver, common.addDescriptionString());
    Events.click(webDriver, common.descriptionItalicButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.addDescriptionString());
    Events.sendEnter(webDriver, common.addDescriptionString());
    Events.click(webDriver, common.descriptionLinkButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    webDriver.navigate().refresh();
    Thread.sleep(1000);
    WebElement role = wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(xpath)));
    if (!role.isDisplayed()) {
      Assert.fail("Role not added");
    }
  }

  @Test
  @Order(3)
  public void editDescription() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String description = faker.address().toString();
    String roleName = "Data Consumer";
    openRolesPage();
    Events.click(webDriver, common.containsText(roleName));
    Events.click(webDriver, common.editTagCategoryDescription());
    Events.sendKeys(webDriver, common.addDescriptionString(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, common.addDescriptionString(), description);
    Events.click(webDriver, common.editDescriptionSaveButton());
    Events.click(webDriver, common.containsText(roleName));
    String updatedDescription = webDriver.findElement(common.descriptionContainer()).getText();
    Assert.assertEquals(updatedDescription, description);
  }

  @Test
  @Order(4)
  public void addRules() throws InterruptedException {
    openRolesPage();
    String roleName = "Data Consumer";
    Events.click(webDriver, common.containsText(roleName));
    Events.click(webDriver, rolesPage.addRule());
    Events.click(webDriver, rolesPage.listOperation());
    Events.click(webDriver, rolesPage.selectOperation("UpdateDescription"));
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("allow"));
    Events.click(webDriver, rolesPage.ruleToggleButton());
    Events.click(webDriver, common.descriptionSaveButton());
    Thread.sleep(1000);
    WebElement operation = webDriver.findElement(rolesPage.operation());
    WebElement access = webDriver.findElement(rolesPage.access());
    if (!operation.isDisplayed() && !access.isDisplayed()) {
      Assert.fail("Rules not added");
    }
  }

  @Test
  @Order(5)
  public void editRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, common.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.editRuleButton());
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("deny"));
    Events.click(webDriver, common.descriptionSaveButton());
    String access = webDriver.findElement(rolesPage.accessValue()).getAttribute("innerHTML");
    Assert.assertEquals(access, "DENY");
  }

  @Test
  @Order(6)
  public void deleteRule() throws InterruptedException {
    openRolesPage();
    Events.click(webDriver, common.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.deleteRuleButton());
    Events.click(webDriver, common.saveEditedService());
  }

  @Test
  @Order(7)
  public void checkBlankName() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openRolesPage();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, common.displayName(), "");
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
    if (errorMessage.isDisplayed()) {
      Assert.assertEquals(errorMessage.getText(), "Name is required");
    } else {
      Assert.fail("Error message not displayed");
    }
  }

  @Test
  @Order(8)
  public void checkBlankDisplayName() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openRolesPage();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), "");
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
    if (errorMessage.isDisplayed()) {
      Assert.assertEquals(errorMessage.getText(), "Display name is required");
    } else {
      Assert.fail("Error message not displayed");
    }
  }

  @Test
  @Order(9)
  public void checkDuplicateRoleName() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String firstName = faker.name().firstName();
    openRolesPage();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, common.displayName(), firstName);
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    Thread.sleep(waitTime);
    webDriver.navigate().refresh();
    Events.click(webDriver, rolesPage.addRoleButton());
    Events.sendKeys(webDriver, common.displayName(), firstName);
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
    if (errorMessage.isDisplayed()) {
      Assert.assertEquals(errorMessage.getText(), "Name already exists");
    } else {
      Assert.fail("Error message not displayed");
    }
  }

  @Test
  @Order(10)
  public void addRuleWithoutOperation() throws InterruptedException {
    addRole();
    Events.click(webDriver, common.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.addRule());
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("allow"));
    Events.click(webDriver, rolesPage.ruleToggleButton());
    Events.click(webDriver, common.descriptionSaveButton());
    WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
    if (errorMessage.isDisplayed()) {
      Assert.assertEquals(errorMessage.getText(), "Operation is required.");
    } else {
      Assert.fail("Rule added without selecting operation");
    }
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
