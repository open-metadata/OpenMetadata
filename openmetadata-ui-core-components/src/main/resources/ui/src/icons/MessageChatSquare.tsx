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

export const MessageChatSquare: FC<Props> = ({
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
      d="M8.333 12.5 5.77 15.095c-.358.362-.537.543-.69.555a.42.42 0 0 1-.351-.143c-.1-.117-.1-.372-.1-.88v-1.3c0-.457-.374-.787-.825-.853a2.5 2.5 0 0 1-2.112-2.111c-.025-.18-.025-.396-.025-.825V5.667c0-1.4 0-2.1.273-2.635A2.5 2.5 0 0 1 3.033 1.94c.534-.273 1.234-.273 2.634-.273h6.167c1.4 0 2.1 0 2.635.273a2.5 2.5 0 0 1 1.093 1.093c.271.534.271 1.234.271 2.634v3.5m0 9.167-1.813-1.261c-.255-.177-.383-.267-.522-.329a1.7 1.7 0 0 0-.385-.121c-.15-.028-.306-.028-.617-.028H11c-.933 0-1.4 0-1.757-.182a1.67 1.67 0 0 1-.728-.728c-.182-.357-.182-.823-.182-1.757v-2.095c0-.933 0-1.4.182-1.757a1.67 1.67 0 0 1 .728-.728c.357-.181.824-.181 1.757-.181h4.667c.933 0 1.4 0 1.757.182a1.67 1.67 0 0 1 .728.728c.181.356.181.823.181 1.756v2.262c0 .777 0 1.165-.127 1.472a1.67 1.67 0 0 1-.902.902c-.306.127-.694.127-1.471.127z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MessageChatSquare.displayName = 'MessageChatSquare';
