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

const wrapPemCertificate = (certificate: string): string => {
  const body = certificate.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g);

  if (!lines) {
    throw new Error('SAML descriptor returned an empty X509 certificate');
  }

  return [
    '-----BEGIN CERTIFICATE-----',
    ...lines,
    '-----END CERTIFICATE-----',
  ].join('\n');
};

const extractFirstX509Certificate = (
  descriptor: string,
  sourceLabel: string
): string => {
  const match = descriptor.match(
    /<[^>]*X509Certificate[^>]*>([^<]+)<\/[^>]*X509Certificate>/
  );

  if (!match?.[1]) {
    throw new Error(
      `Could not find IdP X509 certificate in SAML descriptor for ${sourceLabel}`
    );
  }

  return wrapPemCertificate(match[1]);
};

export const fetchIdpX509Certificate = async (
  descriptorUrl: string,
  sourceLabel: string
): Promise<string> => {
  const response = await fetch(descriptorUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch SAML descriptor from ${descriptorUrl}: ${response.status} ${response.statusText}`
    );
  }

  return extractFirstX509Certificate(await response.text(), sourceLabel);
};
