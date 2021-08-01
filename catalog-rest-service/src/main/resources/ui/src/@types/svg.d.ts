type SvgComponent = React.FunctionComponent<React.SVGAttributes<SVGElement>>;

// Module declaration to allow importing SVG files
declare module '*.svg' {
  const ReactComponent: SvgComponent;
  const path: string; // Fix it with url-loader

  export { ReactComponent };
  export default path;
}
