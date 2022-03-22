package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class GlossaryPage {
  @Nonnull WebDriver webDriver;

  By addGlossaryButton = By.cssSelector("[data-testid='add-webhook-button']");
  By addReviewerButton = By.cssSelector("[data-testid='add-reviewers']");
  By editGlossaryTag = By.xpath("//div[@data-testid='tag-container']//img[@data-testid='image']");
  By addTerm = By.cssSelector("[title='Add term']");

  public By checkboxAddUser(int index) {
    return By.xpath(
        "(//div[@data-testid='user-card-container']//input[@data-testid='checkboxAddUser'])[" + index + "]");
  }
}
