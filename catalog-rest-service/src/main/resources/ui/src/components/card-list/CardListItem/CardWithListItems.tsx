import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import { Props } from './CardWithListItems.interface';
import { cardStyle } from './CardWithListItems.style';

const CardListItem: FunctionComponent<Props> = ({
  card,
  isActive,
  onSelect,
}: Props) => {
  return (
    <div
      className={classNames(
        cardStyle.base,
        isActive ? cardStyle.active : cardStyle.default
      )}
      onClick={() => onSelect(card.id)}>
      <div
        className={classNames(
          cardStyle.header.base,
          isActive ? cardStyle.header.active : cardStyle.header.default
        )}>
        <div className="tw-flex tw-flex-col">
          <h4 className={cardStyle.header.title}>{card.title}</h4>
          <p className={cardStyle.header.description}>{card.description}</p>
        </div>
        <div>
          {isActive && <i className="fas fa-check-circle tw-text-h2" />}
        </div>
      </div>
      <div
        className={classNames(
          cardStyle.body.base,
          isActive ? cardStyle.body.active : cardStyle.body.default
        )}>
        <ol className="tw-list-decimal">
          {card.contents.map(({ text }, i) => (
            <li key={i}>{text}</li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default CardListItem;
