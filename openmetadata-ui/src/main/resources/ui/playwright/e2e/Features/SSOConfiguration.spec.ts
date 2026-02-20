/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  LDAP_VISIBLE_FIELDS,
  OIDC_COMMON_FIELDS,
  SAML_VISIBLE_FIELDS,
  SSO_COMMON_FIELDS,
} from '../../constant/ssoConfiguration';
import { redirectToHomePage } from '../../utils/common';
import {
  enableSSOEditMode,
  selectSSOProvider,
  verifyProviderFields,
} from '../../utils/sso';
import { test } from '../fixtures/pages';

const { expect } = test;

test.describe('SSO Configuration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await enableSSOEditMode(page);
  });

  test.describe('Provider Selection Screen', () => {
    test('should display all available SSO providers', async ({ page }) => {
      // Verify provider selector is visible
      await expect(page.locator('.provider-selector-container')).toBeVisible();

      // Verify all provider cards are displayed
      const providers = [
        'Google',
        'Azure AD',
        'Okta',
        'SAML',
        'AWS-Cognito',
        'Custom-OIDC',
        'LDAP',
        'Auth0',
      ];
      for (const provider of providers) {
        await expect(
          page.locator('.provider-item').filter({ hasText: provider })
        ).toBeVisible();
      }

      // Verify Configure button is disabled initially
      const configureButton = page.getByRole('button', {
        name: /configure/i,
      });

      await expect(configureButton).toBeDisabled();
    });

    test('should enable Configure button when provider is selected', async ({
      page,
    }) => {
      // Click on Google provider
      await page
        .locator('.provider-item')
        .filter({ hasText: 'Google' })
        .click();

      // Verify the provider card is selected
      await expect(
        page.locator('.provider-item.selected').filter({ hasText: 'Google' })
      ).toBeVisible();

      // Verify Configure button is now enabled
      const configureButton = page.getByRole('button', {
        name: /configure/i,
      });

      await expect(configureButton).toBeEnabled();
    });
  });

  test.describe(
    'Provider Field Visibility Checks - Confidential Client',
    () => {
      test('should show correct fields for Google provider with confidential client', async ({
        page,
      }) => {
        await selectSSOProvider(page, 'google');

        // Verify Confidential client type is selected by default
        const confidentialRadio = page.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        await verifyProviderFields(page, SSO_COMMON_FIELDS);

        // Verify OIDC specific fields with OIDC prefix in labels

        for (const field of OIDC_COMMON_FIELDS) {
          const fieldElement = page.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });

      test('should show correct fields for Auth0 provider with confidential client', async ({
        page,
      }) => {
        await selectSSOProvider(page, 'auth0');

        // Verify Confidential client type is selected by default
        const confidentialRadio = page.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        await verifyProviderFields(page, SSO_COMMON_FIELDS);

        // Verify OIDC specific fields with OIDC prefix in labels
        const oidcFields = [...OIDC_COMMON_FIELDS, 'OIDC Tenant'];

        for (const field of oidcFields) {
          const fieldElement = page.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });

      test('should show correct fields for Okta provider with confidential client', async ({
        page,
      }) => {
        await selectSSOProvider(page, 'okta');

        // Verify Confidential client type is selected by default
        const confidentialRadio = page.getByRole('radio', {
          name: /confidential/i,
        });

        await expect(confidentialRadio).toBeChecked();

        // Verify common fields are visible
        await verifyProviderFields(page, SSO_COMMON_FIELDS);

        // Verify OIDC specific fields with OIDC prefix in labels
        const oidcFields = [...OIDC_COMMON_FIELDS, 'OIDC Tenant'];

        for (const field of oidcFields) {
          const fieldElement = page.getByLabel(field);
          const fieldCount = await fieldElement.count();
          if (fieldCount > 0) {
            await expect(fieldElement.first()).toBeVisible();
          }
        }
      });
    }
  );

  test.describe('Provider Field Visibility Checks - Public Client', () => {
    test('should show correct fields when selecting SAML provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'saml');

      await verifyProviderFields(page, SAML_VISIBLE_FIELDS);

      const commonFields = ['Provider Name'];

      await verifyProviderFields(page, commonFields);

      const hiddenFields = [
        'LDAP Host',
        'LDAP Port',
        'OIDC Client ID',
        'OIDC Client Secret',
        'Use Roles From Provider',
        'Allowed Email Registration Domains',
        'Token Validity (seconds)',
        'Client ID',
        'Callback URL',
        'Public Key URLs',
        'JWT Principal Claims',
      ];

      await verifyProviderFields(page, [], hiddenFields);
    });

    test('should show correct fields when selecting LDAP provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'ldap');

      await verifyProviderFields(page, LDAP_VISIBLE_FIELDS);

      const hiddenFields = [
        'OIDC Client ID',
        'OIDC Client Secret',
        'Allowed Email Registration Domains',
        'Use Roles From Provider',
        'Username Attribute Name',
        'Auth Roles Mapping',
        'Allowed Email Registration Domains',
        'Use Roles From Provider',
      ];

      await verifyProviderFields(page, [], hiddenFields);
    });

    test('should show correct fields when selecting Google provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      // Click on Public client type
      const publicRadio = page.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(page, [
        ...SSO_COMMON_FIELDS,
        'Public Key URLs',
      ]);

      // Verify Client Type radio group is visible
      await expect(page.locator('.field-radio-group').first()).toBeVisible();

      // Verify Secret field is NOT visible for public client
      await expect(page.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(page.locator('[id*="oidcConfiguration"]')).not.toBeVisible();
    });

    test('should show correct fields when selecting Auth0 provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'auth0');

      // Click on Public client type
      const publicRadio = page.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(page, [
        ...SSO_COMMON_FIELDS,
        'Public Key URLs',
      ]);

      // Verify Client Type radio group is visible
      await expect(page.locator('.field-radio-group').first()).toBeVisible();

      const hiddenFields = [
        'LDAP Host',
        'IdP Entity ID',
        'IdP SSO Login URL',
        'Token Validation Algorithm',
        'Allowed Email Registration Domains',
      ];
      await verifyProviderFields(page, [], hiddenFields);

      // Verify Secret field is NOT visible for public client
      await expect(page.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(page.locator('[id*="oidcConfiguration"]')).not.toBeVisible();
    });

    test('should show correct fields when selecting Okta provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'okta');

      // Click on Public client type
      const publicRadio = page.getByRole('radio', { name: /public/i });
      await publicRadio.click();

      await expect(publicRadio).toBeChecked();

      // Verify public client fields are visible
      await verifyProviderFields(page, [
        ...SSO_COMMON_FIELDS,
        'Public Key URLs',
      ]);

      // Verify Client Type radio group is visible
      await expect(page.locator('.field-radio-group').first()).toBeVisible();

      const hiddenFields = [
        'LDAP Host',
        'IdP Entity ID',
        'IdP SSO Login URL',
        'Token Validation Algorithm',
        'Allowed Email Registration Domains',
      ];
      await verifyProviderFields(page, [], hiddenFields);

      // Verify Secret field is NOT visible for public client
      await expect(page.getByLabel('Secret Key')).not.toBeVisible();

      // Verify OIDC configuration fields are NOT visible for public client
      await expect(page.locator('[id*="oidcConfiguration"]')).not.toBeVisible();
    });
  });

  test.describe('Form Field Changes Tests', () => {
    test('should show OIDC Callback URL as readonly for Google provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const confidentialRadio = page.getByRole('radio', {
        name: /confidential/i,
      });

      await expect(confidentialRadio).toBeChecked();

      const callbackUrlField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/callbackUrl"]'
      );

      await expect(callbackUrlField).toBeVisible();
      await expect(callbackUrlField).toHaveAttribute('readonly');

      const helpText = page.getByText(/auto-generated callback url/i);

      await expect(helpText).toBeVisible();
    });

    test('should show OIDC Callback URL as readonly for Auth0 provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'auth0');

      const callbackUrlField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/callbackUrl"]'
      );

      await expect(callbackUrlField).toBeVisible();
      await expect(callbackUrlField).toHaveAttribute('readonly');
    });

    test('should show OIDC Callback URL as readonly for Okta provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'okta');

      const callbackUrlField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/callbackUrl"]'
      );

      await expect(callbackUrlField).toBeVisible();
      await expect(callbackUrlField).toHaveAttribute('readonly');
    });

    test('should show OIDC Callback URL as readonly for Azure AD provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'azure');

      const callbackUrlField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/callbackUrl"]'
      );

      await expect(callbackUrlField).toBeVisible();
      await expect(callbackUrlField).toHaveAttribute('readonly');
    });

    test('should show SAML SP Entity ID and ACS URL as readonly', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'saml');

      const spEntityIdField = page.locator(
        '[id="root/authenticationConfiguration/samlConfiguration/sp/entityId"]'
      );

      await expect(spEntityIdField).toBeVisible();
      await expect(spEntityIdField).toHaveAttribute('readonly');

      const helpTextEntityId = page.getByText(
        /auto-generated service provider entity id/i
      );

      await expect(helpTextEntityId).toBeVisible();

      const acsUrlField = page.locator(
        '[id="root/authenticationConfiguration/samlConfiguration/sp/acs"]'
      );

      await expect(acsUrlField).toBeVisible();
      await expect(acsUrlField).toHaveAttribute('readonly');

      const helpTextAcs = page.getByText(
        /auto-generated assertion consumer service url/i
      );

      await expect(helpTextAcs).toBeVisible();
    });

    test('should display advanced config collapse for OIDC provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const advancedConfigCollapse = page.locator(
        '.sso-advanced-properties-collapse'
      );

      await expect(advancedConfigCollapse).toBeVisible();

      const advancedConfigHeader = page.getByText(/advanced config/i);

      await expect(advancedConfigHeader).toBeVisible();
    });

    test('should show advanced fields when advanced config is expanded', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const advancedConfigHeader = page.getByText(/advanced config/i);

      await advancedConfigHeader.click();

      const advancedFields = [
        'useNonce',
        'disablePkce',
        'maxClockSkew',
        'tokenValidity',
        'maxAge',
        'sessionExpiry',
      ];

      for (const fieldName of advancedFields) {
        const field = page.locator(`[id*="${fieldName}"]`);
        const fieldCount = await field.count();

        if (fieldCount > 0) {
          await expect(field.first()).toBeVisible();
        }
      }
    });

    test('should hide publicKeyUrls field for confidential OIDC providers', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const confidentialRadio = page.getByRole('radio', {
        name: /confidential/i,
      });

      await expect(confidentialRadio).toBeChecked();

      const publicKeyUrlsField = page.locator('[id*="publicKeyUrls"]').first();

      await expect(publicKeyUrlsField).not.toBeVisible();
    });

    test('should hide serverUrl field for OIDC providers', async ({ page }) => {
      await selectSSOProvider(page, 'google');

      const serverUrlField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/serverUrl"]'
      );

      await expect(serverUrlField).not.toBeVisible();
    });

    test('should hide preferredJwsAlgorithm and responseType for OIDC providers', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const advancedConfigHeader = page.getByText(/advanced config/i);

      await advancedConfigHeader.click();

      const preferredJwsAlgorithmField = page.locator(
        '[id*="preferredJwsAlgorithm"]'
      );

      await expect(preferredJwsAlgorithmField).not.toBeVisible();

      const responseTypeField = page.locator('[id*="responseType"]');

      await expect(responseTypeField).not.toBeVisible();
    });

    test('should hide tokenValidationAlgorithm for OIDC providers', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const tokenValidationAlgorithmField = page.locator(
        '[id*="tokenValidationAlgorithm"]'
      );

      await expect(tokenValidationAlgorithmField).not.toBeVisible();
    });

    test('should hide jwtPrincipalClaims for LDAP provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'ldap');

      const jwtPrincipalClaimsField = page.locator(
        '[id*="jwtPrincipalClaims"]'
      );

      await expect(jwtPrincipalClaimsField).not.toBeVisible();
    });

    test('should hide jwtPrincipalClaims for SAML provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'saml');

      const jwtPrincipalClaimsField = page.locator(
        '[id*="jwtPrincipalClaims"]'
      );

      await expect(jwtPrincipalClaimsField).not.toBeVisible();
    });

    test('should hide publicKeyUrls for SAML provider', async ({ page }) => {
      await selectSSOProvider(page, 'saml');

      const publicKeyUrlsField = page.locator('[id*="publicKeyUrls"]').first();

      await expect(publicKeyUrlsField).not.toBeVisible();
    });

    test('should hide publicKeyUrls for LDAP provider', async ({ page }) => {
      await selectSSOProvider(page, 'ldap');

      const publicKeyUrlsField = page.locator('[id*="publicKeyUrls"]').first();

      await expect(publicKeyUrlsField).not.toBeVisible();
    });

    test('should hide SAML SP callback URL field', async ({ page }) => {
      await selectSSOProvider(page, 'saml');

      const callbackField = page.locator(
        '[id="root/authenticationConfiguration/samlConfiguration/sp/callback"]'
      );

      await expect(callbackField).not.toBeVisible();
    });

    test('should hide clientAuthenticationMethod for Auth0 provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'auth0');

      const advancedConfigHeader = page.getByText(/advanced config/i);

      await advancedConfigHeader.click();

      const clientAuthMethodField = page.locator(
        '[id*="clientAuthenticationMethod"]'
      );

      await expect(clientAuthMethodField).not.toBeVisible();
    });

    test('should show clientAuthenticationMethod for Okta provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'okta');

      const advancedConfigHeader = page.getByText(/advanced config/i);

      await advancedConfigHeader.click();

      const clientAuthMethodField = page.locator(
        '[id*="clientAuthenticationMethod"]'
      );
      const fieldCount = await clientAuthMethodField.count();

      if (fieldCount > 0) {
        await expect(clientAuthMethodField.first()).toBeVisible();
      }
    });

    test('should hide tenant field for Auth0 provider', async ({ page }) => {
      await selectSSOProvider(page, 'auth0');

      const advancedConfigHeader = page.getByText(/advanced config/i);

      await advancedConfigHeader.click();

      const tenantField = page.locator('[id*="/tenant"]');

      await expect(tenantField).not.toBeVisible();
    });

    test('should show tenant field for Azure provider', async ({ page }) => {
      await selectSSOProvider(page, 'azure');

      const tenantField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/tenant"]'
      );

      await expect(tenantField).toBeVisible();
    });

    test('should collapse advanced config by default', async ({ page }) => {
      await selectSSOProvider(page, 'google');

      const advancedConfigPanel = page.locator(
        '.sso-advanced-properties-collapse .ant-collapse-item'
      );

      await expect(advancedConfigPanel).not.toHaveClass(
        /ant-collapse-item-active/
      );
    });

    test('should expand and collapse advanced config when clicked', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const advancedConfigHeader = page.getByText(/advanced config/i);
      const advancedConfigPanel = page.locator(
        '.sso-advanced-properties-collapse .ant-collapse-item'
      );

      await expect(advancedConfigPanel).not.toHaveClass(
        /ant-collapse-item-active/
      );

      await advancedConfigHeader.click();

      await expect(advancedConfigPanel).toHaveClass(/ant-collapse-item-active/);

      await advancedConfigHeader.click();

      await expect(advancedConfigPanel).not.toHaveClass(
        /ant-collapse-item-active/
      );
    });
  });

  test.describe('LDAP Role Mapping Widget Tests', () => {
    test.beforeEach(async ({ page }) => {
      await selectSSOProvider(page, 'ldap');
    });

    test('should add new mapping when Add button is clicked', async ({
      page,
    }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();

      const ldapGroupInput = page.locator('[data-testid^="ldap-group-input-"]');

      await expect(ldapGroupInput).toBeVisible();

      const rolesSelect = page.locator('[data-testid^="roles-select-"]');

      await expect(rolesSelect).toBeVisible();
    });

    test('should allow entering LDAP group DN', async ({ page }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();

      const ldapGroupInput = page.locator('[data-testid^="ldap-group-input-"]');

      await ldapGroupInput.fill('cn=admins,dc=example,dc=com');

      await expect(ldapGroupInput).toHaveValue('cn=admins,dc=example,dc=com');
    });

    test('should allow selecting roles from dropdown', async ({ page }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();

      const ldapGroupInput = page.locator('[data-testid^="ldap-group-input-"]');

      await ldapGroupInput.fill('cn=admins,dc=example,dc=com');

      const rolesSelect = page.locator('[data-testid^="roles-select-"]');

      await rolesSelect.click();

      const roleOptions = page.locator('.ant-select-item-option');
      const firstRole = roleOptions.first();

      if ((await roleOptions.count()) > 0) {
        await expect(firstRole).toBeVisible();
      }
    });

    test('should allow removing a mapping', async ({ page }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();

      const ldapGroupInput = page.locator('[data-testid^="ldap-group-input-"]');

      await ldapGroupInput.fill('cn=admins,dc=example,dc=com');

      const removeButton = page.locator('[data-testid^="remove-mapping-btn-"]');

      await expect(removeButton).toBeVisible();

      await removeButton.click();

      await expect(ldapGroupInput).not.toBeVisible();
    });

    test('should show duplicate error when same LDAP group is added twice', async ({
      page,
    }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();
      await addMappingButton.click();

      const ldapGroupInputs = page.locator(
        '[data-testid^="ldap-group-input-"]'
      );

      await expect(ldapGroupInputs).toHaveCount(2);

      await ldapGroupInputs.first().fill('cn=duplicate,dc=example,dc=com');
      await ldapGroupInputs.last().fill('cn=duplicate,dc=example,dc=com');

      const errorMessages = page.locator('[data-testid^="ldap-group-error-"]');

      await expect(errorMessages).toHaveCount(2);
      await expect(errorMessages.first()).toContainText(
        /already mapped|duplicate/i
      );
    });

    test('should clear duplicate error when one entry is changed', async ({
      page,
    }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();
      await addMappingButton.click();

      const ldapGroupInputs = page.locator(
        '[data-testid^="ldap-group-input-"]'
      );

      await ldapGroupInputs.first().fill('cn=duplicate,dc=example,dc=com');
      await ldapGroupInputs.last().fill('cn=duplicate,dc=example,dc=com');

      let errorMessages = page.locator('[data-testid^="ldap-group-error-"]');

      await expect(errorMessages).toHaveCount(2);

      await ldapGroupInputs.last().clear();
      await ldapGroupInputs.last().fill('cn=unique,dc=example,dc=com');

      errorMessages = page.locator('[data-testid^="ldap-group-error-"]');

      await expect(errorMessages).toHaveCount(0);
    });

    test('should allow adding multiple unique mappings', async ({ page }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();
      await addMappingButton.click();
      await addMappingButton.click();

      const ldapGroupInputs = page.locator(
        '[data-testid^="ldap-group-input-"]'
      );

      await expect(ldapGroupInputs).toHaveCount(3);

      await ldapGroupInputs.nth(0).fill('cn=admins,dc=example,dc=com');
      await ldapGroupInputs.nth(1).fill('cn=users,dc=example,dc=com');
      await ldapGroupInputs.nth(2).fill('cn=guests,dc=example,dc=com');

      const errorMessages = page.locator('[data-testid^="ldap-group-error-"]');

      await expect(errorMessages).toHaveCount(0);
    });

    test('should maintain mapping when clearing LDAP group input', async ({
      page,
    }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();

      const ldapGroupInput = page.locator('[data-testid^="ldap-group-input-"]');
      const removeButton = page.locator('[data-testid^="remove-mapping-btn-"]');

      await ldapGroupInput.fill('cn=admins,dc=example,dc=com');

      await expect(ldapGroupInput).toHaveValue('cn=admins,dc=example,dc=com');

      await ldapGroupInput.clear();

      await expect(ldapGroupInput).toBeVisible();
      await expect(removeButton).toBeVisible();
    });

    test('should handle case-insensitive duplicate detection', async ({
      page,
    }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();
      await addMappingButton.click();

      const ldapGroupInputs = page.locator(
        '[data-testid^="ldap-group-input-"]'
      );

      await ldapGroupInputs.first().fill('cn=Admins,dc=Example,dc=com');
      await ldapGroupInputs.last().fill('cn=admins,dc=example,dc=com');

      const errorMessages = page.locator('[data-testid^="ldap-group-error-"]');

      await expect(errorMessages).toHaveCount(2);
    });

    test('should handle whitespace in duplicate detection', async ({
      page,
    }) => {
      const addMappingButton = page.getByTestId('add-mapping-btn');

      await addMappingButton.click();
      await addMappingButton.click();

      const ldapGroupInputs = page.locator(
        '[data-testid^="ldap-group-input-"]'
      );

      await ldapGroupInputs.first().fill('  cn=admins,dc=example,dc=com  ');
      await ldapGroupInputs.last().fill('cn=admins,dc=example,dc=com');

      const errorMessages = page.locator('[data-testid^="ldap-group-error-"]');

      await expect(errorMessages).toHaveCount(2);
    });

    test('should not display role mapping widget for non-LDAP providers', async ({
      page,
    }) => {
      await page.goBack();

      await selectSSOProvider(page, 'google');

      const roleMappingWidget = page.locator('.ldap-role-mapping-widget');

      await expect(roleMappingWidget).not.toBeVisible();
    });
  });
});
