import ReactDOM from 'react-dom';

const Portal = ({ children }) => {
  return ReactDOM.createPortal(children, document.body);
};

export default Portal;
