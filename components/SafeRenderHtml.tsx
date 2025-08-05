import React, { useEffect } from 'react';
import RenderHtml, { RenderHTMLProps } from 'react-native-render-html';

interface SafeRenderHtmlProps extends Omit<RenderHTMLProps, 'key'> {
  key?: string | number;
}

const SafeRenderHtml: React.FC<SafeRenderHtmlProps> = props => {
  // Suppress the specific warning about key prop spreading
  useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args[0];
      if (
        typeof message === 'string' &&
        (message.includes(
          'A props object containing a "key" prop is being spread into JSX'
        ) ||
          message.includes('FitImage'))
      ) {
        return; // Suppress these specific warnings
      }
      originalWarn.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
    };
  }, []);

  // Extract key from props to pass it directly
  const { key, ...otherProps } = props;

  return <RenderHtml key={key} {...otherProps} />;
};

export default SafeRenderHtml;
