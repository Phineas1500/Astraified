export const TRANSFORMER_SOURCE_URL = "https://arxiv.org/html/1706.03762v7";

/** An explicitly editorial starter excerpt, not a quotation from the paper. */
export const TRANSFORMER_STARTER = `Editorial learning notes about the original Transformer architecture, based on Vaswani et al., Attention Is All You Need, sections 3.1–3.5: https://arxiv.org/html/1706.03762v7

Token identity and sequence order
The model represents tokens using learned embedding vectors. In the original architecture, positional encodings are added to those embeddings to provide information about sequence order. The same token can have the same initial embedding at two locations while the added positional information differs. Numerical changes do not by themselves prove understanding. These notes describe an illustrative small model; real embedding coordinates do not have assigned human-readable meanings.

Scaled dot-product attention
Queries and keys determine comparison scores. Divide their dot products by the square root of the key dimension, then apply softmax to get weights. Multiply those weights by the value vectors and sum the contributions. The result is a weighted mixture of values rather than simply selecting the strongest key. Holding queries and keys fixed while changing values leaves the attention weights fixed but can change the output mixture. Q, K and V in a model come from learned projections of representations; a small demonstration can provide explicit illustrative vectors without claiming that they were trained on language.

Causal masking in decoder self-attention
The original decoder's self-attention restricts each input position to itself and earlier input positions. The prediction target is shifted: that current input helps predict the next token. Future input positions are masked before softmax, receiving zero attention weight. Changing later inputs must not change an earlier position's output under this causal mask. Blocking everything is not a valid repair because a row still needs permitted context. Encoder self-attention does not use this same causal restriction. This is a demonstration of selected computations, not a whole trained language model; full Transformer blocks also include other components such as feed-forward layers, residual connections and normalization.`;
