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
import { SupersetFormType } from '../support/interfaces/ServiceForm.interface';

export const supersetFormDetails1: SupersetFormType = {
  hostPort: 'http://localhost:8088',
  connectionType: 'SupersetApiConnection',
  connection: {
    provider: 'db',
    username: 'test-user-1',
    password: 'test-password-1',
  },
};

export const supersetFormDetails2: SupersetFormType = {
  hostPort: 'http://localhost:8085',
  connectionType: 'SupersetApiConnection',
  connection: {
    provider: 'ldap',
    username: 'test-user-2',
    password: 'test-password-2',
  },
};

export const supersetFormDetails3: SupersetFormType = {
  hostPort: 'http://localhost:8086',
  connectionType: 'PostgresConnection',
  connection: {
    username: 'test-user-3',
    password: 'test-password-3',
    hostPort: 'http://localhost:5432',
    database: 'test_db',
    scheme: 'postgresql+psycopg2',
  },
};

export const supersetFormDetails4: SupersetFormType = {
  hostPort: 'http://localhost:8086',
  connectionType: 'MysqlConnection',
  connection: {
    username: 'test-user-3',
    password: 'test-password-3',
    hostPort: 'http://localhost:5432',
    scheme: 'mysql+pymysql',
  },
};

export const lookerFormDetails = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  hostPort: 'http://localhost:19999',
  gitCredentials: 'local/path',
  type: 'Looker',
};

export const CERT_FILE =
  // eslint-disable-next-line max-len
  '-----BEGIN ENCRYPTED PRIVATE KEY-----OEMIIFJDBWBEIEOELRKEIREOROJKELOQMDKDKDOPWWMKSLLSMDHMFRQXBHQTREFrlpPELhGbNAICCAAwDAYIKoZIhvcNAgkFADAUBggqhkiG9w0DBWTEYEWEIWOWEIUEUWIWIEUEEHEIEOEKELEPOWKWPOQPEKEOEKEPWKWOWPKEOEOEKOEKEOKWKFPLKPFLKPLKPLKPLKPKPLKPLKPLKP.crt';
