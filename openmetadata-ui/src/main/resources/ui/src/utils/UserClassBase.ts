/*
 *  Copyright 2024 Collate.
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
import type { FC } from 'react';

type BotIcon = FC<{ className?: string }>;

class UserClassBase {
  protected botLogos: Record<string, string> = {};
  protected botIcons: Record<string, BotIcon> = {};
  public getBotLogo(botName: string) {
    return this.botLogos[botName];
  }

  // An icon component wins over a logo URL: it follows the theme and needs no fetch.
  // ADR:2026-11-18-a-bot-avatar-icon-is-a-user-class-base-hook
  public getBotIcon(botName: string): BotIcon | undefined {
    // A bot named after an Object.prototype key (`constructor`, `toString`) must
    // not get that built-in back as a React component.
    return Object.prototype.hasOwnProperty.call(this.botIcons, botName)
      ? this.botIcons[botName]
      : undefined;
  }
}

const userClassBase = new UserClassBase();

export default userClassBase;
export { UserClassBase };
export type { BotIcon };
