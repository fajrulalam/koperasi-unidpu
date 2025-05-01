import React, { useEffect, useState } from "react";
import { useEnvironment } from "../context/EnvironmentContext";

/**
 * A higher-order component that adds an environment prefix to component titles (h1)
 * when in testing mode.
 */
const withEnvironmentPrefix = (WrappedComponent) => {
  return (props) => {
    const { isProduction } = useEnvironment();
    const [modifiedProps, setModifiedProps] = useState(props);

    useEffect(() => {
      // We're only modifying the DOM directly in non-production mode
      if (!isProduction) {
        // Find and update all h2 elements within the component
        setTimeout(() => {
          const componentRoot = document.querySelector(`.${WrappedComponent.name.toLowerCase()}-container`);
          if (componentRoot) {
            const headings = componentRoot.querySelectorAll('h1, h2');
            headings.forEach(heading => {
              // Only add the prefix if it doesn't already have it
              if (!heading.textContent.includes('[TESTING]')) {
                heading.textContent = `[TESTING] ${heading.textContent}`;
              }
            });
          }
        }, 100); // Small delay to ensure component is mounted
      }
    }, [isProduction, props]);

    return <WrappedComponent {...props} />;
  };
};

export default withEnvironmentPrefix;