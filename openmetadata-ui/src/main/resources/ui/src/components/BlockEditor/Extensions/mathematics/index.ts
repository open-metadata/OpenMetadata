/*
 *  Copyright 2024 Collate.
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
import { Extension } from '@tiptap/core';

import { MATHEMATICS_EXTENSION_DEFAULT_OPTIONS } from '../../../../constants/BlockEditor.constants';
import { InlineMathNode } from './inline-math-node';
import { MathExtensionOption } from './mathematics.interface';

/**
 * referred from:
 * @link https://github.com/aarkue/tiptap-math-extension
 */
export const MathMeticsExtension = Extension.create<MathExtensionOption>({
  name: 'mathematics',

  addOptions() {
    return MATHEMATICS_EXTENSION_DEFAULT_OPTIONS;
  },

  addExtensions() {
    const extensions = [];
    if (this.options.addInlineMath !== false) {
      extensions.push(InlineMathNode.configure(this.options));
    }

    return extensions;
  },
});
