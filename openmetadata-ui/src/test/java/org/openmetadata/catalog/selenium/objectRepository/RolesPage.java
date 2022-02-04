package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class RolesPage {
  WebDriver webDriver;

  public RolesPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By addRoleButton = By.cssSelector("[data-testid='add-role']");
  By listOperation = By.cssSelector("[data-testid='select-operation']");
  By listAccess = By.cssSelector("[data-testid='select-access']");
  By ruleToggleButton = By.cssSelector("[data-testid='rule-switch']");
  By editRuleButton = By.xpath("//tbody[@data-testid='table-body']/tr/td[4]/div/span");
  By accessValue = By.xpath("//tbody[@data-testid='table-body']/tr/td[2]/p");
  By deleteRuleButton = By.cssSelector("[data-testid='image'][title='Delete']");
  By rolesDisplayName = By.name("displayName");

  public By addRoleButton() {
    return addRoleButton;
  }

  public By listOperation() {
    return listOperation;
  }

  public By listAccess() {
    return listAccess;
  }

  public By ruleToggleButton() {
    return ruleToggleButton;
  }

  public By editRuleButton() {
    return editRuleButton;
  }

  public By accessValue() {
    return accessValue;
  }

  public By deleteRuleButton() {
    return deleteRuleButton;
  }

  public By rolesDisplayName() {
    return rolesDisplayName;
  }

  public By selectOperation(String operation) {
    return By.cssSelector("[value='" + operation + "']");
  }

  public By selectAccess(String access) {
    return By.cssSelector("[value='" + access + "']");
  }
}
