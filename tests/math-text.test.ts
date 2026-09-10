import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { preserveMathText } from "../server/math-text";

function extract(html: string) {
  const dom = new JSDOM(`<article>${html}</article>`);
  try {
    preserveMathText(dom.window.document);
    return dom.window.document.body.textContent!.trim();
  } finally {
    dom.window.close();
  }
}
describe("mathematical source text", () => {
  it("retains fraction grouping, powers and roots instead of concatenating operands", () => {
    expect(
      extract(
        "<math><mfrac><mrow><msup><mi>x</mi><mn>2</mn></msup><mo>−</mo><mn>1</mn></mrow><mrow><mi>x</mi><mo>−</mo><mn>1</mn></mrow></mfrac></math>",
      ),
    ).toBe("((x)^(2)−1)/(x−1)");
    expect(
      extract(
        "<math><msqrt><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>1</mn></msqrt></math>",
      ),
    ).toBe("sqrt((x)^(2)+1)");
  });
  it("keeps a limit and removes a duplicate semantic MathML representation", () => {
    expect(
      extract(
        '<math><semantics><mrow><munder><mi>lim</mi><mrow><mi>h</mi><mo>→</mo><mn>0</mn></mrow></munder><mfrac><mi>h</mi><mi>h</mi></mfrac></mrow><annotation-xml encoding="MathML-Content"><mtext>duplicate alternative</mtext></annotation-xml></semantics></math>',
      ),
    ).toBe("lim_[h→0](h)/(h)");
  });
  it("prefers an available original TeX annotation and preserves surrounding prose", () => {
    expect(
      extract(
        'Consider <math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^{2}+1</annotation></semantics></math> today.',
      ),
    ).toBe("Consider  x^{2}+1  today.");
  });
});
