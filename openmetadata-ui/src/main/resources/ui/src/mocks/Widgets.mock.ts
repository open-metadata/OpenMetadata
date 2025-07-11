/*
 *  Copyright 2024 Collate.
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
export const MOCK_PASSWORD_WIDGET = {
  autofocus: false,
  disabled: false,
  formContext: { handleFocus: undefined },
  hideError: undefined,
  hideLabel: false,
  id: 'root/password',
  label: 'Password',
  name: 'password',
  options: {
    enumOptions: [],
  },
  placeholder: '',
  rawErrors: undefined,
  readonly: false,
  required: false,
  schema: {
    description: 'this is password field',
    title: 'Password',
    formate: 'password',
  },
  uiSchema: {},
  value: '******',
};

export const MOCK_SSL_FILE_CONTENT = `-----BEGIN CERTIFICATE-----MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w04=-----END CERTIFICATE-----`;

export const MOCK_FILE_SELECT_WIDGET = {
  autofocus: false,
  disabled: false,
  formContext: { handleFocus: undefined },
  hideError: undefined,
  hideLabel: false,
  id: 'root/sslConfig/caCertificate',
  label: 'CA Certificate',
  name: 'caCertificate',
  options: {
    enumOptions: undefined,
  },
  placeholder: '',
  rawErrors: undefined,
  readonly: false,
  required: false,
  schema: {
    title: 'CA Certificate',
    description: 'The CA certificate used for SSL validation.',
    format: 'password',
    accept: ['.pem'],
    uiFieldType: 'fileOrInput',
  },
  uiSchema: {},
  value: MOCK_SSL_FILE_CONTENT,
};
