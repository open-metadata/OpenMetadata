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

import {
  TextEditorBlockquote,
  TextEditorBold,
  TextEditorBulletedList,
  TextEditorCode,
  TextEditorEmoji,
  TextEditorHashtag,
  TextEditorItalic,
  TextEditorLink,
  TextEditorMention,
  TextEditorNumberedList,
  TextEditorStrikethrough,
} from '@openmetadata/ui-core-components/icons';
import { FC, SVGProps } from 'react';

// quill-emoji opens its picker above the editor when the editor sits in the
// lower half of the window, by this inline top.
export const EMOJI_PICKER_ABOVE_TOP = '-250px';

/**
 * The format bar's buttons, by the class Quill or quill-emoji gives each, and
 * the design's icon for it. Quill draws its icons from one app-wide registry,
 * so the composer draws these into its own buttons instead and hides Quill's.
 */
export const FORMAT_BAR_ICONS: ReadonlyArray<
  readonly [string, FC<SVGProps<SVGSVGElement>>]
> = [
  ['.ql-bold', TextEditorBold],
  ['.ql-italic', TextEditorItalic],
  ['.ql-strike', TextEditorStrikethrough],
  ['.ql-blockquote', TextEditorBlockquote],
  ['.ql-code-block', TextEditorCode],
  ['.ql-list[value="ordered"]', TextEditorNumberedList],
  ['.ql-list[value="bullet"]', TextEditorBulletedList],
  ['.ql-link', TextEditorLink],
  ['.ql-insertMention', TextEditorMention],
  ['.ql-insertRef', TextEditorHashtag],
  ['.textarea-emoji-control', TextEditorEmoji],
];
