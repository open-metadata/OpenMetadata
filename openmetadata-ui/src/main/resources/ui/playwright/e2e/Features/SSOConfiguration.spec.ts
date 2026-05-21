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

import path from 'path';

import {
  LDAP_VISIBLE_FIELDS,
  OIDC_COMMON_FIELDS,
  SAML_VISIBLE_FIELDS,
  SSO_COMMON_FIELDS,
} from '../../constant/ssoConfiguration';
import { redirectToHomePage } from '../../utils/common';
import {
  enableSSOEditMode,
  expandSSOAdvancedFields,
  selectSSOProvider,
  verifyProviderFields,
} from '../../utils/sso';
import { test } from '../fixtures/pages';

const VALID_SAML_XML = path.join(
  __dirname,
  '../../test-data/saml-metadata-valid.xml'
);
const INVALID_SAML_XML = path.join(
  __dirname,
  '../../test-data/saml-metadata-invalid.xml'
);

const EXPECTED_ENTITY_ID =
  'https://sts.example.com/00000000-0000-0000-0000-000000000000/';
const EXPECTED_SSO_LOGIN_URL =
  'https://sso.example.com/00000000-0000-0000-0000-000000000000/saml2';
const EXPECTED_CERT_PREFIX = '-----BEGIN CERTIFICATE-----';

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

  test.describe('Provider Field Visibility Checks - Confidential Client', () => {
    test('should show correct fields for Google provider with confidential client', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      // Confidential mode is signaled by the OIDC client secret input being
      // present — clientType radio is hidden and derived from secret presence
      // at save time.
      const secretField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/secret"]'
      );

      await expect(secretField).toBeVisible();

      // Verify common (root-level) fields and OIDC subsection main fields
      await verifyProviderFields(page, [
        ...SSO_COMMON_FIELDS,
        ...OIDC_COMMON_FIELDS,
      ]);
    });

    test('should show correct fields for Auth0 provider with confidential client', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'auth0');

      const secretField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/secret"]'
      );

      await expect(secretField).toBeVisible();

      await verifyProviderFields(page, [
        ...SSO_COMMON_FIELDS,
        ...OIDC_COMMON_FIELDS,
      ]);
    });

    test('should show correct fields for Okta provider with confidential client', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'okta');

      const secretField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/secret"]'
      );

      await expect(secretField).toBeVisible();

      await verifyProviderFields(page, [
        ...SSO_COMMON_FIELDS,
        ...OIDC_COMMON_FIELDS,
      ]);
    });
  });

  test.describe('Non-OIDC Provider Field Visibility Checks', () => {
    test('should show correct fields when selecting SAML provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'saml');

      // Main-tier IdP fields are visible inline
      await verifyProviderFields(page, SAML_VISIBLE_FIELDS);

      // SP entity ID and ACS URL are surfaced via the "Register with your
      // Identity Provider" copyable banner, not the form.
      await expect(page.getByTestId('saml-sp-entity-id')).toBeVisible();
      await expect(page.getByTestId('saml-acs-url')).toBeVisible();

      // OIDC and LDAP-only inputs must be absent for SAML
      const hiddenFields = [
        'LDAP Host',
        'LDAP Port',
        'Allowed Email Registration Domains',
      ];

      await verifyProviderFields(page, [], hiddenFields);

      // Root-level OIDC inputs must not render for SAML
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/oidcConfiguration/id"]'
        )
      ).toHaveCount(0);
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/oidcConfiguration/secret"]'
        )
      ).toHaveCount(0);
      await expect(
        page.locator('[id="root/authenticationConfiguration/publicKeyUrls"]')
      ).toHaveCount(0);
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/jwtPrincipalClaims"]'
        )
      ).toHaveCount(0);
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
      ];

      await verifyProviderFields(page, [], hiddenFields);

      // Username Attribute Name is hidden via UI schema for LDAP
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/ldapConfiguration/usernameAttributeName"]'
        )
      ).toHaveCount(0);
    });
  });

  test.describe('Form Field Changes Tests', () => {
    test('should show callback URL as a copyable read-only widget for Google provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      // Root-level callbackUrl renders via the CallbackUrlWidget
      // (CopyableUrlField) — read-only by design, with a Copy action.
      const callbackUrlWidget = page.getByTestId(
        'root/authenticationConfiguration/callbackUrl'
      );

      await expect(callbackUrlWidget).toBeVisible();
      await expect(
        callbackUrlWidget.getByTestId(
          'root/authenticationConfiguration/callbackUrl-value'
        )
      ).toContainText('/callback');
      await expect(
        callbackUrlWidget.getByTestId(
          'root/authenticationConfiguration/callbackUrl-copy'
        )
      ).toBeVisible();

      // The nested OIDC callbackUrl is hidden — it would be redundant.
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/oidcConfiguration/callbackUrl"]'
        )
      ).toHaveCount(0);
    });

    test('should show callback URL as a copyable read-only widget for Auth0 provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'auth0');

      const callbackUrlWidget = page.getByTestId(
        'root/authenticationConfiguration/callbackUrl'
      );

      await expect(callbackUrlWidget).toBeVisible();
      await expect(
        callbackUrlWidget.getByTestId(
          'root/authenticationConfiguration/callbackUrl-copy'
        )
      ).toBeVisible();
    });

    test('should show callback URL as a copyable read-only widget for Okta provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'okta');

      const callbackUrlWidget = page.getByTestId(
        'root/authenticationConfiguration/callbackUrl'
      );

      await expect(callbackUrlWidget).toBeVisible();
      await expect(
        callbackUrlWidget.getByTestId(
          'root/authenticationConfiguration/callbackUrl-copy'
        )
      ).toBeVisible();
    });

    test('should show callback URL as a copyable read-only widget for Azure AD provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'azure');

      const callbackUrlWidget = page.getByTestId(
        'root/authenticationConfiguration/callbackUrl'
      );

      await expect(callbackUrlWidget).toBeVisible();
      await expect(
        callbackUrlWidget.getByTestId(
          'root/authenticationConfiguration/callbackUrl-copy'
        )
      ).toBeVisible();
    });

    test('should show SAML SP Entity ID and ACS URL as copyable read-only widgets', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'saml');

      // SP details now render in the "Register with your Identity Provider"
      // banner above the form, via dedicated CopyableUrlField components —
      // not as RJSF input fields.
      const banner = page.getByTestId('saml-acs-info-banner');

      await expect(banner).toBeVisible();

      const acsUrl = banner.getByTestId('saml-acs-url');

      await expect(acsUrl).toBeVisible();
      await expect(banner.getByTestId('saml-acs-url-value')).toContainText(
        '/callback'
      );
      await expect(banner.getByTestId('saml-acs-url-copy')).toBeVisible();

      const spEntityId = banner.getByTestId('saml-sp-entity-id');

      await expect(spEntityId).toBeVisible();
      await expect(
        banner.getByTestId('saml-sp-entity-id-value')
      ).not.toBeEmpty();
      await expect(banner.getByTestId('saml-sp-entity-id-copy')).toBeVisible();

      // Underlying SP form fields are hidden via UI schema
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/samlConfiguration/sp/entityId"]'
        )
      ).toHaveCount(0);
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/samlConfiguration/sp/acs"]'
        )
      ).toHaveCount(0);
    });

    test('should display Advanced Fields accordion for OIDC provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const advancedFieldsToggle = page.getByTestId(
        'sso-advanced-fields-toggle'
      );

      await expect(advancedFieldsToggle).toBeVisible();
      await expect(advancedFieldsToggle).toContainText(/advanced fields/i);
    });

    test('should show advanced fields when Advanced Fields accordion is expanded', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      await expandSSOAdvancedFields(page);

      // Sample of advanced-tier OIDC fields that are expected to render in
      // the Advanced Fields panel — see OIDC_CONFIDENTIAL_SUBSECTION in
      // SSO.constant.ts.
      const advancedFields = [
        'useNonce',
        'disablePkce',
        'maxClockSkew',
        'tokenValidity',
        'maxAge',
        'sessionExpiry',
      ];

      for (const fieldName of advancedFields) {
        const field = page.locator(`[id*="${fieldName}"]`).first();

        await expect(field).toBeVisible();
      }
    });

    test('should hide publicKeyUrls field for confidential OIDC providers', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      // Confidential mode is signaled by secret input presence — clientType
      // radio is hidden and derived at save time from secret presence.
      const secretField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/secret"]'
      );

      await expect(secretField).toBeVisible();

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

    test('should hide responseType for OIDC providers and surface preferredJwsAlgorithm only in Advanced Fields', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      // responseType is stripped from the OIDC schema entirely
      // (getProviderSpecificSchema in SSOConfigurationForm.tsx).
      const responseTypeField = page.locator('[id*="responseType"]');

      await expect(responseTypeField).toHaveCount(0);

      // preferredJwsAlgorithm lives in the Advanced Fields panel for Google
      // (advanced tier in OIDC_CONFIDENTIAL_SUBSECTION). It must be hidden
      // until the panel is expanded, then visible afterwards.
      const preferredJwsAlgorithmField = page.locator(
        '[id*="preferredJwsAlgorithm"]'
      );

      await expect(preferredJwsAlgorithmField).not.toBeVisible();

      await expandSSOAdvancedFields(page);

      await expect(preferredJwsAlgorithmField.first()).toBeVisible();
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

      // clientAuthenticationMethod sits in the Advanced Fields panel —
      // expand it before asserting visibility.
      await expandSSOAdvancedFields(page);

      const clientAuthMethodField = page.locator(
        '[id*="clientAuthenticationMethod"]'
      );

      await expect(clientAuthMethodField).toHaveCount(0);
    });

    test('should show clientAuthenticationMethod for Okta provider', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'okta');

      await expandSSOAdvancedFields(page);

      const clientAuthMethodField = page.locator(
        '[id*="clientAuthenticationMethod"]'
      );

      await expect(clientAuthMethodField.first()).toBeVisible();
    });

    test('should hide tenant field for Auth0 provider', async ({ page }) => {
      await selectSSOProvider(page, 'auth0');

      await expandSSOAdvancedFields(page);

      // `tenant` is stripped from the schema for non-SAML/LDAP providers
      // (getProviderSpecificSchema in SSOConfigurationForm.tsx).
      const tenantField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/tenant"]'
      );

      await expect(tenantField).toHaveCount(0);
    });

    test('should hide tenant field for Azure provider', async ({ page }) => {
      await selectSSOProvider(page, 'azure');

      await expandSSOAdvancedFields(page);

      // Azure uses `authority` and `discoveryUri` rather than a separate
      // tenant input — the schema removes `tenant` for all OIDC providers.
      const tenantField = page.locator(
        '[id="root/authenticationConfiguration/oidcConfiguration/tenant"]'
      );

      await expect(tenantField).toHaveCount(0);
    });

    test('should collapse Advanced Fields by default', async ({ page }) => {
      await selectSSOProvider(page, 'google');

      const advancedFieldsToggle = page.getByTestId(
        'sso-advanced-fields-toggle'
      );

      await expect(advancedFieldsToggle).toBeVisible();

      const advancedFieldsPanel = page.getByTestId('sso-advanced-fields-panel');

      await expect(advancedFieldsPanel).toBeHidden();
    });

    test('should expand and collapse Advanced Fields when clicked', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');

      const advancedFieldsToggle = page.getByTestId(
        'sso-advanced-fields-toggle'
      );
      const advancedFieldsPanel = page.getByTestId('sso-advanced-fields-panel');

      await expect(advancedFieldsPanel).toBeHidden();

      await advancedFieldsToggle.click();

      await expect(advancedFieldsPanel).toBeVisible();

      await advancedFieldsToggle.click();

      await expect(advancedFieldsPanel).toBeHidden();
    });

    test('should support full LDAP role mapping flow: add, fill, open roles dropdown, detect and resolve duplicates, and remove', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'ldap');

      // authRolesMapping lives in LDAP Advanced Fields — expand to access.
      await expandSSOAdvancedFields(page);

      const addMappingButton = page.getByTestId('add-mapping-btn');
      const ldapGroupInputs = page.locator(
        '[data-testid^="ldap-group-input-"]'
      );
      const rolesSelects = page.locator('[data-testid^="roles-select-"]');
      const errorMessages = page.locator('[data-testid^="ldap-group-error-"]');

      // Add first mapping — inputs and roles select appear; fill DN value persists
      await addMappingButton.click();
      await expect(ldapGroupInputs.first()).toBeVisible();
      await expect(rolesSelects.first()).toBeVisible();
      await ldapGroupInputs.first().fill('cn=admins,dc=example,dc=com');
      await expect(ldapGroupInputs.first()).toHaveValue(
        'cn=admins,dc=example,dc=com'
      );

      // Open the roles dropdown — options are loaded from the API
      await rolesSelects.first().click();
      const roleOptions = page.locator('.ant-select-item-option');

      if ((await roleOptions.count()) > 0) {
        await expect(roleOptions.first()).toBeVisible();
      }

      await page.keyboard.press('Escape');

      // Add a second mapping with a duplicate DN — both rows show an error
      await addMappingButton.click();
      await ldapGroupInputs.last().fill('cn=admins,dc=example,dc=com');
      await expect(errorMessages).toHaveCount(2);
      await expect(errorMessages.first()).toContainText(
        /already mapped|duplicate/i
      );

      // Fix the duplicate — errors clear; case-insensitive and whitespace variants also trigger errors
      await ldapGroupInputs.last().clear();
      await ldapGroupInputs.last().fill('cn=unique,dc=example,dc=com');
      await expect(errorMessages).toHaveCount(0);

      await ldapGroupInputs.last().clear();
      await ldapGroupInputs.last().fill('CN=ADMINS,DC=EXAMPLE,DC=COM');
      await expect(errorMessages).toHaveCount(2);

      await ldapGroupInputs.last().clear();
      await ldapGroupInputs.last().fill('  cn=admins,dc=example,dc=com  ');
      await expect(errorMessages).toHaveCount(2);

      // Add a third unique mapping — no errors with three distinct DNs
      await ldapGroupInputs.last().clear();
      await ldapGroupInputs.last().fill('cn=users,dc=example,dc=com');
      await addMappingButton.click();
      await ldapGroupInputs.last().fill('cn=guests,dc=example,dc=com');
      await expect(errorMessages).toHaveCount(0);

      // Remove the first mapping — row disappears
      await page
        .locator('[data-testid^="remove-mapping-btn-"]')
        .first()
        .click();
      await expect(ldapGroupInputs).toHaveCount(2);
    });

    test('should render authReassignRoles as a searchable dropdown and support role selection, removal, and search filtering', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'ldap');

      // authReassignRoles is in LDAP Advanced Fields.
      await expandSSOAdvancedFields(page);

      const field = page.getByTestId(
        'sso-configuration-form-array-field-template-authReassignRoles'
      );
      const dropdown = page.locator('.ant-select-dropdown').last();

      // Field renders as a combobox (not a plain tags input)
      await expect(field).toBeVisible();
      await expect(field.getByRole('combobox')).toBeVisible();

      // Opening the dropdown shows API-fetched role options
      await field.click();
      await expect(dropdown).toBeVisible();
      await expect(dropdown.locator('.ant-select-item-option')).not.toHaveCount(
        0
      );

      // Select the first available role — it appears as a selection tag
      await dropdown
        .locator(
          '.ant-select-item-option:not(.ant-select-item-option-disabled)'
        )
        .first()
        .click();
      await expect(field.locator('.ant-select-selection-item')).toHaveCount(1);

      // Remove the selected role via its remove button
      await field.locator('.ant-select-selection-item-remove').click();
      await expect(field.locator('.ant-select-selection-item')).toHaveCount(0);

      // Typing filters the visible options
      await field.click();
      await field.locator('input').fill('Data');
      await page.waitForResponse('/api/v1/roles/search?*');
      await expect(
        dropdown.locator(
          '.ant-select-item-option:not(.ant-select-item-option-disabled)'
        )
      ).not.toHaveCount(0, { timeout: 15000 });

      // Pressing Enter on a non-existent value does not create an arbitrary tag
      await field.locator('input').clear();
      const missingRoleSearchResponse = page.waitForResponse(
        '/api/v1/roles/search?*'
      );
      await field.locator('input').fill('NonExistentRoleXYZ123');
      await missingRoleSearchResponse;
      await field.locator('input').press('Enter');
      await expect(field.locator('.ant-select-selection-item')).toHaveCount(0);
    });

    test('should not display role mapping widget for non-LDAP providers', async ({
      page,
    }) => {
      await selectSSOProvider(page, 'google');
      await expect(page.locator('.ldap-role-mapping-widget')).not.toBeVisible();
    });
  });
});
test.describe('SAML Metadata XML Upload', () => {
  test('should show upload drop zone for SAML provider', async ({ page }) => {
    test.slow();

    await redirectToHomePage(page);
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'saml');

    const dropZone = page.getByTestId('file-upload-drop-zone');

    await expect(dropZone).toBeVisible();
    await expect(
      dropZone.getByText(/or drag and drop an xml file here/i)
    ).toBeVisible();
    await expect(
      dropZone.getByText(/we'll auto-fill saml configuration fields/i)
    ).toBeVisible();
  });

  test('should parse valid SAML metadata XML and populate form fields, then clear fields on invalid XML', async ({
    page,
  }) => {
    test.slow();

    await redirectToHomePage(page);
    await enableSSOEditMode(page);
    await selectSSOProvider(page, 'saml');

    await test.step('Wait for drop zone and upload valid SAML metadata XML', async () => {
      await expect(page.getByTestId('file-upload-drop-zone')).toBeVisible();

      // FileTrigger renders a hidden <input type="file"> as a sibling of the
      // visible drop-zone (file-uploader testid is on the wrapper div).
      const fileInput = page.locator('input[type="file"]');

      await fileInput.setInputFiles(VALID_SAML_XML);
    });

    await test.step('Verify success status card is shown', async () => {
      await expect(page.getByTestId('change-metadata-xml-btn')).toBeVisible();
      await expect(
        page.getByText(/has been uploaded and parsed successfully/i)
      ).toBeVisible();
    });

    await test.step('Verify IdP Entity ID field is populated', async () => {
      const entityIdField = page.locator(
        '[id="root/authenticationConfiguration/samlConfiguration/idp/entityId"]'
      );

      await expect(entityIdField).toHaveValue(EXPECTED_ENTITY_ID);
    });

    await test.step('Verify IdP SSO Login URL field is populated', async () => {
      const ssoLoginUrlField = page.locator(
        '[id="root/authenticationConfiguration/samlConfiguration/idp/ssoLoginUrl"]'
      );

      await expect(ssoLoginUrlField).toHaveValue(EXPECTED_SSO_LOGIN_URL);
    });

    await test.step('Verify IdP X509 Certificate field is populated', async () => {
      const certField = page.locator(
        '[id="root/authenticationConfiguration/samlConfiguration/idp/idpX509Certificate"]'
      );

      await expect(certField).toHaveValue(new RegExp(EXPECTED_CERT_PREFIX));
    });

    await test.step('Click change file and upload invalid SAML metadata XML', async () => {
      await page.getByTestId('change-metadata-xml-btn').click();
      await expect(page.getByTestId('file-upload-drop-zone')).toBeVisible();

      const fileInput = page.locator('input[type="file"]');

      await fileInput.setInputFiles(INVALID_SAML_XML);
    });

    await test.step('Verify error status card is shown', async () => {
      await expect(
        page.getByText(/invalid saml metadata could not be parsed/i)
      ).toBeVisible();
      await expect(page.getByTestId('change-metadata-xml-btn')).toBeVisible();
    });

    await test.step('Verify IdP fields are cleared after invalid upload', async () => {
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/samlConfiguration/idp/entityId"]'
        )
      ).toHaveValue('');
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/samlConfiguration/idp/ssoLoginUrl"]'
        )
      ).toHaveValue('');
      await expect(
        page.locator(
          '[id="root/authenticationConfiguration/samlConfiguration/idp/idpX509Certificate"]'
        )
      ).toHaveValue('');
    });
  });
});

test.describe('SSO Back Navigation', () => {
  const mockOktaConfig = {
    authenticationConfiguration: {
      provider: 'okta',
      providerName: 'Test Okta Provider',
      authority: 'https://test.okta.com',
      clientId: 'test-client-id',
      callbackUrl: 'http://localhost:8585/callback',
      publicKeyUrls: [],
      jwtPrincipalClaims: ['email', 'preferred_username', 'roles', 'groups'],
      enableSelfSignup: false,
    },
    authorizerConfiguration: {
      className: 'org.openmetadata.service.security.DefaultAuthorizer',
      containerRequestFilter: 'org.openmetadata.service.security.JwtFilter',
      adminPrincipals: ['admin'],
      principalDomain: 'open-metadata.org',
      enforcePrincipalDomain: false,
      enableSecureSocketConnection: false,
    },
  };

  test('should navigate to /settings when pressing back if SSO is already configured', async ({
    page,
  }) => {
    await page.route('**/system/security/config', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockOktaConfig),
        });
      } else {
        await route.continue();
      }
    });

    // Establish /settings as the history entry just before /settings/sso
    await page.goto('/settings');
    await page.goto('/settings/sso');

    // Component detects existing Okta config and replaces /settings/sso with /settings/sso?provider=okta
    await page.waitForURL('**/settings/sso?provider=okta');

    await page.goBack();

    // Should land on /settings, skipping /settings/sso entirely
    await page.waitForURL(/\/settings$/);

    expect(page.url()).not.toContain('/settings/sso');
  });

  test('should stay on /settings/sso when pressing back if SSO is not configured', async ({
    page,
  }) => {
    await page.route('**/system/security/config', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticationConfiguration: {
              provider: 'basic',
              providerName: '',
              authority: '',
              clientId: '',
              callbackUrl: '',
              publicKeyUrls: [],
              jwtPrincipalClaims: [],
              enableSelfSignup: false,
            },
            authorizerConfiguration: {
              className: 'org.openmetadata.service.security.DefaultAuthorizer',
              containerRequestFilter:
                'org.openmetadata.service.security.JwtFilter',
              adminPrincipals: ['admin'],
              principalDomain: 'open-metadata.org',
              enforcePrincipalDomain: false,
              enableSecureSocketConnection: false,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    const configResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/system/security/config') &&
        response.request().method() === 'GET'
    );

    await page.goto('/settings/sso');
    const response = await configResponse;

    expect(response.status()).toBe(200);

    // With basic config, URL stays at /settings/sso and shows provider selector
    await page.waitForURL('**/settings/sso');

    await expect(page.locator('.provider-selector-container')).toBeVisible();

    expect(page.url()).not.toContain('provider=');
  });
});
