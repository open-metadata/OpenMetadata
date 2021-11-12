const BUFFER_VALUE = 200;
const GAP = 10;

export const getTopPosition = (
  windowHeight: number,
  bottomPosition: number,
  elementHeight: number
) => {
  const bottomSpace = windowHeight - (bottomPosition + BUFFER_VALUE);

  return bottomSpace < 0 ? { bottom: `${elementHeight + GAP}px` } : {};
};
