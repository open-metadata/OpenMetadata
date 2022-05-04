package org.openmetadata.catalog.selenium.pages.roles;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import lombok.extern.slf4j.Slf4j;
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
import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.*;
import org.testng.Assert;

@Slf4j
@Order(19)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RolesPageTest {
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

  @BeforeEach
  void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    rolesPage = new RolesPage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(2)
  void addRole() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, rolesPage.addRoleButton());
    actions.moveToElement(webDriver.findElement(rolesPage.policiesDropdown())).perform();
    Events.click(webDriver, rolesPage.policiesDropdown());
    Events.click(webDriver, rolesPage.listItem());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendEnter(webDriver, common.focusedDescriptionBox());
    Events.click(webDriver, common.descriptionItalicButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    webDriver.navigate().refresh();
    try {
      wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(xpath)));
    } catch (NoSuchElementException | TimeoutException e) {
      Assert.fail("Role not added");
    }
  }

  @Test
  @Order(3)
  void editDescription() {
    String description = faker.address().toString();
    String roleName = "Data Consumer";
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.waitForElementToDisplay(webDriver, common.containsText(roleDisplayName), 10, 2);
    Events.click(webDriver, common.containsText(roleName));
    Events.click(webDriver, common.editTagCategoryDescription());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), description);
    Events.click(webDriver, common.editDescriptionSaveButton());
    webDriver.navigate().refresh();
    Events.click(webDriver, common.containsText(roleName));
    String updatedDescription = webDriver.findElement(rolesPage.descriptionContainer()).getText();
    Assert.assertEquals(updatedDescription, description);
  }

  @Test
  @Order(4)
  void addRules() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, common.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.addRule());
    Select se = new Select(webDriver.findElement(rolesPage.listOperation()));
    Events.click(webDriver, rolesPage.listOperation());
    se.selectByVisibleText("Update Teams");
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("allow"));
    Events.click(webDriver, common.descriptionSaveButton());
    try {
      webDriver.findElement(rolesPage.operation());
      webDriver.findElement(rolesPage.access());
    } catch (NoSuchElementException | TimeoutException e) {
      Assert.fail("Rules not added");
    }
  }

  @Test
  @Order(5)
  void editRule() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, common.containsText("Data Consumer"));
    Events.click(webDriver, rolesPage.editRuleButton());
    Select se = new Select(webDriver.findElement(rolesPage.listAccess()));
    se.selectByVisibleText("DENY");
    Events.click(webDriver, common.descriptionSaveButton());
    Events.waitForElementToDisplay(webDriver, rolesPage.usersTab(), 10, 2);
    String access = webDriver.findElement(rolesPage.accessValue()).getAttribute("innerHTML");
    Assert.assertEquals(access, "DENY");
  }

  @Test
  @Order(6)
  void deleteRule() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, common.containsText(roleDisplayName));
    Events.waitForElementToDisplay(webDriver, common.containsText(roleDisplayName), 10, 2);
    String ruleName = webDriver.findElement(rolesPage.ruleName()).getText();
    Events.click(webDriver, rolesPage.deleteRuleButton());
    Events.click(webDriver, common.saveEditedService());
    webDriver.navigate().refresh();
    try {
      if (webDriver.findElement(common.containsText(ruleName)).isDisplayed()) {
        Assert.fail("Rule not deleted");
      }
    } catch (NoSuchElementException | TimeoutException e) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(7)
  void checkBlankName() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, rolesPage.addRoleButton());
    actions.moveToElement(webDriver.findElement(rolesPage.policiesDropdown())).perform();
    Events.click(webDriver, rolesPage.policiesDropdown());
    Events.click(webDriver, rolesPage.listItem());
    Events.sendKeys(webDriver, common.displayName(), "");
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    try {
      WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
      Assert.assertEquals(errorMessage.getText(), "Name is required");
    } catch (NoSuchElementException | TimeoutException e) {
      Assert.fail("Error message not displayed");
    }
  }

  @Test
  @Order(8)
  void checkBlankDisplayName() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, rolesPage.addRoleButton());
    actions.moveToElement(webDriver.findElement(rolesPage.policiesDropdown())).perform();
    Events.click(webDriver, rolesPage.policiesDropdown());
    Events.click(webDriver, rolesPage.listItem());
    Events.sendKeys(webDriver, common.displayName(), faker.name().firstName());
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), "");
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    try {
      WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
      Assert.assertEquals(errorMessage.getText(), "Display name is required");
    } catch (TimeoutException | NoSuchElementException e) {
      Assert.fail("Error message not displayed");
    }
  }

  @Test
  @Order(9)
  void checkDuplicateRoleName() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String firstName = faker.name().firstName();
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, rolesPage.addRoleButton());
    actions.moveToElement(webDriver.findElement(rolesPage.policiesDropdown())).perform();
    Events.click(webDriver, rolesPage.policiesDropdown());
    Events.click(webDriver, rolesPage.listItem());
    Events.sendKeys(webDriver, common.displayName(), firstName);
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    webDriver.navigate().refresh();
    Events.click(webDriver, rolesPage.addRoleButton());
    actions.moveToElement(webDriver.findElement(rolesPage.policiesDropdown())).perform();
    Events.click(webDriver, rolesPage.policiesDropdown());
    Events.click(webDriver, rolesPage.listItem());
    Events.sendKeys(webDriver, common.displayName(), firstName);
    Events.sendKeys(webDriver, rolesPage.rolesDisplayName(), roleDisplayName);
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    try {
      WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
      Assert.assertEquals(errorMessage.getText(), "Name already exists");
    } catch (TimeoutException | NoSuchElementException e) {
      Assert.fail("Error message not displayed");
    }
  }

  @Test
  @Order(10)
  void addRuleWithoutOperation() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Roles"));
    Events.click(webDriver, common.containsText(roleDisplayName));
    Events.click(webDriver, rolesPage.addRule());
    Events.click(webDriver, rolesPage.listAccess());
    Events.click(webDriver, rolesPage.selectAccess("allow"));
    Events.click(webDriver, common.descriptionSaveButton());
    try {
      WebElement errorMessage = webDriver.findElement(rolesPage.errorMessage());
      Assert.assertEquals(errorMessage.getText(), "Operation is required.");
    } catch (TimeoutException | NoSuchElementException e) {
      Assert.fail("Error message not displayed");
    }
  }

  @AfterEach
  void closeTabs() {
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
