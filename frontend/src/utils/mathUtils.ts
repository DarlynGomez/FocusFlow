// Wraps detected math expressions in LaTeX delimiters so KaTeX can render them
export function formatMathForContext(text: string): string {
    return text
      .replace(/O\(1\/√T\)/g, "`O(1/√T)`")
      .replace(/O\(√([\d/T]+)\)/g, "`O(√$1)`")
      .replace(/∥∇f\([^)]+\)∥2/g, (match) => `\`${match}\``)
      .replace(/η[_t\d]*\s*=\s*[^,\s]+/g, (match) => `\`${match}\``);
  }
