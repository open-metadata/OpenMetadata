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

export const AppCollateAiDocumentationAgentColored: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 32 32"
    width={size}
    {...props}>
    <rect
      fill="url(#app-collate-ai-documentation-agent-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M19.994 14.41v-1.963c0-1.032 0-1.547-.207-1.941a1.87 1.87 0 0 0-.828-.805c-.406-.201-.937-.201-1.999-.201h-4.044c-1.062 0-1.593 0-1.998.2a1.87 1.87 0 0 0-.829.806c-.206.393-.206.91-.206 1.94v6.385c0 1.031 0 1.547.206 1.94.182.347.472.63.829.806.405.2.936.2 1.998.2h2.338m.948-6.752H12.41m1.264 2.455h-1.263m5.055-4.91H12.41"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="m18.61 21.488.253.89a.17.17 0 0 0 .16.12.16.16 0 0 0 .158-.12l.253-.89a2.43 2.43 0 0 1 1.674-1.677l.889-.252a.17.17 0 0 0 .121-.16.16.16 0 0 0-.121-.159l-.89-.252a2.43 2.43 0 0 1-1.673-1.677l-.253-.89c-.037-.14-.271-.14-.309 0l-.252.89a2.43 2.43 0 0 1-1.674 1.677l-.889.252a.17.17 0 0 0-.121.16c0 .074.046.14.121.159l.889.252c.813.235 1.44.862 1.674 1.677z"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-documentation-agent-colored_a"
        x1={32}
        x2={32}
        y1={32}
        y2={0}>
        <stop stopColor="#FA71CD" />
        <stop offset={1} stopColor="#C471F5" />
      </linearGradient>
    </defs>
  </svg>
);
AppCollateAiDocumentationAgentColored.displayName =
  'AppCollateAiDocumentationAgentColored';
