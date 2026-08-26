# Canva Konva

An online whiteboard / drawing tool built with [Konva.js](https://konvajs.org/), Next.js (App Router), and React. It supports adding rectangles, circles, triangles, stars, lines, text, and images — all draggable, resizable, and rotatable. Other features include a freehand brush/eraser tool, multi-select with layer group locking, drag-to-reorder layers, undo/redo, a PNG export preview, and a canvas size control with an optional aspect-ratio lock.

## Requirements

| Tool | Version |
| --- | --- |
| [Node.js](https://nodejs.org/) | ≥ 20.9 |
| [npm](https://www.npmjs.com/) | ≥ 10 |
| [Next.js](https://nextjs.org/) | 16.3.1 |
| [React](https://react.dev/) | 19.2.8 |
| [TypeScript](https://www.typescriptlang.org/) | ^5 |
| [Konva](https://konvajs.org/) | ^10.3.1 |
| [react-konva](https://github.com/konvajs/react-konva) | ^19.2.5 |

## Getting Started

```bash
npm install       # install dependencies
npm run dev       # start the dev server (http://localhost:3000)
npm run build     # build for production
npm run start     # start the production server
npm run lint      # run ESLint
```

Once the dev server is running, open [http://localhost:3000](http://localhost:3000) (or `/canva`) to open the canvas.

## Deployment

[https://sokuo1748.github.io/canva-konva/](https://sokuo1748.github.io/canva-konva/)

The `main` branch is automatically built and deployed to GitHub Pages via GitHub Actions (`.github/workflows/deploy-pages.yml`) on every push.
