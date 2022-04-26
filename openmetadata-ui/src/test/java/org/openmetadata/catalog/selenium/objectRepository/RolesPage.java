package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class RolesPage {
  @Nonnull WebDriver webDriver;

  By addRoleButton = By.cssSelector("[data-testid='add-new-role-button']");
  By listOperation = By.cssSelector("[data-testid='select-operation']");
  By listAccess = By.cssSelector("[data-testid='select-access']");
  By ruleToggleButton = By.cssSelector("[data-testid='rule-switch']");
  By editRuleButton = By.xpath("(//tbody[@data-testid='table-body']/tr/td/div/span)[1]");
  By accessValue = By.xpath("(//tbody[@data-testid='table-body']/tr/td[2]/p)[1]");
  By deleteRuleButton = By.cssSelector("[data-testid='image'][title='Delete']");
  By rolesDisplayName = By.name("displayName");
  By errorMessage = By.xpath("//strong[@data-testid='error-message']");
  By addRule = By.xpath("//button[@data-testid='add-new-rule-button']");
  By operation = By.xpath("(//td[@class='tableBody-cell'])[1]");
  By access = By.xpath("(//td[@class='tableBody-cell'])[2]");
  By policiesDropdown = By.xpath("//div[@class=' css-tlfecz-indicatorContainer']");
  By listItem = By.xpath("//*[@id='react-select-2-listbox']");
  By descriptionContainer = By.cssSelector("[data-testid='viewer-container']");
  By ruleName = By.xpath("(//td[@class='tableBody-cell']/p)[1]");

  public By selectOperation(String operation) {
    return By.cssSelector("[value='" + operation + "']");
  }

  public By selectAccess(String access) {
    return By.cssSelector("[value='" + access + "']");
  }
}
