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
import { Locator, Page } from '@playwright/test';

/**
 * CodeMirror 6 class names, kept in one place so a future editor change is a
 * one-file edit rather than a sweep across the suite.
 *
 * `CODE_EDITOR` is the editor root (box and height assertions), `_CONTENT` is
 * the contenteditable that takes focus and holds the text, `_SCROLLER` is the
 * scrolling viewport, and `_LINE` is a rendered line — only the visible ones
 * exist, so never count lines on a document taller than the viewport.
 */
export const CODE_EDITOR = '.cm-editor';
export const CODE_EDITOR_CONTENT = '.cm-content';
export const CODE_EDITOR_SCROLLER = '.cm-scroller';
export const CODE_EDITOR_LINE = '.cm-line';
export const CODE_EDITOR_PLACEHOLDER = '.cm-placeholder';

const resolveContent = (scope: Page | Locator) =>
  scope.locator(CODE_EDITOR_CONTENT).first();

/** Focus a code editor by clicking the text it holds. */
export const clickCodeEditor = async (scope: Page | Locator) => {
  await resolveContent(scope).click();
};

/** The editor's text. Only rendered lines are present, so keep documents short. */
export const getCodeEditorText = async (scope: Page | Locator) =>
  (await resolveContent(scope).innerText()).trim();

/**
 * Replace an editor's content.
 *
 * `insertText` is used instead of `type` because it bypasses keydown, so the
 * auto-close-brackets extension does not duplicate braces and quotes.
 */
export const fillCodeEditor = async (
  page: Page,
  scope: Page | Locator,
  text: string
) => {
  await clickCodeEditor(scope);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
};
