package org.openmetadata.catalog.selenium.pages.explore;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.Keys;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(9)
class Explore {
  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static Faker faker = new Faker();
  Integer waitTime = Property.getInstance().getSleepTime();
  String tableName = "dim_address";
  MyDataPage myDataPage;
  TagsPage tagsPage;
  TeamsPage teamsPage;
  UserListPage userListPage;
  TableDetails tableDetails;
  Common common;
  ExplorePage explorePage;
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  Integer[] check;

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    explorePage = new ExplorePage(webDriver);
    myDataPage = new MyDataPage(webDriver);
    userListPage = new UserListPage(webDriver);
    teamsPage = new TeamsPage(webDriver);
    tagsPage = new TagsPage(webDriver);
    tableDetails = new TableDetails(webDriver);
    common = new Common(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  void openExplorePage() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, explorePage.explore());
    if (webDriver.findElement(explorePage.tableCount()).isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail("Table count not displayed");
    }
  }

  @Test
  @Order(2)
  void checkTableCount() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    WebElement tabCount = webDriver.findElement(explorePage.tableCount());
    int tableCount = Integer.parseInt(tabCount.getText());
    int getServiceCount = 0;
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : explorePage.serviceName()) {
      Names.add(sName.getText());
      if (Names.contains("Tier1")) {
        break;
      }
    }
    // Adding the service checkbox count and asserting with the table count displayed
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, tableCount);
  }

  @Test
  @Order(3)
  void checkTopicCount() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    WebElement topCount = webDriver.findElement(explorePage.topicCount());
    int topicCount = Integer.parseInt(topCount.getText());
    int getServiceCount = 0;
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : explorePage.serviceName()) {
      Names.add(sName.getText());
      if (Names.contains("Tier1")) {
        break;
      }
    }
    // Adding the service checkbox count and asserting with the topic count displayed
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, topicCount);
  }

  @Test
  @Order(4)
  void checkDashboardCount() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.dashboard());
    WebElement dashCount = webDriver.findElement(explorePage.dashboardCount());
    int dashboardCount = Integer.parseInt(dashCount.getText());
    int getServiceCount = 0;
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : explorePage.serviceName()) {
      Names.add(sName.getText());
      if (Names.contains("Tier1")) {
        break;
      }
    }
    // Adding the service checkbox count and asserting with the dashboard count displayed
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, dashboardCount);
  }

  @Test
  @Order(5)
  void checkPipelineCount() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.pipeline());
    WebElement pipCount = webDriver.findElement(explorePage.pipelineCount());
    int pipelineCount = Integer.parseInt(pipCount.getText());
    int getServiceCount = 0;
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : explorePage.serviceName()) {
      Names.add(sName.getText());
      if (Names.contains("Tier1")) {
        break;
      }
    }
    // Adding the service checkbox count and asserting with the pipeline count displayed
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, pipelineCount);
  }

  @Test
  @Order(6)
  void checkBasics() throws Exception {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    // Doing add tags first to get Tags checkbox in the left panel
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, explorePage.addTag());
    Events.click(webDriver, tableDetails.addTagTextBox());
    Events.sendKeys(webDriver, tableDetails.addTagTextBox(), "P");
    Events.click(webDriver, tableDetails.selectTag());
    Events.click(webDriver, tableDetails.saveTag());
    webDriver.navigate().back();
    Events.click(webDriver, explorePage.explore());
    try {
      webDriver.findElement(explorePage.serviceText());
    } catch (NoSuchElementException noSuchElementException) {
      Assert.fail("Service Text Not displayed");
    }
    try {
      webDriver.findElement(explorePage.tierText());
    } catch (NoSuchElementException noSuchElementException) {
      Assert.fail("Tier Text Not displayed");
    }
    try {
      webDriver.findElement(explorePage.databaseText());
    } catch (NoSuchElementException noSuchElementException) {
      Assert.fail("Database Text Not displayed");
    }
  }

  @Test
  @Order(7)
  void checkLastUpdatedSort() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String sendKeys = faker.address().toString();
    openExplorePage();
    // Adding description to check last updated sort
    Events.click(webDriver, common.selectTableLink(1));
    Events.click(webDriver, tableDetails.editDescriptionButton());
    Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), sendKeys);
    Events.click(webDriver, tableDetails.saveTableDescription());
    Thread.sleep(2000);
    Events.click(webDriver, explorePage.explore());
    webDriver.navigate().refresh();
    Events.click(webDriver, explorePage.lastUpdatedSort());
    Events.click(webDriver, explorePage.lastUpdatedSort());
    Thread.sleep(2000);
    try {
      String descriptionCheck = webDriver.findElement(explorePage.updatedDescription()).getText();
      Assert.assertEquals(descriptionCheck, sendKeys);
    } catch (NoSuchElementException e) {
      Assert.fail("Description not updated || Not sorting according to last updated");
    }
  }

  @Test
  @Order(8)
  void checkRandomTableCount() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.bigQueryCheckbox());
    Events.click(webDriver, explorePage.shopifyCheckbox());
    Events.click(webDriver, explorePage.tierTier3Checkbox());
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    // Checking count to selected checkbox count
    check = new Integer[count.size()];
    check = count.toArray(check);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  @Order(9)
  public void checkRandomTopicCount() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    Events.click(webDriver, explorePage.tierTier3Checkbox());
    Events.click(webDriver, explorePage.kafka());
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    // Checking count to selected checkbox count
    check = new Integer[count.size()];
    check = count.toArray(check);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  @Order(10)
  void checkRandomDashboardCount() {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.dashboard());
    Events.click(webDriver, explorePage.tierTier3Checkbox());
    Events.click(webDriver, explorePage.superset());
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    // Checking count to selected checkbox count
    check = new Integer[count.size()];
    check = count.toArray(check);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  @Order(11)
  void checkRandomPipelineCount() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, explorePage.pipeline());
    Events.click(webDriver, explorePage.tierTier3Checkbox());
    Events.click(webDriver, explorePage.airflow());
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    // Checking count to selected checkbox count
    check = new Integer[count.size()];
    check = count.toArray(check);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  @Order(12)
  void checkSearchBarInvalidValue() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    String searchCriteria = "asasds";
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.sendKeys(webDriver, myDataPage.searchBox(), searchCriteria);
    Events.sendEnter(webDriver, myDataPage.searchBox());
    try {
      WebElement errorMessage = webDriver.findElement(explorePage.errorMessage());
      Assert.assertEquals(errorMessage.getText(), "No matching data assets found for " + searchCriteria);
    } catch (NoSuchElementException e) {
      Assert.fail("Element not found");
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
