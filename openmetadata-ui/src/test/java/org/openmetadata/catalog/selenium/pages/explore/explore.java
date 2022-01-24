package org.openmetadata.catalog.selenium.pages.explore;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.pages.tableDetails.TableDetailsPageTest;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class explore extends TableDetailsPageTest {
  WebDriver webDriver;
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
    explorePage explorePage = new explorePage(webDriver);
    myDataPage myDataPage = new myDataPage(webDriver);
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    explorePage.explore().click();
    Thread.sleep(1000);
  }

  @Test
  @Order(2)
  public void checkTableCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    openExplorePage();
    Thread.sleep(2000);
    int tableCount = Integer.parseInt(explorePage.getTableCount().getText());
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
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, tableCount);
  }

  @Test
  @Order(3)
  public void checkTopicCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    openExplorePage();
    Thread.sleep(1000);
    explorePage.topics().click();
    int topicCount = Integer.parseInt(explorePage.getTopicCount().getText());
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
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, topicCount);
  }

  @Test
  @Order(3)
  public void checkDashboardCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    openExplorePage();
    explorePage.dashboard().click();
    int dashboardCount = Integer.parseInt(explorePage.getDashboardCount().getText());
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
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, dashboardCount);
  }

  @Test
  public void checkPipelineCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    openExplorePage();
    Thread.sleep(1000);
    explorePage.pipeline().click();
    Thread.sleep(1000);
    int pipelineCount = Integer.parseInt(explorePage.getPipelineCount().getText());
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
    for (int i = 0; i < Names.size() - 1; i++) {
      count.add(Integer.parseInt(countOfItems.get(i).getText()));
      getServiceCount += count.get(i);
    }
    Assert.assertEquals(getServiceCount, pipelineCount);
  }

  @Test
  public void checkBasics() throws Exception {
    explorePage explorePage = new explorePage(webDriver);
    tableDetails tableDetails = new tableDetails(webDriver);
    myDataPage myDataPage = new myDataPage(webDriver);
    openExplorePage();
    Thread.sleep(1000);
    explorePage.selectTable().click();
    Thread.sleep(1000);
    explorePage.addTag().click();
    Thread.sleep(1000);
    tableDetails.addTagTextBox().click();
    Thread.sleep(1000);
    tableDetails.addTagTextBox().sendKeys("P");
    Thread.sleep(1000);
    tableDetails.selectTag().click();
    Thread.sleep(1000);
    tableDetails.saveTag().click();
    Thread.sleep(1000);
    myDataPage.clickHome().click();
    Thread.sleep(1000);
    explorePage.explore().click();
    Thread.sleep(1000);
    try {
      explorePage.serviceText().isDisplayed();
    } catch (Exception e) {
      throw new Exception("Service Text Not displayed");
    }
    try {
      explorePage.tierText().isDisplayed();
    } catch (Exception e) {
      throw new Exception("Tier Text Not displayed");
    }
    try {
      explorePage.tagText().isDisplayed();
    } catch (Exception e) {
      throw new Exception("Tags Text Not displayed");
    }
    try {
      explorePage.databaseText().isDisplayed();
    } catch (Exception e) {
      throw new Exception("Database Text Not displayed");
    }
  }

  @Test
  public void checkLastUpdatedSort() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    tableDetails tableDetails = new tableDetails(webDriver);
    String sendKeys = "Description Added";
    openExplorePage();
    wait.until(ExpectedConditions.visibilityOf(explorePage.serviceText()));
    explorePage.selectTable().click();
    Thread.sleep(1000);
    wait.until(ExpectedConditions.visibilityOf(tableDetails.editDescriptionButton()));
    tableDetails.editDescriptionButton().click();
    Thread.sleep(1000);
    tableDetails.editDescriptionBox().sendKeys(Keys.CONTROL + "A");
    Thread.sleep(1000);
    tableDetails.editDescriptionBox().sendKeys(sendKeys);
    Thread.sleep(1000);
    tableDetails.saveTableDescription().click();
    Thread.sleep(1000);
    explorePage.explore().click();
    Thread.sleep(1000);
    wait.until(ExpectedConditions.visibilityOf(explorePage.serviceText()));
    explorePage.lastWeekSortDesc().click();
    Thread.sleep(1000);
    explorePage.lastWeekSortAesc().click();
    Thread.sleep(1000);
    Assert.assertEquals(sendKeys, explorePage.descriptionCheck().getText());
  }

  @Test
  public void checkRandomTableCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    Integer[] check;
    openExplorePage();
    Thread.sleep(1000);
    explorePage.bigQueryCheckbox().click();
    Thread.sleep(1000);
    explorePage.shopifyCheckbox().click();
    Thread.sleep(1000);
    explorePage.tagSpecialCategoryCheckbox().click();
    Thread.sleep(1000);
    explorePage.tierTier3Checkbox().click();
    Thread.sleep(1000);
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    check = new Integer[count.size()];
    check = count.toArray(check);
    System.out.println("Ssize=" + selectedCheckbox.size());
    System.out.println("Ssize=" + check.length);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  public void checkRandomTopicCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    Integer[] check;
    openExplorePage();
    Thread.sleep(1000);
    explorePage.topics().click();
    Thread.sleep(1000);
    explorePage.tierTier3Checkbox().click();
    Thread.sleep(1000);
    explorePage.kafka().click();
    Thread.sleep(1000);
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    check = new Integer[count.size()];
    System.out.println("Ssize=" + selectedCheckbox.size());
    System.out.println("Ssize=" + check.length);
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    check = count.toArray(check);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  public void checkRandomDashboardCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    Integer[] check;
    openExplorePage();
    Thread.sleep(1000);
    explorePage.dashboard().click();
    Thread.sleep(1000);
    explorePage.tierTier3Checkbox().click();
    Thread.sleep(1000);
    explorePage.superset().click();
    Thread.sleep(1000);
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    check = new Integer[count.size()];
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    check = count.toArray(check);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  public void checkRandomPipelineCount() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    Integer[] check;
    openExplorePage();
    Thread.sleep(1000);
    explorePage.pipeline().click();
    Thread.sleep(1000);
    explorePage.tierTier3Checkbox().click();
    Thread.sleep(1000);
    explorePage.airflow().click();
    Thread.sleep(1000);
    List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
    List<Integer> count = new ArrayList<>();
    check = new Integer[count.size()];
    System.out.println("Ssize=" + selectedCheckbox.size());
    System.out.println("Ssize=" + check.length);
    for (WebElement e : selectedCheckbox) {
      count.add(Integer.parseInt(e.getText()));
    }
    check = count.toArray(check);
    for (int i = 0; i < check.length - 1; i++) {
      Assert.assertEquals(check[i], check[i + 1]);
    }
  }

  @Test
  public void checkSearchBarInvalidValue() throws InterruptedException {
    explorePage explorePage = new explorePage(webDriver);
    myDataPage myDataPage = new myDataPage(webDriver);
    String searchCriteria = "asasds";
    myDataPage.closeWhatsNew().click();
    Thread.sleep(1000);
    wait.until(ExpectedConditions.elementToBeClickable(myDataPage.getSearchBox()));
    myDataPage.getSearchBox().sendKeys(searchCriteria);
    myDataPage.getSearchBox().sendKeys(Keys.ENTER);
    Thread.sleep(1000);
    try {
      WebElement errorMessage = explorePage.errorMessage();
      Assert.assertEquals(errorMessage.getText(), "No matching data assets found for " + searchCriteria);
    } catch (Exception e) {
      e.printStackTrace();
    }
    Thread.sleep(1000);
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
