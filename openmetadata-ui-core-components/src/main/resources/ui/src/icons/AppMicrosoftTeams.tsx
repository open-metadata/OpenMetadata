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

export const AppMicrosoftTeams: FC<Props> = ({
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
      d="M11.186 7.358a2.42 2.42 0 1 0-2.86-2.448h1.178c.929 0 1.682.753 1.682 1.682zM6.89 15.096h2.613c.929 0 1.682-.753 1.682-1.682V8.141h2.783a.7.7 0 0 1 .682.716v4.294a4.197 4.197 0 0 1-4.093 4.293c-1.618-.04-3-.99-3.667-2.35zm10.737-9.372a1.675 1.675 0 1 1-3.351 0 1.675 1.675 0 0 1 3.35 0m-2.238 9.488-.12-.002a5.2 5.2 0 0 0 .38-2.07V8.867a1.7 1.7 0 0 0-.15-.725h1.793c.39 0 .707.317.707.707v3.765a2.6 2.6 0 0 1-2.598 2.598z"
      fill="currentColor"
    />
    <path
      d="M2.682 5.911h6.822c.377 0 .682.305.682.682v6.822a.68.68 0 0 1-.682.682H2.682A.68.68 0 0 1 2 13.415V6.592a.68.68 0 0 1 .682-.68m5.206 2.596v-.72h-3.59v.72h1.357v3.715h.87V8.507z"
      fill="currentColor"
    />
  </svg>
);
AppMicrosoftTeams.displayName = 'AppMicrosoftTeams';
