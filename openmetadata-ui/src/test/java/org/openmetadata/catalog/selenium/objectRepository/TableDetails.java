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

  By manage = By.xpath("//button[@data-testid=\"tab\"][@id=\"manage\"]");
  By owner = By.cssSelector("button[data-testid=\"owner-dropdown\"]");
  By users = By.xpath("//div[@data-testid='dropdown-list']//div[2]//button[2]");
  By selectUser = By.xpath("//div[@data-testid=\"list-item\"]");
  By saveManage = By.cssSelector("[data-testid='saveManageTab']");
  By follow = By.cssSelector("button[data-testid='follow-button']");
  By schema = By.xpath("//button[@data-testid=\"tab\"][[@id=\"schema\"]]");;
  By lineage = By.xpath("//button[@data-testid=\"tab\"][@id=\"lineage\"]");;
  By lineageComponents = By.xpath("//div[@class=\"tw-relative nowheel \"]");
  By profiler = By.xpath("//button[@data-testid=\"tab\"][@id=\"profiler\"]");;
  By sampleData = By.xpath("//button[@data-testid=\"tab\"][@id=\"sampleData\"]");;
  By selectTier1 = By.xpath("(//div[@data-testid='card-list'])[1]");
  By tier1 = By.xpath("(/h4[@class='tw-text-base tw-mb-0']");
  By addTagTextBox = By.xpath("//input[@data-testid='associatedTagName']");
  By selectTag = By.xpath("//div[@data-testid=\"list-item\"][2]");
  By saveTag = By.xpath("//button[@data-testid=\"saveAssociatedTag\"]");
  By tagName = By.xpath("(//div[@data-testid=\"tag-conatiner\"])[1]");
  By removeTag = By.xpath("//span[@data-testid=\"remove\"]");
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
  By profilerDrawer = By.cssSelector("span[class = \"tw-mr-2 tw-cursor-pointer\"]");
  By chart = By.xpath("//div[@class=\"recharts-wrapper\"]");
  By toolTip =
      By.xpath("//div[@class=\"recharts-tooltip-wrapper recharts-tooltip-wrapper-left recharts-tooltip-wrapper-top\"]");
  By columnDescriptionButton = By.xpath("(//img[@data-testid='image'][parent::button])[3]");
  By columnDescriptionBox = By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div");
  By columnDescription = By.cssSelector("div[data-testid='description'][id='column-description-2']");
  By joinedTables = By.xpath("(//div[@data-testid='frequently-joined-columns']/span/a)");
  By joinedColumns = By.xpath("(//div[@data-testid='frequently-joined-columns']/span/a)");
  By sampleDataTable = By.xpath("//table[@data-testid=\"sample-data-table\"]");
  By columnTags = By.xpath("(//div[@data-testid='tag-conatiner'])[1]");

  public List<WebElement> versionDetailsGrid() {
    return webDriver.findElements(versionDetailsGrid);
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

  public List<WebElement> profilerColumn() {
    return webDriver.findElements(profilerDrawer);
  }

  public List<WebElement> chart() {
    return webDriver.findElements(chart);
  }
}
