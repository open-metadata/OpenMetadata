import { queryByText, render } from '@testing-library/react';
import React from 'react';
import PopOver from './PopOver';

// global.document.createRange = () => ({
//   setStart: jest.fn(),
//   setEnd: jest.fn(),
//   commonAncestorContainer: {
//     nodeName: 'BODY',
//     ownerDocument: document,
//   },
// });

describe('Test Popover Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <PopOver position="bottom" trigger="click">
        <span>Hello World</span>
      </PopOver>
    );

    const popover = queryByText(container, /Hello World/i);

    expect(popover).toBeInTheDocument();
  });

  // it('Onclick popover should display title', () => {
  //   const { container } = render(
  //     <PopOver position="bottom" title="test popover" trigger="click">
  //       <span>Hello World</span>
  //     </PopOver>
  //   );

  //   fireEvent(
  //     getByText(container, /Hello World/i),
  //     new MouseEvent('click', {
  //       bubbles: true,
  //       cancelable: true,
  //     })
  //   );

  //   expect(screen.getByText(/test popover/i)).toBeInTheDocument();
  // });

  // it('Onclick popover should display html', () => {
  //   const html = <p>test popover</p>;
  //   const { container } = render(
  //     <PopOver html={html} position="bottom" trigger="click">
  //       <span>Hello World</span>
  //     </PopOver>
  //   );

  //   fireEvent(
  //     getByText(container, /Hello World/i),
  //     new MouseEvent('click', {
  //       bubbles: true,
  //       cancelable: true,
  //     })
  //   );

  //   expect(screen.getByText(/test popover/i)).toBeInTheDocument();
  // });
});
