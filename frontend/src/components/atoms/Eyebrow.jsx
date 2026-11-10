/** Small uppercase label above a heading. chip: render as a rounded chip. */
export default function Eyebrow({ chip = false, children }) {
  return <span className={chip ? "eyebrow-chip" : "eyebrow"}>{children}</span>;
}
