export type CardWithListItems = {
  title: string;
  id: string;
  description: string;
  contents: Array<Record<string, string>>;
};

export type Props = {
  card: CardWithListItems;
  isActive: boolean;
  onSelect: (cardId: string) => void;
};
