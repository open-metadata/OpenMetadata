/*
 *  Copyright 2023 Collate.
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
import cronstrue from 'cronstrue';
import { capitalize } from 'lodash';
import { getCurrentLocaleForConstrue } from '../i18next/i18nextUtil';

export const getScheduleDescriptionTexts = (scheduleInterval: string) => {
  try {
    const scheduleDescription = cronstrue.toString(scheduleInterval, {
      use24HourTimeFormat: false,
      verbose: true,
      locale: getCurrentLocaleForConstrue(),
    });

    const firstSentenceEndIndex = scheduleDescription.indexOf(',');

    const descriptionFirstPart = scheduleDescription
      .slice(0, firstSentenceEndIndex)
      .trim();

    const descriptionSecondPart = capitalize(
      scheduleDescription.slice(firstSentenceEndIndex + 1).trim()
    );

    return { descriptionFirstPart, descriptionSecondPart };
  } catch {
    return { descriptionFirstPart: '', descriptionSecondPart: '' };
  }
};
