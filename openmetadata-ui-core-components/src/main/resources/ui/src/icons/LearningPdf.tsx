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

export const LearningPdf: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M2 4a4 4 0 0 1 4-4h6l6 6v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
      fill="#E04F16"
    />
    <path d="m12 0 6 6h-2a4 4 0 0 1-4-4z" fill="#fff" opacity={0.3} />
    <path
      d="M5.173 14.39v-3.782h1.492q.43 0 .733.165.303.162.462.452.16.288.16.665t-.162.665a1.1 1.1 0 0 1-.47.448q-.308.162-.743.161h-.951v-.64h.821q.231 0 .38-.08a.53.53 0 0 0 .226-.224.7.7 0 0 0 .076-.33.7.7 0 0 0-.076-.329.5.5 0 0 0-.225-.22.8.8 0 0 0-.384-.079h-.54v3.128zm4.707 0H8.54v-3.782h1.35q.57 0 .983.228.412.225.633.648.224.423.224 1.012 0 .59-.224 1.015-.221.424-.637.652-.413.227-.99.227m-.54-.685h.507q.355 0 .597-.125a.8.8 0 0 0 .365-.394q.124-.267.124-.69 0-.42-.124-.685a.8.8 0 0 0-.364-.392 1.3 1.3 0 0 0-.596-.126h-.51zm2.983.685v-3.782h2.504v.66h-1.704v.9h1.538v.66h-1.538v1.562z"
      fill="#fff"
    />
  </svg>
);
LearningPdf.displayName = 'LearningPdf';
