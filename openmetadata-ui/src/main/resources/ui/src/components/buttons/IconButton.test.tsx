import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import IconButton from './IconButton';

const mockFunction = jest.fn();
const icon = <SVGIcons alt="Edit" icon={Icons.EDIT} />;

describe('Test Icon Button Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <IconButton icon={icon} title="test" onClick={mockFunction} />
    );

    const iconButton = getByTestId('icon-button');

    expect(iconButton).toBeInTheDocument();
  });

  it('OnClick callback function should call', () => {
    const { getByTestId } = render(
      <IconButton icon={icon} title="test" onClick={mockFunction} />
    );

    const iconButton = getByTestId('icon-button');
    fireEvent(
      iconButton,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});
