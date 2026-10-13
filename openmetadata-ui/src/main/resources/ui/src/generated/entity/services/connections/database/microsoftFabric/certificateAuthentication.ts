/*
 *  Copyright 2026 Collate.
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
/**
 * Authenticate the service principal with an X.509 certificate registered on its Microsoft
 * Entra ID application.
 */
export interface CertificateAuthentication {
    /**
     * PEM-encoded X.509 certificate uploaded to the application's Certificates & secrets page
     * in Microsoft Entra ID. It may be followed by its issuing certificate chain.
     */
    certificate: string;
    /**
     * PEM-encoded private key of the certificate, as PKCS#8 (`BEGIN PRIVATE KEY` or `BEGIN
     * ENCRYPTED PRIVATE KEY`) or PKCS#1 (`BEGIN RSA PRIVATE KEY`). A single PEM file holding
     * both the key and the certificate can be supplied in both fields.
     */
    privateKey: string;
    /**
     * Passphrase of an encrypted private key. Leave empty when the private key is not encrypted.
     */
    privateKeyPassphrase?: string;
}
