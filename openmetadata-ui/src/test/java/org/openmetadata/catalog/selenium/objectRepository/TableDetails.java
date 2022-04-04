package org.openmetadata.catalog.selenium.objectRepository;

import java.util.List;
import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

@Getter
@RequiredArgsConstructor
public class TableDetails {
  @Nonnull WebDriver webDriver;

  By manage = By.cssSelector("[data-testid='Manage']");
  By owner = By.cssSelector("button[data-testid=\"owner-dropdown\"]");
  By users = By.xpath("//div[@data-testid='dropdown-list']//div[2]//button[2]");
  By selectUser = By.xpath("//div[@data-testid=\"list-item\"]");
  By saveManage = By.cssSelector("[data-testid='saveManageTab']");
  By follow = By.cssSelector("button[data-testid='follow-button']");
  By schema = By.xpath("[data-testid='Schema']");;
  By lineage = By.cssSelector("[data-testid='Lineage']");;
  By lineageComponents = By.xpath("//div[@class=\"tw-relative nowheel \"]");
  By profiler = By.cssSelector("[data-testid='Profiler']");
  By sampleData = By.cssSelector("[data-testid='Sample Data']");;
  By selectTier1 = By.xpath("(//div[@data-testid='card-list'])[1]");
  By tier1 = By.xpath("(/h4[@class='tw-text-base tw-mb-0']");
  By addTagTextBox = By.xpath("//input[@data-testid='associatedTagName']");
  By selectTag = By.xpath("//div[@data-testid=\"list-item\"][2]");
  By saveTag = By.xpath("//button[@data-testid=\"saveAssociatedTag\"]");
  By tagName = By.xpath("(//div[@data-testid=\"tag-container\"])[1]");
  By removeTag = By.xpath("//span[@data-testid='remove']");
  By editDescriptionButton = By.xpath("//button[@data-testid= 'edit-description']");
  By editDescriptionBox = By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div");
  By saveTableDescription = By.xpath("//button[@data-testid=\"save\"]");
  By selectedTag =
      By.xpath("//span[@class=\"tw-no-underline hover:tw-no-underline tw-py-0.5 tw-px-2 tw-pl-2 tw-pr-1\"]");
  By breadCrumbTags = By.xpath("//div[@data-testid='breadcrumb-tags']/div/span/span");
  By version = By.xpath("//button[@data-testid=\"version-button\"]");
  By versionDetailsGrid = By.xpath("//div[@class=\"tw-grid tw-gap-0.5\"]");
  By versionRadioButton = By.xpath("//span[@data-testid=\"select-version\"]");
  By descriptionBox = By.xpath("(//div[@data-testid='description']/div/span)[1]");
  By breadCrumb = By.xpath("//li[@data-testid=\"breadcrumb-link\"]");
  By sideDrawerLineage = By.xpath("//header[@class=\"tw-flex tw-justify-between\"]");
  By breadCrumbTier = By.xpath("//div[@class=\"tw-flex tw-gap-1 tw-mb-2 tw-mt-1 tw-ml-7 tw-flex-wrap\"]");
  By schemaTable = By.cssSelector("table[data-testid='schema-table']");
  By chart = By.xpath("//div[@class=\"recharts-wrapper\"]");
  By toolTip =
      By.xpath("//div[@class=\"recharts-tooltip-wrapper recharts-tooltip-wrapper-left recharts-tooltip-wrapper-top\"]");
  By columnDescriptionButton = By.xpath("//div[@data-testid='description']/span/span");
  By columnDescriptionBox = By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div");
  By columnDescription = By.xpath("(//div[@id='column-description-3'])[1]");
  By joinedTables = By.xpath("(//div[@data-testid='frequently-joined-columns']/span/a)");
  By joinedColumns = By.xpath("(//div[@data-testid='frequently-joined-columns']/span/a)");
  By sampleDataTable = By.xpath("//table[@data-testid='sample-data-table']");
  By columnTags = By.xpath("(//div[@data-testid='tag-conatiner'])[1]");
  By queries = By.cssSelector("[data-testid='Queries']");
  By openSidePanel = By.xpath("//p[@class='link-text tw-flex-none tw-ml-2']");
  By conversationBox = By.xpath("//div[@class='ql-editor ql-blank']");
  By sendButton = By.cssSelector("[data-testid='send-button']");
  By openConversationThread = By.xpath("//span[@class='tw-flex']");
  By addConversation = By.cssSelector("[data-testid='add-new-conversation']");
  By activityFeed = By.cssSelector("[data-testid='tab'][id='activityFeed']");
  By mainMessageReply = By.cssSelector("[data-testid=\"main-message-reply-button\"]");
  By quickReply = By.cssSelector("[data-testid=\"quick-reply-button\"]");
  By threadHeader = By.cssSelector("[data-testid='thread0']");
  By dataQuality = By.cssSelector("[data-testid='Data Quality']");
  By addTest = By.cssSelector("[data-testid=\"add-new-test-button\"]");
  By tableTest = By.xpath("//div[@data-testid=\"list-item\"][@id=\"menu-item-0\"]");
  By columnTest = By.xpath("//div[@data-testid=\"list-item\"][@id=\"menu-item-1\"]");
  By value = By.cssSelector("[data-testid=\"value\"]");
  By saveTest = By.xpath("//button[@data-testid='save-test']");
  By selectTableTest = By.cssSelector("[data-testid='tableTestType']");
  By selectColumn = By.cssSelector("[data-testid=\"columnName\"]");
  By selectColumnTest = By.cssSelector("[data-testid=\"columTestType\"]");
  By regex = By.cssSelector("[data-testid='regex']");
  By deleteTests = By.cssSelector("[data-testid='delete']");
  By deleteSave = By.cssSelector("[data-testid='save-button']");
  By dismissToast = By.cssSelector("[data-testid='dismiss']");
  By lineageNode = By.cssSelector("[data-testid='lineage-entity']");
  By checkTabs = By.cssSelector("[data-testid='tab']");
  By addTagConversationThread = By.cssSelector("[data-testid='tag-thread']");
  By addDescriptionConversationThread = By.cssSelector("[data-testid='start-description-thread']");
  By openTagConversationThread = By.cssSelector("[data-testid='tag-thread']");
  By startTagConversation = By.cssSelector("[data-testid='start-tag-thread']");

  public List<WebElement> versionDetailsGrid() {
    return webDriver.findElements(versionDetailsGrid);
  }

  public List<WebElement> checkTabs() {
    return webDriver.findElements(checkTabs);
  }

  public List<WebElement> versionRadioButton() {
    return webDriver.findElements(versionRadioButton);
  }

  public List<WebElement> breadCrumb() {
    return webDriver.findElements(breadCrumb);
  }

  public List<WebElement> lineageNodes() {
    return webDriver.findElements(lineageComponents);
  }

  public List<WebElement> chart() {
    return webDriver.findElements(chart);
  }

  public boolean schemaTableIsDisplayed() {
    return webDriver.findElement(schemaTable).isDisplayed();
  }

  public By select(String user) {
    return By.xpath("//li[@data-value='" + user + "']");
  }
}
