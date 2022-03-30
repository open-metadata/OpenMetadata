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
  By editGlossaryTag = By.xpath("//div[@data-testid='tag-container']");
  By addTerm = By.cssSelector("[title='Add term']");
  By saveGlossary = By.cssSelector("[data-testid='save-glossary']");
  By saveGlossaryTerm = By.cssSelector("[data-testid='save-glossary-term']");
  By saveTermReviewer = By.cssSelector("[data-testid='saveButton']");
  By saveAssociatedTag = By.xpath("//button[@data-testid='saveAssociatedTag']");

  public By checkboxAddUser(int index) {
    return By.xpath(
        "(//div[@data-testid='user-card-container']//input[@data-testid='checkboxAddUser'])[" + index + "]");
  }

  public By removeAssociatedTag(int index) {
    return By.xpath("(//span[@data-testid='remove'])[" + index + "]");
  }
}
