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
export const getBrowser = () => {
  const userAgent = navigator.userAgent;

  if (userAgent.match(/chrome|chromium|crios/i)) {
    return 'Chrome';
  } else if (userAgent.match(/firefox|fxios/i)) {
    return 'Firefox';
  } else if (userAgent.match(/safari/i)) {
    return 'Safari';
  } else if (userAgent.match(/opr\//i)) {
    return 'Opera';
  } else if (userAgent.match(/edg/i)) {
    return 'Edge';
  } else {
    return 'Other';
  }
};

export const getPopupSettingLink = () => {
  const browser = getBrowser();
  switch (browser) {
    case 'Chrome':
      return 'https://support.google.com/chrome/answer/95472';
    case 'Firefox':
      return 'https://support.mozilla.org/en-US/kb/pop-blocker-settings-exceptions-troubleshooting';
    case 'Safari':
      return 'https://support.apple.com/en-in/guide/safari/sfri40696/mac';
    case 'Opera':
      return 'https://help.opera.com/en/latest/web-preferences/#popUps';
    case 'Edge':
      return 'https://support.microsoft.com/en-us/microsoft-edge/block-pop-ups-in-microsoft-edge-1d8ba4f8-f385-9a0b-e944-aa47339b6bb5';
    default:
      return '';
  }
};
