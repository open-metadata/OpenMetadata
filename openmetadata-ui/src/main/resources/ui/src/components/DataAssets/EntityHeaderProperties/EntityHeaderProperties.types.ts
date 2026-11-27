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
import { ReactElement, ReactNode } from 'react';

export interface HeaderProperty {
  id: string;
  label: string;
  isEmpty: boolean;
  /** Set by the system, so an empty one has nothing for anyone to fill in. */
  isReadOnly: boolean;
  /** The value, drawn under the label; an empty value is drawn by the field. */
  content: ReactNode;
  /** Wraps a trigger in the property's editor; unset when the viewer cannot edit it. */
  renderEditor?: (trigger: ReactElement) => ReactNode;
  editorTestId?: string;
  testId?: string;
}

export interface EntityHeaderPropertiesProps {
  properties: HeaderProperty[];
}
