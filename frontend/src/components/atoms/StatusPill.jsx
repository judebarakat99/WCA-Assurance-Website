/**
 * Small rounded status label with a leading dot.
 * tone: good | warn | bad | info | mute | gold
 */
export default function StatusPill({ tone = "mute", className = "", children, ...rest }) {
  return (
    <span className={`pill p-${tone} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
