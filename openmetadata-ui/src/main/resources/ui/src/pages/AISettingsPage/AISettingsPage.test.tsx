/*
 *  Copyright 2026 Collate.
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
import { render, screen } from '@testing-library/react';
import AISettingsPage from './AISettingsPage';

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn().mockResolvedValue({
    enabled: true,
    memoryExtraction: { fromFiles: true, fromPages: false },
    memoryAgent: { enabled: true },
    prompts: { memoryExtraction: { systemPrompt: 'p' } },
  }),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockReturnValue(<div>TitleBreadcrumb</div>)
);

jest.mock('../../components/PageHeader/PageHeader.component', () =>
  jest.fn().mockReturnValue(<div>PageHeader</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(({ children, onPress }) => (
      <button onClick={onPress}>{children}</button>
    )),
  Select: Object.assign(
    jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
    {
      Item: jest
        .fn()
        .mockImplementation(({ label }) => <option>{label}</option>),
    }
  ),
  TextArea: jest.fn().mockImplementation(({ label }) => <div>{label}</div>),
  Toggle: jest
    .fn()
    .mockImplementation(
      ({ label, onChange, isSelected, isDisabled, ...rest }) => (
        <button
          aria-checked={isSelected}
          aria-disabled={isDisabled}
          role="switch"
          onClick={() => onChange?.(!isSelected)}
          {...rest}>
          {label}
        </button>
      )
    ),
}));

describe('AISettingsPage', () => {
  it('renders the AI settings toggles after load', async () => {
    render(<AISettingsPage />);

    expect(await screen.findByTestId('ai-master-toggle')).toBeInTheDocument();
  });
});
