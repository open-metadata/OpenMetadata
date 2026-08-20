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
import { getAttachmentId } from './UploadAttachmentUtils';

describe('getAttachmentId', () => {
  it('extracts the id from a standard attachment download URL', () => {
    expect(
      getAttachmentId(
        '/api/v1/attachments/3b1e6a4a-1f2b-4c3d-9e8f-123456789abc/download'
      )
    ).toBe('3b1e6a4a-1f2b-4c3d-9e8f-123456789abc');
  });

  it('extracts the id when the URL has an origin prefix', () => {
    expect(
      getAttachmentId(
        'https://example.com/api/v1/attachments/attachment-id-1/download'
      )
    ).toBe('attachment-id-1');
  });

  it('extracts the id when the URL has a trailing query string', () => {
    expect(
      getAttachmentId('/api/v1/attachments/attachment-id-2/download?foo=bar')
    ).toBe('attachment-id-2');
  });

  it('returns null when the URL does not match the attachments download pattern', () => {
    expect(getAttachmentId('/api/v1/other/attachment-id/download')).toBeNull();
  });

  it('returns null when the URL is missing the /download suffix', () => {
    expect(getAttachmentId('/api/v1/attachments/attachment-id')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(getAttachmentId('')).toBeNull();
  });
});
