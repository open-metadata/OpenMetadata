/*
 *  Copyright 2023 Collate.
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
import { EditorState } from '@tiptap/pm/state';

export const getSelectedText = (state: EditorState) => {
  const { from, to } = state.selection;

  const text = state.doc.textBetween(from, to);

  return text;
};

export const isInViewport = (ele: HTMLElement, container: HTMLElement) => {
  const eleTop = ele.offsetTop;
  const eleBottom = eleTop + ele.clientHeight;

  const containerTop = container.scrollTop;
  const containerBottom = containerTop + container.clientHeight;

  // The element is fully visible in the container
  return eleTop >= containerTop && eleBottom <= containerBottom;
};
