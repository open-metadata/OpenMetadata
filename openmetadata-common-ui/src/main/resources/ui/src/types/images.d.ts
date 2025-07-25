declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const ReactComponent: React.FunctionComponent<
    React.SVGAttributes<SVGElement>
  >;
  const content: string;
  export { ReactComponent };
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}
