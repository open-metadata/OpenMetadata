import type {
  DetailedReactHTMLElement,
  HTMLAttributes,
  ReactNode,
} from 'react';
import React, { cloneElement, useRef } from 'react';
import { filterDOMProps } from '@react-aria/utils';

interface FileTriggerProps {
  /**
   * Specifies what mime type of files are allowed.
   */
  acceptedFileTypes?: Array<string>;
  /**
   * Whether multiple files can be selected.
   */
  allowsMultiple?: boolean;
  /**
   * Specifies the use of a media capture mechanism to capture the media on the spot.
   */
  defaultCamera?: 'user' | 'environment';
  /**
   * Handler when a user selects a file.
   */
  onSelect?: (files: FileList | null) => void;
  /**
   * The children of the component.
   */
  children: ReactNode;
  /**
   * Enables the selection of directories instead of individual files.
   */
  acceptDirectory?: boolean;
}

/**
 * A FileTrigger allows a user to access the file system with any pressable React Aria or
 * React Spectrum component, or custom components built with usePress.
 */
export const FileTrigger = (props: FileTriggerProps) => {
  const {
    children,
    onSelect,
    acceptedFileTypes,
    allowsMultiple,
    defaultCamera,
    acceptDirectory,
    ...rest
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const domProps = filterDOMProps(rest);

  // Make sure that only one child is passed to the component.
  const clonableElement = React.Children.only(children);

  // Clone the child element and add an `onClick` handler to open the file dialog.
  const mainElement = cloneElement(
    clonableElement as DetailedReactHTMLElement<
      HTMLAttributes<HTMLElement>,
      HTMLElement
    >,
    {
      onClick: () => {
        if (inputRef.current?.value) {
          inputRef.current.value = '';
        }
        inputRef.current?.click();
      },
    }
  );

  return (
    <>
      {mainElement}
      <input
        {...domProps}
        accept={acceptedFileTypes?.toString()}
        capture={defaultCamera}
        multiple={allowsMultiple}
        ref={inputRef}
        style={{ display: 'none' }}
        type="file"
        // @ts-expect-error - webkitdirectory is a non-standard HTML attribute not in React's type definitions
        webkitdirectory={acceptDirectory ? '' : undefined}
        onChange={(e) => onSelect?.(e.target.files)}
      />
    </>
  );
};
