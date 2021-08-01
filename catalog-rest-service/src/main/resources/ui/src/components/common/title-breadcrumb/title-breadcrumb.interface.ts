export type TitleBreadcrumbProps = {
  titleLinks: Array<{
    name: string;
    url: string;
    imgSrc?: string;
    activeTitle?: boolean;
  }>;
  className?: string;
};
