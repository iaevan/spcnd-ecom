/**
 * WC flat_rate cost expressions: arithmetic over decimals with the
 * placeholders `[qty]`, `[cost]` and `[fee percent="10" min_fee="4"
 * max_fee="20"]`. Evaluated with a tiny recursive-descent parser — never
 * `eval`. Malformed expressions resolve to 0, matching WC's forgiving
 * `WC_Eval_Math` behavior for storefront safety.
 */

export interface CostContext {
  qty: number;
  /** Package (or class group) subtotal as a decimal number. */
  cost: number;
}

const FEE_PATTERN = /\[fee([^\]]*)\]/gi;
const ATTR_PATTERN = /(\w+)\s*=\s*"([^"]*)"/g;

function substitute(expression: string, ctx: CostContext): string {
  let out = expression.replace(/\[qty\]/gi, String(ctx.qty)).replace(/\[cost\]/gi, String(ctx.cost));
  out = out.replace(FEE_PATTERN, (_whole, attrText: string) => {
    const attrs: Record<string, string> = {};
    for (const match of attrText.matchAll(ATTR_PATTERN)) {
      attrs[(match[1] ?? '').toLowerCase()] = match[2] ?? '';
    }
    let fee = (Number(attrs.percent ?? 0) / 100) * ctx.cost;
    const minFee = Number(attrs.min_fee);
    const maxFee = Number(attrs.max_fee);
    if (Number.isFinite(minFee) && fee < minFee) fee = minFee;
    if (Number.isFinite(maxFee) && maxFee > 0 && fee > maxFee) fee = maxFee;
    return String(fee);
  });
  return out;
}

class Parser {
  private pos = 0;
  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.expression();
    this.skipSpace();
    if (this.pos < this.input.length) throw new Error('trailing input');
    return value;
  }

  private expression(): number {
    let value = this.term();
    for (;;) {
      this.skipSpace();
      const op = this.input[this.pos];
      if (op === '+' || op === '-') {
        this.pos++;
        const rhs = this.term();
        value = op === '+' ? value + rhs : value - rhs;
      } else {
        return value;
      }
    }
  }

  private term(): number {
    let value = this.factor();
    for (;;) {
      this.skipSpace();
      const op = this.input[this.pos];
      if (op === '*' || op === '/') {
        this.pos++;
        const rhs = this.factor();
        value = op === '*' ? value * rhs : rhs === 0 ? 0 : value / rhs;
      } else {
        return value;
      }
    }
  }

  private factor(): number {
    this.skipSpace();
    const ch = this.input[this.pos];
    if (ch === '(') {
      this.pos++;
      const value = this.expression();
      this.skipSpace();
      if (this.input[this.pos] !== ')') throw new Error('missing )');
      this.pos++;
      return value;
    }
    if (ch === '-') {
      this.pos++;
      return -this.factor();
    }
    const match = /^\d+(\.\d+)?/.exec(this.input.slice(this.pos));
    if (!match) throw new Error(`unexpected token at ${this.pos}`);
    this.pos += match[0].length;
    return Number(match[0]);
  }

  private skipSpace(): void {
    while (this.input[this.pos] === ' ') this.pos++;
  }
}

/** Evaluate a cost expression to a decimal amount (0 on any parse error). */
export function evaluateCost(expression: string | undefined | null, ctx: CostContext): number {
  const raw = String(expression ?? '').trim();
  if (raw === '') return 0;
  const substituted = substitute(raw, ctx);
  try {
    const value = new Parser(substituted).parse();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
