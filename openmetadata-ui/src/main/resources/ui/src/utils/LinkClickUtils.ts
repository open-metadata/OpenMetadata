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
import { MouseEvent } from 'react';

const isModifiedClick = (event: MouseEvent<HTMLElement>): boolean =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;

/** Whether a link click navigates this tab, as react-router's Link decides; a new-tab click does not. */
export const navigatesThisTab = (event: MouseEvent<HTMLElement>): boolean =>
  !event.defaultPrevented && event.button === 0 && !isModifiedClick(event);
