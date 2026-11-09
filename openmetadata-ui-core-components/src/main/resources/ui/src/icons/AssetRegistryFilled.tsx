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

export const AssetRegistryFilled: FC<Props> = ({
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
    <g clipPath="url(#a)">
      <path
        d="M13.968 7.26V3.768C13.968 2.24 11.288 1 7.984 1 4.679 1 2 2.24 2 3.768v8.997c0 1.385 2.198 2.532 5.068 2.736"
        stroke="currentColor"
        strokeWidth={1.3}
      />
      <path
        d="M13.968 3.563c0 1.416-2.68 2.564-5.984 2.564C4.679 6.127 2 4.98 2 3.563m0 4.402C2 9.248 4.199 10.31 7.07 10.5"
        stroke="currentColor"
        strokeWidth={1.3}
      />
      <path
        d="M13.399 9.606c.133-.075.2-.113.27-.127a.5.5 0 0 1 .19 0c.07.014.138.052.271.127l3.482 1.963c.141.08.212.12.263.176q.07.076.1.174c.025.072.025.154.025.318v3.875c0 .164 0 .246-.024.319a.5.5 0 0 1-.1.174c-.052.056-.123.096-.264.175l-3.482 1.963c-.133.075-.2.113-.27.128a.5.5 0 0 1-.19 0c-.071-.015-.138-.053-.271-.128L9.917 16.78c-.141-.08-.212-.119-.263-.175a.5.5 0 0 1-.1-.174c-.025-.073-.025-.155-.025-.319v-3.875c0-.164 0-.246.024-.319a.5.5 0 0 1 .1-.173c.052-.057.123-.096.264-.176z"
        fill="currentColor"
      />
      <path
        d="m17.764 11.92-4 2.255m0 0-4-2.255m4 2.255v4.535M18 16.113v-3.875c0-.164 0-.246-.024-.319a.5.5 0 0 0-.1-.173c-.052-.057-.123-.096-.263-.176L14.13 9.606c-.134-.075-.2-.113-.27-.127a.5.5 0 0 0-.19 0c-.07.014-.137.052-.27.127h-.001L9.917 11.57h-.001c-.14.08-.211.12-.262.176a.5.5 0 0 0-.1.174c-.025.072-.025.154-.025.318v3.875c0 .164 0 .246.024.319a.5.5 0 0 0 .1.174c.052.056.123.096.264.175l3.482 1.963c.133.075.2.113.27.128a.5.5 0 0 0 .19 0c.07-.015.138-.053.271-.128l3.482-1.963c.141-.08.212-.119.263-.175a.5.5 0 0 0 .1-.174c.025-.073.025-.155.025-.319"
        stroke="currentColor"
        strokeWidth={1.3}
      />
      <path
        className="tw:stroke-bg-primary"
        d="m17.765 11.922-4 2.255m0 0-4-2.255m4 2.255v4.535"
        stroke="#fff"
        strokeWidth={1.3}
      />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
AssetRegistryFilled.displayName = 'AssetRegistryFilled';
