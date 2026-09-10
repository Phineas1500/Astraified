import {
  defaultTreeAdapter,
  parse,
  serialize,
  type DefaultTreeAdapterTypes,
} from "parse5";
import { SourceError } from "./errors.js";

export const MAX_HTML_DOWNLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_HTML_MARKUP_BYTES = 2 * 1024 * 1024;
const MAX_HTML_ELEMENTS = 20_000;
const MAX_HTML_DEPTH = 256;
const ASSET_ATTRIBUTES = new Set(["src", "srcset", "href", "poster", "data"]);

/** Reduce exported lecture/notebook assets before allocating the full browser DOM.
 * parse5 only parses markup; it never loads resources or executes page scripts.
 * This is text-import preparation, not a sanitizer for displaying untrusted HTML.
 */
export function prepareSourceHtml(html: string): string {
  if (Buffer.byteLength(html) > MAX_HTML_DOWNLOAD_BYTES)
    throw new SourceError(
      413,
      "This webpage exceeds the 10 MB download limit. Paste a focused excerpt or upload a text document.",
    );
  let elements = 0;
  const document = parse(html, {
    scriptingEnabled: false,
    treeAdapter: {
      ...defaultTreeAdapter,
      createElement(tagName, namespaceURI, attrs) {
        if (++elements > MAX_HTML_ELEMENTS)
          throw new SourceError(
            413,
            "This webpage has too many elements to read. Paste a focused excerpt or upload a text document.",
          );
        // Parse attribute boundaries/entities correctly even in malformed HTML.
        // Removing a data URL does not remove its image alt text or caption.
        const retained = attrs.filter(
          (attr) =>
            !(ASSET_ATTRIBUTES.has(attr.name) && /data:/i.test(attr.value)),
        );
        return defaultTreeAdapter.createElement(
          tagName,
          namespaceURI,
          retained,
        );
      },
    },
  });

  const pending: { node: DefaultTreeAdapterTypes.ParentNode; depth: number }[] =
    [{ node: document, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (depth > MAX_HTML_DEPTH)
      throw new SourceError(
        413,
        "This webpage is too deeply nested to read. Paste a focused excerpt or upload a text document.",
      );
    node.childNodes = node.childNodes.filter(
      (child) =>
        child.nodeName !== "#comment" &&
        !(
          "tagName" in child &&
          ["script", "style", "template", "noscript"].includes(child.tagName)
        ),
    );
    for (const child of node.childNodes)
      if ("childNodes" in child)
        pending.push({ node: child, depth: depth + 1 });
  }
  const markup = serialize(document);
  if (Buffer.byteLength(markup) > MAX_HTML_MARKUP_BYTES)
    throw new SourceError(
      413,
      "This webpage still exceeds the 2 MB text-and-markup limit after removing embedded assets. Paste a focused excerpt or upload a text document.",
    );
  return markup;
}
