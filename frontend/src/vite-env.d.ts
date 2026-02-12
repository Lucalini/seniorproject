/// <reference types="vite/client" />

// Vite's default asset type declarations cover lowercase extensions.
// This project includes assets with uppercase extensions (e.g. `.JPG`),
// so we declare them explicitly for TypeScript.
declare module '*.JPG' {
  const src: string
  export default src
}

declare module '*.JPEG' {
  const src: string
  export default src
}

