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

/** The sub-views rendered inside the Personas settings panel. */
export type PersonaView =
  | { type: 'landing' }
  | { type: 'add' }
  | { type: 'detail'; fqn: string; name: string }
  | { type: 'customize'; fqn: string; name: string; category: string };

/** Detail-page tabs, selected via the `?tab=` hash param. */
export type PersonaDetailTab = 'customize-ui' | 'users';
