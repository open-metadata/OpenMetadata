import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import LikeCounter from './LikeCounter';

describe('Test LikeCounter Component', () => {
  it('Renders the proper icon and like count', () => {
    const { container } = render(<LikeCounter likeCount="234" />);
    const iconElement = getByTestId(container, 'icon');
    const likeCountElement = getByTestId(container, 'like-count');

    expect(iconElement).toBeInTheDocument();
    expect(likeCountElement.textContent).toBe('234');
  });
});
