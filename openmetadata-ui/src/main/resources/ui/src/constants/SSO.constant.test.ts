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

import i18next from '../utils/i18next/LocalUtil';
import { getSSOUISchema, SAML_UI_SCHEMA } from './SSO.constant';

describe('SAML encryption policy', () => {
  it('exposes the saved requirement independently of strict mode', () => {
    expect(
      SAML_UI_SCHEMA.samlConfiguration.security.wantAssertionEncrypted
    ).toEqual({
      'ui:title': 'label.require-encrypted-assertions',
    });
  });
});

describe('SAML form titles', () => {
  const translate = i18next.t as unknown as jest.Mock;
  const defaultTranslate = translate.getMockImplementation();

  beforeEach(() =>
    translate.mockImplementation(
      (key: string, options?: Record<string, string>) =>
        options ? `${key} ${JSON.stringify(options)}` : key
    )
  );

  afterEach(() => translate.mockImplementation(defaultTranslate));

  it('reads every title in the language active when the form is built', () => {
    const authUiSchema = getSSOUISchema('saml').authenticationConfiguration;
    const { samlConfiguration } = SAML_UI_SCHEMA;
    const { idp, sp, security } = samlConfiguration;

    expect(authUiSchema.enableSelfSignup).toEqual({
      'ui:title': 'label.enable-self-signup',
    });
    expect(authUiSchema.samlConfiguration).toBe(samlConfiguration);
    expect(samlConfiguration['ui:title']).toBe(
      'label.entity-configuration {"entity":"SAML"}'
    );
    expect(samlConfiguration.debugMode['ui:title']).toBe('label.debug-mode');
    expect(idp['ui:title']).toBe('label.identity-provider-idp');
    expect(idp.entityId['ui:title']).toBe(
      'label.provider-entity-id {"provider":"IdP"}'
    );
    expect(idp.ssoLoginUrl['ui:title']).toBe('label.idp-sso-login-url');
    expect(idp.idpX509Certificate['ui:title']).toBe(
      'label.provider-x509-certificate {"provider":"IdP"}'
    );
    expect(idp.nameId['ui:title']).toBe('label.name-id-format');
    expect(sp['ui:title']).toBe('label.service-provider-sp');
    expect(sp.entityId).toEqual({
      'ui:title': 'label.provider-entity-id {"provider":"SP"}',
      'ui:help': 'message.saml-sp-entity-id-help',
    });
    expect(sp.acs).toEqual({
      'ui:title': 'label.assertion-consumer-service-url',
      'ui:help': 'message.saml-acs-url-help',
    });
    expect(sp.spX509Certificate['ui:title']).toBe(
      'label.provider-x509-certificate {"provider":"SP"}'
    );
    expect(sp.spPrivateKey['ui:title']).toBe('label.sp-private-key');
    expect(security['ui:title']).toBe(
      'label.entity-configuration {"entity":"label.security"}'
    );
    expect(security.strictMode['ui:title']).toBe('label.strict-mode');
    expect(security.tokenValidity['ui:title']).toBe(
      'label.token-validity-seconds'
    );
    expect(security.wantAssertionsSigned['ui:title']).toBe(
      'label.want-assertions-signed'
    );
    expect(security.wantMessagesSigned['ui:title']).toBe(
      'label.want-messages-signed'
    );
    expect(security.sendSignedAuthRequest['ui:title']).toBe(
      'label.send-signed-auth-request'
    );
  });
});
