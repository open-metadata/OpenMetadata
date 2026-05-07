import { useEffect, useLayoutEffect } from 'react';

const useAutoSizeTextArea = (
  id: string,
  textAreaRef: HTMLTextAreaElement | null,
  value: string
) => {
  useEffect(() => {
    if (textAreaRef) {
      // We need to reset the height momentarily to get the correct scrollHeight for the textarea
      textAreaRef.style.height = '0px';
      const scrollHeight = textAreaRef.scrollHeight;

      textAreaRef.style.height = scrollHeight + 'px';
    }
  }, [textAreaRef, value]);

  // this will calculate the height of textArea before DOM paints
  useLayoutEffect(() => {
    const textArea = document.getElementById(id);
    if (textArea) {
      const scrollHeight = textArea.scrollHeight;
      textArea.style.height = scrollHeight + 'px';
    }
  }, []);
};

export default useAutoSizeTextArea;
