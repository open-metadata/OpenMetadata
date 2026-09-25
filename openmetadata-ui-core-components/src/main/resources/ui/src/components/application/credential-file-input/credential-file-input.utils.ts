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

import type { FileIconProps } from '../file-upload/file-upload';

export const getFileIconType = (name: string): FileIconProps['type'] => {
  const parts = name.split('.');
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;

  return (extension || 'empty') as FileIconProps['type'];
};

/** Thrown when a file decodes to something other than UTF-8 text. */
export class NonTextCredentialError extends Error {}

export const decodeCredentialText = (buffer: ArrayBuffer): string => {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new NonTextCredentialError('Credential file is not UTF-8 text');
  }

  if (text.includes('\u0000')) {
    throw new NonTextCredentialError('Credential file contains NUL bytes');
  }

  return text;
};

/**
 * Read a credential file as UTF-8 text.
 *
 * The bytes are decoded strictly rather than through `File.text()`, which is
 * lenient: a DER or PKCS#12 payload comes back as replacement characters rather
 * than an error, and that mojibake would be saved as the secret only to fail
 * much later at connection time. `fatal: true` turns it into a rejection here
 * instead, and the NUL scan catches a binary payload that decodes cleanly.
 *
 * `FileReader` rather than `Blob.arrayBuffer()` because jsdom implements the
 * former and not the latter, and this path has to stay reachable from tests.
 */
export const readCredentialText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.onload = () => {
      try {
        resolve(decodeCredentialText(reader.result as ArrayBuffer));
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsArrayBuffer(file);
  });
