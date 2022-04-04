package org.openmetadata.catalog.selenium.pages.tableDetails;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.TableDetails;
import org.openmetadata.catalog.selenium.pages.common.Interceptor;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(21)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TableDetailsUIErrorHandling {

  static ChromeDriver webDriver;
  static Common common;
  static TableDetails tableDetails;
  static DevTools devTools;
  static Interceptor interceptor;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static Faker faker = new Faker();
  static String serviceName = faker.name().firstName();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  static By toastMessage = By.cssSelector("[data-testid='toast']");
  List<WebElement> checkTabs = new ArrayList<>();
  WebElement explore;
  WebElement headerSettings;
  WebElement version;
  WebElement follow;

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    devTools = webDriver.getDevTools();
    interceptor = new Interceptor(devTools);
    tableDetails = new TableDetails(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  void assertElements() {
    explore = webDriver.findElement(common.explore());
    Assert.assertTrue(explore.isDisplayed());
    headerSettings = webDriver.findElement(common.headerSettings());
    Assert.assertTrue(headerSettings.isDisplayed());
    version = webDriver.findElement(common.version());
    Assert.assertTrue(version.isDisplayed());
    follow = webDriver.findElement(common.follow());
    Assert.assertTrue(follow.isDisplayed());
  }

  @Test
  @Order(1)
  void exceptionCheckForFetchTableDetails() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    interceptor.interceptor("/tables/name", "/testing/name");
    Events.click(webDriver, common.selectTableLink(1));
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching table details!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(2)
  void exceptionCheckForFetchQueries() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    interceptor.interceptor("/tables/name", "/testing/name");
    Events.click(webDriver, tableDetails.queries());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching table queries!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
    assertElements();
  }

  @Test
  @Order(3)
  void exceptionCheckForAddTags() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, common.addTag());
    Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
    Events.click(webDriver, common.tagListItem());
    interceptor.interceptor("/tables", "testing");
    Events.click(webDriver, common.saveAssociatedTag());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while updating tags!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(4)
  void exceptionCheckForCreateConversation() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Thread.sleep(2000);
    Events.click(webDriver, tableDetails.openTagConversationThread());
    Events.click(webDriver, tableDetails.addConversation());
    Events.click(webDriver, tableDetails.conversationBox());
    Events.sendKeys(webDriver, tableDetails.conversationBox(), "@");
    Events.click(webDriver, tableDetails.select("@aaron_johnson0"));
    interceptor.interceptor("/feed", "/test");
    Events.click(webDriver, tableDetails.sendButton());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while creating conversation!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(5)
  void exceptionCheckForFetchConversationThreads() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    interceptor.interceptor("/feed", "/test");
    Events.click(webDriver, tableDetails.openTagConversationThread());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching threads!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(6)
  void exceptionCheckForAddFeed() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.openTagConversationThread());
    Events.click(webDriver, tableDetails.mainMessageReply());
    Events.click(webDriver, tableDetails.conversationBox());
    Events.sendKeys(webDriver, tableDetails.conversationBox(), "Message");
    interceptor.interceptor("/feed", "/test");
    Events.click(webDriver, tableDetails.sendButton());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while adding feed!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(8)
  void exceptionCheckForAddTableTests() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.dataQuality());
    Events.click(webDriver, tableDetails.addTest());
    Events.click(webDriver, tableDetails.tableTest());
    Select selectTest = new Select(webDriver.findElement(tableDetails.selectTableTest()));
    selectTest.selectByIndex(3);
    Events.sendKeys(webDriver, tableDetails.value(), "10");
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, tableDetails.saveTest());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while adding table test!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(9)
  void exceptionCheckForAddColumnTests() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.dataQuality());
    Events.click(webDriver, tableDetails.addTest());
    Events.click(webDriver, tableDetails.columnTest());
    Select selectColumn = new Select(webDriver.findElement(tableDetails.selectColumn()));
    selectColumn.selectByIndex(1);
    Select selectTest = new Select(webDriver.findElement(tableDetails.selectColumnTest()));
    selectTest.selectByIndex(3);
    Events.sendKeys(webDriver, tableDetails.regex(), "10");
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, tableDetails.saveTest());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while adding column test!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(10)
  void exceptionCheckForDeleteTests() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.dataQuality());
    Events.click(webDriver, tableDetails.addTest());
    Events.click(webDriver, tableDetails.tableTest());
    Select selectTest = new Select(webDriver.findElement(tableDetails.selectTableTest()));
    selectTest.selectByIndex(3);
    Events.sendKeys(webDriver, tableDetails.value(), "10");
    Events.click(webDriver, tableDetails.saveTest());
    Events.click(webDriver, tableDetails.dismissToast());
    Thread.sleep(2000);
    Events.click(webDriver, tableDetails.deleteTests());
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, tableDetails.deleteSave());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while deleting test!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(11)
  void exceptionCheckForFetchLineage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.lineage());
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, tableDetails.lineageNode());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while fetching lineage data!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(12)
  void exceptionCheckForUpdatingDescription() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.editDescriptionButton());
    Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), "updatedDescription");
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, tableDetails.saveTableDescription());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while updating description!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(12)
  void exceptionCheckForUnfollow() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Thread.sleep(1000);
    String follow = webDriver.findElement(common.follow()).getText();
    if (follow.equals("Follow")) {
      Events.click(webDriver, common.follow());
    }
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, common.follow());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while unfollowing entity!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(12)
  void exceptionCheckForFollow() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Thread.sleep(1000);
    String follow = webDriver.findElement(common.follow()).getText();
    if (follow.equals("Unfollow")) {
      Events.click(webDriver, common.follow());
    }
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, common.follow());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while following entity!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
    }
  }

  @Test
  @Order(12)
  void exceptionCheckForManage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.manage());
    Events.click(webDriver, tableDetails.owner());
    Events.click(webDriver, tableDetails.selectUser());
    interceptor.interceptor("/api/v1/tables", "/api/v1/test");
    Events.click(webDriver, tableDetails.saveManage());
    Thread.sleep(2000);
    String errorMessage = webDriver.findElement(toastMessage).getText();
    Assert.assertEquals(errorMessage, "Error while updating entity!");
    checkTabs = tableDetails.checkTabs();
    for (WebElement e : checkTabs) {
      Assert.assertTrue(e.isDisplayed());
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
