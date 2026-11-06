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
 * Compatibility forward for openmetadata-collate, which imports
 * `openmetadata-ui/src/rest/index` from 46 of its own REST modules. The client
 * lives in ./axiosClient; this file exists only so that downstream specifier
 * keeps resolving, and re-exporting does not create a second client because the
 * module body runs once for the resolved file.
 *
 * Nothing in this repo should import it — no-internal-barrel-imports will flag
 * the call site. Delete this file once Collate points at ./axiosClient.
 */
export { default } from './axiosClient';
