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

export const Messagechat01: FC<Props> = ({
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
      d="M6.632 15.597c-.261-.105-.405-.156-.486-.146-.099.012-.243.117-.53.328-.508.372-1.146.64-2.094.617-.479-.012-.718-.018-.825-.2-.108-.181.026-.433.293-.937.37-.699.605-1.498.25-2.14-.613-.915-1.133-1.999-1.21-3.17-.04-.629-.04-1.28 0-1.91.21-3.214 2.746-5.774 5.931-5.985a25 25 0 0 1 3.306 0c3.17.21 5.7 2.75 5.927 5.945"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.16 17.715c-2.008-.128-3.607-1.693-3.738-3.658a9 9 0 0 1 0-1.167c.131-1.964 1.73-3.53 3.738-3.658.685-.044 1.4-.044 2.083 0 2.008.129 3.607 1.694 3.738 3.658a9 9 0 0 1 0 1.167c-.048.716-.376 1.378-.762 1.938-.224.391-.076.88.157 1.307.169.308.253.462.185.573-.067.111-.218.115-.52.122-.597.014-1-.15-1.32-.377-.18-.129-.271-.194-.334-.2-.062-.008-.185.04-.431.138a2.4 2.4 0 0 1-.713.157c-.683.044-1.398.044-2.083 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Messagechat01.displayName = 'Messagechat01';
