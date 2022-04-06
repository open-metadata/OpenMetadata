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
public class PipelineDetails {
  @Nonnull WebDriver webDriver;

  By pipelines = By.xpath("(//button[@data-testid='tab'])[4]");
  By selectedTag = By.xpath("//span[@class='tw-no-underline hover:tw-no-underline tw-py-0.5 tw-px-2 tw-pl-2 tw-pr-1']");
  By editTaskDescription = By.xpath("//div[@data-testid='description']/span/span");
  By descriptionBox = By.xpath("(//div[@data-testid='description'])[2]");
  By lineage = By.cssSelector("[data-testid='Lineage']");
  By lineageComponents = By.xpath("//div[@class=\"tw-relative nowheel \"]");
  By sideDrawerLineage = By.xpath("//header[@class=\"tw-flex tw-justify-between\"]");

  public List<WebElement> lineageNodes() {
    return webDriver.findElements(lineageComponents);
  }

  public WebElement getDescriptionBox() {
    return webDriver.findElement(descriptionBox);
  }
}
