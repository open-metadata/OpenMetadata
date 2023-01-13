/*
 *  Copyright 2022 Collate.
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

import i18n from 'utils/i18next/LocalUtil';

export const NO_AUTH = 'no-auth';

export const VALIDATION_MESSAGES = {
  required: i18n.t('message.field-text-is-required', {
    fieldText: '${label}',
  }),
  types: {
    email: i18n.t('message.entity-is-not-valid', {
      entity: '${label}',
    }),
  },
  whitespace: i18n.t('message.field-text-is-required', {
    fieldText: '${label}',
  }),
};

export const LOGIN_FAILED_ERROR = i18n.t(
  'message.invalid-username-or-password'
);

export const HTTP_STATUS_CODE = {
  BAD_REQUEST: 400, // The request cannot be fulfilled due to bad syntax
  CONFLICT: 409, // The request could not be completed because of a conflict in the request
  FORBIDDEN: 403, // The request was a legal request, but the server is refusing to respond to it
  INTERNAL_SERVER_ERROR: 500, // A generic error message, given when no more specific message is suitable
  NOT_FOUND: 404, // The requested page could not be found but may be available again in the future
  SERVICE_UNAVAILABLE: 503, // The server is currently unavailable (overloaded or down)
  SUCCESS: 200, // The request is OK (this is the standard response for successful HTTP requests)
  UNAUTHORISED: 401, // The request was a legal request, but the server is refusing to respond to it. For use when authentication is possible but has failed or not yet been provided
  METHOD_NOT_ALLOWED: 405, // A request was made of a page using a request method not supported by that page
  NOT_ACCEPTABLE: 406, // The server can only generate a response that is not accepted by the client
  SERVER_TIMEOUT: 408, // The server timed out waiting for the request
  EXCEPTION_FAILED: 417, // The server cannot meet the requirements of the Expect request-header field
  BAD_GATEWAY: 502, // The server was acting as a gateway or proxy and received an invalid response from the upstream server
  FAILED_DEPENDENCY: 424, // The method could not be performed on the resource because the requested action depended on another action and that action failed.
};
