/** Preserve mathematical grouping before Readability flattens HTML into text. */
export function preserveMathText(document: Document): void {
  function render(element: Element, depth = 0): string {
    if (depth > 64) return "[mathematical expression exceeds nesting limit]";
    const children = Array.from(element.children).filter(
      (child) =>
        !["annotation", "annotation-xml", "mphantom"].includes(child.localName),
    );
    const parts = children.map((child) => render(child, depth + 1));
    const at = (index: number) => parts[index] || "?";
    switch (element.localName) {
      case "semantics":
        return at(0);
      case "mfrac":
        return `(${at(0)})/(${at(1)})`;
      case "msup":
        return `(${at(0)})^(${at(1)})`;
      case "msub":
        return `(${at(0)})_(${at(1)})`;
      case "msubsup":
        return `(${at(0)})_(${at(1)})^(${at(2)})`;
      case "msqrt":
        return `sqrt(${parts.join("")})`;
      case "mroot":
        return `root[${at(1)}](${at(0)})`;
      case "munder":
        return `${at(0)}_[${at(1)}]`;
      case "mover":
        return `${at(0)}^[${at(1)}]`;
      case "munderover":
        return `${at(0)}_[${at(1)}]^[${at(2)}]`;
      case "mtable":
        return `[${parts.join("; ")}]`;
      case "mtr":
      case "mlabeledtr":
        return parts.join(", ");
      case "mfenced":
        return `${element.getAttribute("open") ?? "("}${parts.join(element.getAttribute("separators") || ",")}${element.getAttribute("close") ?? ")"}`;
      case "mspace":
        return " ";
      default:
        return children.length
          ? parts.join("")
          : (element.textContent || "").replace(/\s+/g, " ").trim();
    }
  }
  for (const math of Array.from(document.querySelectorAll("math"))) {
    // Alternative representations are the same equation, not additional source text.
    const tex = math.querySelector(
      'annotation[encoding="application/x-tex"], annotation[encoding="TeX"]',
    );
    const expression = tex?.textContent?.trim() || render(math);
    math.replaceWith(document.createTextNode(` ${expression} `));
  }
}
