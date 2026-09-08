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

export const Conversation: FC<Props> = ({
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
      d="M6.402 10h4.8m-4.8-3.2h2.4M7.2 16.399a5.2 5.2 0 0 0 3.01 1.215c.913.06 1.867.06 2.778 0a3.2 3.2 0 0 0 .95-.214c.328-.134.492-.2.576-.19s.204.098.446.274c.426.31.963.533 1.759.514.403-.01.604-.015.694-.167.09-.151-.022-.361-.247-.78-.311-.583-.508-1.25-.21-1.784.515-.763.953-1.666 1.017-2.642.034-.524.034-1.067 0-1.592A5.4 5.4 0 0 0 17.52 9.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.275 14.389c2.845-.187 5.11-2.464 5.297-5.322.036-.56.036-1.138 0-1.698-.187-2.857-2.452-5.134-5.297-5.321a23 23 0 0 0-2.951 0c-2.845.187-5.11 2.464-5.297 5.321-.036.56-.036 1.139 0 1.698.068 1.041.533 2.005 1.08 2.819.318.57.108 1.28-.223 1.901-.238.448-.358.672-.262.834s.31.167.738.177c.846.02 1.416-.217 1.869-.548.257-.187.385-.281.474-.292s.262.06.61.202c.314.128.677.207 1.01.229.969.064 1.982.064 2.952 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Conversation.displayName = 'Conversation';
