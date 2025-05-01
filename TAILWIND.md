# Tailwind CSS Integration

This project has been enhanced with Tailwind CSS, a utility-first CSS framework for rapidly building custom user interfaces.

## Installation

Tailwind CSS and its dependencies have been installed with:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## Configuration

### tailwind.config.js

The Tailwind configuration file includes:

- Content path configuration for the entire project
- Custom color theme definitions for the application
  - `unimart-pink`: #f77b7b
  - `unimart-purple`: #800080

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'unimart-pink': '#f77b7b',
        'unimart-purple': '#800080',
      },
    },
  },
  plugins: [],
}
```

### CSS Integration

The Tailwind directives have been added to the main CSS file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Rest of the original styles */
```

## Using Tailwind

### Examples

1. **Simple Component (TailwindTest)**
   - A basic card component demonstrating Tailwind's utility classes
   - Available through the sidebar as "Tailwind Test"

2. **Full Component (Login)**
   - The login system has been fully converted to use Tailwind CSS
   - This demonstrates how to migrate from traditional CSS to utility classes

### Utility Classes

Common Tailwind utility patterns used in the project:

- Layout: `flex`, `grid`, `p-4`, `m-2`, etc.
- Typography: `text-xl`, `font-medium`, `text-gray-700`
- Colors: `bg-white`, `text-unimart-pink`
- Responsive design: `md:grid-cols-2`, `lg:flex-row`
- Hover/focus states: `hover:bg-blue-600`, `focus:ring-2`

### Best Practices

1. **Component Organization**
   - Use Tailwind's composition pattern for reusable components
   - Group related utilities with consistent spacing

2. **Responsive Design**
   - Mobile-first approach with responsive variants like `md:` and `lg:`
   - Test all components at various screen sizes

3. **Custom Extensions**
   - Extend Tailwind's theme in `tailwind.config.js` for app-specific values
   - Use custom colors for brand consistency

## Additional Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com/components)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) (VSCode extension)