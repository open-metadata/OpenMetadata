package org.openmetadata.catalog.selenium.objectRepository;

import java.util.List;
import javax.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

@RequiredArgsConstructor
public class PipelineDetails {
  @Nonnull WebDriver webDriver;

  By pipelines = By.xpath("(//button[@data-testid='tab'])[4]");
  By selectedTag = By.xpath("//span[@class='tw-no-underline hover:tw-no-underline tw-py-0.5 tw-px-2 tw-pl-2 tw-pr-1']");
  By editTaskDescription = By.xpath("(//img[@data-testid='image']/parent::button)[3]");
  By descriptionBox = By.xpath("(//div[@data-testid='description'])[2]");
  By lineage = By.xpath("//button[@data-testid='tab'][@id='lineage']");;
  By lineageComponents = By.xpath("//span[@data-testid='lineage-entity']");
  By sideDrawerLineage = By.xpath("//header[@class=\"tw-flex tw-justify-between\"]");

  public By sideDrawer() {
    return sideDrawerLineage;
  }

  public List<WebElement> lineageNodes() {
    return webDriver.findElements(lineageComponents);
  }

  public By lineage() {
    return lineage;
  }

  public By getPipelines() {
    return pipelines;
  }

  public By getSelectedTag() {
    return selectedTag;
  }

  public By getEditTaskDescription() {
    return editTaskDescription;
  }

  public WebElement getDescriptionBox() {
    return webDriver.findElement(descriptionBox);
  }
}
