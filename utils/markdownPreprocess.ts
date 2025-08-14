// Utility to extend single-paragraph blockquotes into multi-paragraph ones
// similar to Peakd behavior: if a paragraph starts with '> ' we treat following
// paragraphs separated only by a blank line (or direct line) as part of the same
// quote even if user omitted additional leading '>' markers. Blank lines inside
// the quote are normalized to a single line starting with '> '.
// NOTE: This is a heuristic and can be refined; it avoids converting once two
// consecutive blank lines appear or another structural marker (like code fence)
// begins.
export function applyMultiParagraphBlockquotes(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inQuote = false;
  let blankCountInQuote = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const startsQuote = /^>\s?/.test(line);

    if (startsQuote) {
      inQuote = true;
      blankCountInQuote = 0;
      out.push(line); // keep as-is
      continue;
    }

    if (inQuote) {
      if (trimmed === '') {
        // Blank line inside quote: normalize as '> ' to preserve paragraph break
        blankCountInQuote += 1;
        // If more than one consecutive blank, treat as end of quote
        if (blankCountInQuote > 1) {
          inQuote = false;
          out.push(line); // emit actual blank line ending quote
        } else {
          out.push('> '); // single blank inside keeps quote open
        }
        continue;
      }
      // Stop extending if structural block starts
      if (/^(#{1,6}\s|```|~~~|\s{4}|\t)/.test(line)) {
        inQuote = false;
        out.push(line);
        continue;
      }
      // Continue quote for normal text line by prefixing
      out.push('> ' + line.replace(/^>\s?/, '')); // ensure single prefix
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}
