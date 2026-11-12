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

export const PaperPlaneFilled: FC<Props> = ({
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
      d="M2.286 2.944c.152-.048.4.06.894.278l14.037 6.157c.446.195.67.294.738.43a.42.42 0 0 1 0 .378c-.068.136-.292.234-.738.43L3.18 16.774c-.495.217-.742.326-.894.278a.42.42 0 0 1-.275-.277c-.048-.151.06-.4.278-.893l2.29-5.204h4.464a.65.65 0 0 0 0-1.301H4.604L2.29 4.113c-.217-.493-.326-.74-.278-.892a.42.42 0 0 1 .275-.277"
      fill="currentColor"
    />
  </svg>
);
PaperPlaneFilled.displayName = 'PaperPlaneFilled';
