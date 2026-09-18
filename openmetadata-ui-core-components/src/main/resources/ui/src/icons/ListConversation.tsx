/*
 *  Copyright 2025 Collate.
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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const ListConversation: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M2 7.39q0-.78.027-1.516c.057-1.599.085-2.398.742-3.054.656-.655 1.486-.69 3.146-.76a69 69 0 0 1 5.772 0c1.66.07 2.49.105 3.146.76.657.656.685 1.455.742 3.054a43 43 0 0 1 0 3.032c-.057 1.6-.085 2.399-.742 3.054-.656.656-1.486.69-3.146.761q-.75.032-1.547.047c-.504.01-.756.014-.977.098-.222.083-.408.242-.78.558L6.9 14.684a.499.499 0 0 1-.82-.374v-1.582l-.165-.007c-1.66-.07-2.49-.105-3.146-.76-.657-.656-.685-1.456-.742-3.055Q2 8.171 2 7.39"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.856 15.739c.22.083.407.242.78.558l1.482 1.26a.499.499 0 0 0 .82-.374v-1.582l.165-.007c1.66-.07 2.49-.105 3.147-.76.656-.656.685-1.456.742-3.055a43 43 0 0 0 0-3.031c-.021-.59-.038-1.07-.085-1.475"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle cx={5.998} cy={7.271} fill="currentColor" r={0.748} />
    <circle cx={8.818} cy={7.271} fill="currentColor" r={0.748} />
    <circle cx={11.603} cy={7.271} fill="currentColor" r={0.748} />
  </svg>
);
ListConversation.displayName = 'ListConversation';
