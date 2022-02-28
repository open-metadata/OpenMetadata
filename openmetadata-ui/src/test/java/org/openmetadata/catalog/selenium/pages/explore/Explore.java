package org.openmetadata.catalog.selenium.pages.explore;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
class Explore {
  WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  String tableName = "dim_address";
  MyDataPage myDataPage;
  TagsPage tagsPage;
  TeamsPage teamsPage;
  UserListPage userListPage;
  TableDetails tableDetails;
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
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  void openExplorePage() {
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.click(webDriver, explorePage.explore());
    if (webDriver.findElement(explorePage.tableCount()).isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail();
    }
  }

  @Test
  @Order(2)
  void checkTableCount() {
    openExplorePage();
    WebElement tabCount = webDriver.findElement(explorePage.tableCount());
    int tableCount = Integer.parseInt(tabCount.getText());
    int getServiceCount = 0;
    List<WebElement> listOfItems = explorePage.serviceName();
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : listOfItems) {
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
  void checkTopicCount() {
    openExplorePage();
    Events.click(webDriver, explorePage.topics());
    WebElement topCount = webDriver.findElement(explorePage.topicCount());
    int topicCount = Integer.parseInt(topCount.getText());
    int getServiceCount = 0;
    List<WebElement> listOfItems = explorePage.serviceName();
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : listOfItems) {
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
    openExplorePage();
    Events.click(webDriver, explorePage.dashboard());
    WebElement dashCount = webDriver.findElement(explorePage.dashboardCount());
    int dashboardCount = Integer.parseInt(dashCount.getText());
    int getServiceCount = 0;
    List<WebElement> listOfItems = explorePage.serviceName();
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : listOfItems) {
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
    openExplorePage();
    Events.click(webDriver, explorePage.pipeline());
    WebElement pipCount = webDriver.findElement(explorePage.pipelineCount());
    int pipelineCount = Integer.parseInt(pipCount.getText());
    int getServiceCount = 0;
    List<WebElement> listOfItems = explorePage.serviceName();
    List<WebElement> countOfItems = explorePage.serviceCount();
    List<String> Names = new ArrayList<>();
    List<Integer> count = new ArrayList<>();
    for (WebElement sName : listOfItems) {
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
    WebElement serviceText = webDriver.findElement(explorePage.serviceText());
    WebElement tierText = webDriver.findElement(explorePage.tierText());
    WebElement tagText = webDriver.findElement(explorePage.tagText());
    WebElement databaseText = webDriver.findElement(explorePage.databaseText());

    if (serviceText.isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail("Service Text Not displayed");
    }
    if (tierText.isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail("Tier Text Not displayed");
    }
    if (tagText.isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail("Tag Text Not displayed");
    }
    if (databaseText.isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail("Database Text Not displayed");
    }
  }

  @Test
  @Order(7)
  void checkLastUpdatedSort() throws InterruptedException {
    String sendKeys = "Description Added";
    openExplorePage();
    // Adding description to check last updated sort
    Events.click(webDriver, explorePage.selectTable());
    Events.click(webDriver, tableDetails.editDescriptionButton());
    Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), sendKeys);
    Events.click(webDriver, tableDetails.saveTableDescription());
    Events.click(webDriver, explorePage.explore());
    Events.click(webDriver, explorePage.lastWeekSortDesc());
    Events.click(webDriver, explorePage.lastWeekSortAesc());
    WebElement descriptionCheck = webDriver.findElement(explorePage.updatedDescription());
    Assert.assertEquals(sendKeys, descriptionCheck.getText());
  }

  @Test
  @Order(8)
  void checkRandomTableCount() {
    openExplorePage();
    Events.click(webDriver, explorePage.bigQueryCheckbox());
    Events.click(webDriver, explorePage.shopifyCheckbox());
    Events.click(webDriver, explorePage.tagSpecialCategoryCheckbox());
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
    String searchCriteria = "asasds";
    Events.click(webDriver, myDataPage.closeWhatsNew());
    Events.sendKeys(webDriver, myDataPage.searchBox(), searchCriteria);
    Events.sendEnter(webDriver, myDataPage.searchBox());
    try {
      WebElement errorMessage = webDriver.findElement(explorePage.errorMessage());
      Assert.assertEquals(errorMessage.getText(), "No matching data assets found for " + searchCriteria);
    } catch (Exception e) {
      Assert.fail();
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
