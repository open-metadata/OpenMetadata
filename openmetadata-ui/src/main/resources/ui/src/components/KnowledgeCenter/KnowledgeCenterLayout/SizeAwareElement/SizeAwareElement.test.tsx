import { render } from '@testing-library/react';
import {
  CENTER_PANEL_DEFAULT_WIDTH,
  CENTER_PANEL_PANEL_MARGIN,
} from 'constants/KnowledgeCenter.constant';
import { SizeAwareElement } from './SizeAwareElement';

describe('SizeAwareElement', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <SizeAwareElement
        isLeftPanelCollapsed={false}
        isRightPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toBeInTheDocument();
  });

  it('applies correct styles when isLeftPanelCollapsed is true', () => {
    const { getByText } = render(
      <SizeAwareElement isLeftPanelCollapsed isRightPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${CENTER_PANEL_DEFAULT_WIDTH + 20}px`
    );
  });

  it('applies correct styles when isRightPanelCollapsed is true', () => {
    const { getByText } = render(
      <SizeAwareElement isRightPanelCollapsed isLeftPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${CENTER_PANEL_DEFAULT_WIDTH + 20}px`
    );
  });

  it('applies correct styles when isRightPanelCollapsed and isLeftPanelCollapsed is true', () => {
    const { getByText } = render(
      <SizeAwareElement isLeftPanelCollapsed isRightPanelCollapsed>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${CENTER_PANEL_DEFAULT_WIDTH + 100}px`
    );
  });

  it('applies correct styles when dimensions are provided', () => {
    const dimensions = { width: 800, height: 600 };
    const { getByText } = render(
      <SizeAwareElement
        dimensions={dimensions}
        isLeftPanelCollapsed={false}
        isRightPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${dimensions.width - CENTER_PANEL_PANEL_MARGIN}px`
    );
  });
});
