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
import { render, screen } from '@testing-library/react';
import CrossIcon from '../../assets/svg/ic-cross.svg?react';
import * as ToastUtils from '../../utils/ToastUtils';
import AlertBar from './AlertBar';

const mockResetAlert = jest.fn();

jest.mock('../../hooks/useAlertStore', () => ({
  useAlertStore: jest.fn().mockImplementation(() => ({
    resetAlert: mockResetAlert,
    animationClass: 'test-animation-class',
  })),
}));

jest.mock('../../utils/ToastUtils', () => ({
  getIconAndClassName: jest.fn(),
}));

describe('AlertBar', () => {
  (ToastUtils.getIconAndClassName as jest.Mock).mockReturnValue({
    icon: CrossIcon,
    className: 'test-class',
  });

  it('should render AlertBar with the correct type and message', () => {
    const message = 'Test message';
    const type = 'success';

    render(<AlertBar message={message} type={type} />);

    const alertElement = screen.getByTestId('alert-bar');

    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toHaveClass(
      'alert-container test-class test-animation-class'
    );
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('should render the CrossIcon as the close button', () => {
    const message = 'Test message';
    const type = 'info';

    render(<AlertBar message={message} type={type} />);

    const closeIcon = screen.getByTestId('alert-icon-close');

    expect(closeIcon).toBeInTheDocument();
  });

  it('should apply the correct animation class', () => {
    const message = 'Test message';
    const type = 'warning';

    render(<AlertBar message={message} type={type} />);

    const alertElement = screen.getByTestId('alert-bar');

    expect(alertElement).toHaveClass('test-animation-class');
  });
});
