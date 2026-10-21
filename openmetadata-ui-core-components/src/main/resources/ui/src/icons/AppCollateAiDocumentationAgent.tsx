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

export const AppCollateAiDocumentationAgent: FC<Props> = ({
  size = 20,
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
      d="M15.677 8.4V5.84c0-1.344 0-2.016-.27-2.53a2.44 2.44 0 0 0-1.08-1.048C13.8 2 13.108 2 11.724 2h-5.27C5.07 2 4.378 2 3.85 2.262c-.465.23-.843.597-1.08 1.048-.27.514-.27 1.186-.27 2.53v8.32c0 1.344 0 2.016.27 2.53a2.43 2.43 0 0 0 1.079 1.048C4.377 18 5.069 18 6.453 18H9.5m1.235-8.8h-4.94m1.646 3.2H5.794M12.382 6H5.794"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m12.961 16.691.327 1.152a.22.22 0 0 0 .206.157c.097 0 .181-.06.206-.157l.327-1.152a3.15 3.15 0 0 1 2.166-2.168l1.15-.328a.22.22 0 0 0 .157-.206.21.21 0 0 0-.157-.206l-1.15-.327a3.15 3.15 0 0 1-2.167-2.169l-.326-1.15c-.049-.182-.351-.182-.4 0l-.327 1.15a3.15 3.15 0 0 1-2.166 2.17l-1.15.326a.22.22 0 0 0-.157.206c0 .097.06.182.157.206l1.15.328a3.15 3.15 0 0 1 2.166 2.168z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppCollateAiDocumentationAgent.displayName = 'AppCollateAiDocumentationAgent';
