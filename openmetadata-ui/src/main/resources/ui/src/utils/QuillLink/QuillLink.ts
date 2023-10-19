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
import { Quill } from 'react-quill';

const MentionBlot = Quill.import('blots/mention');

export class LinkBlot extends MentionBlot {
  static render(data: { value: string; link: string; id: string }) {
    const element = document.createElement('a');
    element.innerText = data.value;
    element.href = data.link;
    element.id = data.id;

    return element;
  }
}
LinkBlot.blotName = 'link-mention';
