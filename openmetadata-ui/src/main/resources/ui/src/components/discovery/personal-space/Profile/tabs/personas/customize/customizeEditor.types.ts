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

import { ReactNode } from 'react';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';

/**
 * Actions a customize editor reports up to `PersonaCustomizeView`, which renders
 * them in the panel footer (Save / Reset) and header (Add-Widget).
 */
export interface CustomizeEditorActions {
  onSave: () => Promise<void> | void;
  onReset: () => void;
  canSave: boolean;
  isSaving?: boolean;
  /** Optional header action (e.g. Marketplace "Add Widget"). */
  headerAction?: ReactNode;
}

/** Props shared by every chrome-less persona customize editor. */
export interface CustomizeEditorProps {
  persona: Persona;
  /** The persona's UICustomization document (never persisted yet → id-less). */
  document: Document;
  /** Persist a new document and keep the editor's baseline in sync. */
  onDocumentSaved: (saved: Document) => void;
  /** Report current actions/dirty-state to the host view (re-fired on change). */
  onActionsChange: (actions: CustomizeEditorActions) => void;
  /** Navigate back to the previous view (e.g. close a full-screen overlay). */
  onBack?: () => void;
}
