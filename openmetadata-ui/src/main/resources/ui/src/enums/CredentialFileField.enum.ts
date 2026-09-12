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
 * Schema markers that turn a `format: password` string into a credential-file
 * field: `file` is upload-only, `fileOrInput` also accepts pasted content.
 */
export enum CredentialFileFieldType {
  FILE = 'file',
  FILE_OR_INPUT = 'fileOrInput',
}
