/** CSS arrives as a string through esbuild's `text` loader. */
declare module '*.css' {
  const content: string
  export default content
}
