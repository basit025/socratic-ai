/** CS-372 Compiler Construction: written by the team from their own lecture slides. */
import { closed, draft, lab, open, quiz, weeks, written, type CoursePack } from "./kit.js";

const C = "cs372";

export const compilers: CoursePack = {
  course: { key: C, teacher: "saima", code: "CS-372", name: "Compiler Construction", section: "Section A", term: "Fall 2026", joinCode: "CCN4PZ", students: [] },
  modules: weeks(C, [
    ["What a compiler does", `
### Translation, not magic
A compiler reads a program in a **source language** and produces an equivalent program in a **target language** (often assembly or machine code), reporting errors along the way.

### The structure
- **Two-pass**: a **front end** (understand the source: scanner + parser, builds an intermediate representation) and a **back end** (generate target code: instruction selection, register allocation).
- **Three-pass** adds an **optimizer** in the middle that improves the IR (constant folding, dead-code elimination, common subexpressions).

\`\`\`text
source → [scanner] → tokens → [parser] → IR → [optimizer] → IR → [back end] → target
\`\`\`

> Because the front end and back end only share the IR, one front end can target many machines, and many languages can share one back end.
`],
    ["Lexical analysis and tokens", `
### The scanner's job
Read characters and group them into **tokens**: (token type, lexeme). Whitespace and comments are thrown away.

| Lexeme | Token |
| --- | --- |
| \`total\` | ID |
| \`=\` | ASSIGN |
| \`42\` | NUM |
| \`(\` | LPAREN |

### An ad-hoc lexer
Look at the current character and decide: a digit starts a number (keep reading digits), a letter starts an identifier (keep reading letters and digits), an operator is one or two characters.

> Keywords like \`if\` and \`while\` look like identifiers. Scan them as IDs, then check a keyword table.
`],
    ["Regular languages and finite automata", `
### Regular expressions
Built from symbols with three operations: **concatenation** (ab), **alternation** (a|b) and **Kleene star** (a*). Examples: integers \`[0-9]+\`, identifiers \`[a-zA-Z_][a-zA-Z0-9_]*\`.

### Finite automata
A **DFA** has states, one start state, accepting states and exactly one transition per (state, symbol). It accepts a string if reading it ends in an accepting state.

### Thompson's construction
Any regular expression can be turned into an **NFA** (which may have ε-moves and several choices) by gluing small NFAs for each operator together.

\`\`\`text
DFA for binary numbers divisible by 3 (state = value mod 3):
  r0 --0--> r0   r0 --1--> r1
  r1 --0--> r2   r1 --1--> r0
  r2 --0--> r1   r2 --1--> r2      accept: r0
\`\`\`
`],
    ["NFA to DFA: subset construction", `
### Why convert?
NFAs are easy to build from regular expressions but slow to simulate. DFAs are fast: one transition per character.

### Subset construction
Each DFA state is a **set** of NFA states.
1. Start: ε-closure of the NFA start state.
2. For each DFA state S and symbol a: move(S, a), then take its ε-closure → a new DFA state.
3. Repeat until no new sets appear. A DFA state is accepting if it contains an NFA accepting state.

### Minimization
Hopcroft's algorithm splits states into groups that behave differently (start with accepting vs. non-accepting) until no group can be split. Equivalent states merge, giving the smallest DFA.
`],
    ["Generated scanners and grammars", `
### Scanner generators
Tools like **lex/flex** take regular expressions with actions and generate the DFA-based scanner for you:

\`\`\`text
[0-9]+          { return NUM; }
"while"         { return WHILE; }
[a-zA-Z_]\\w*    { return ID; }
\`\`\`
Rules: take the **longest match**; on a tie, the rule listed first wins.

### Beyond regular: context-free grammars
Balanced parentheses can't be matched by any finite automaton, so syntax needs **context-free grammars**: productions like \`Expr → Expr + Term | Term\`. A **derivation** rewrites the start symbol into a sentence, leftmost or rightmost.
`],
    ["Parse trees, precedence and ambiguity", `
### Parse trees
A parse tree shows how a sentence is derived. Its shape fixes the meaning: in \`2 + 3 * 4\`, multiplication must sit lower in the tree so it happens first.

### Encoding precedence
Give each precedence level its own non-terminal:

\`\`\`text
Expr   → Expr + Term | Expr - Term | Term
Term   → Term * Factor | Term / Factor | Factor
Factor → ( Expr ) | num | id
\`\`\`

### Ambiguity
A grammar is **ambiguous** if a sentence has two parse trees. The classic case is the **dangling else**: in \`if a then if b then s1 else s2\`, which \`if\` owns the \`else\`? Fix it by rewriting the grammar so an \`else\` always matches the nearest unmatched \`then\`.
`],
    ["Top-down parsing and recursive descent", `
### Top-down parsing
Start from the start symbol and grow the tree downwards, choosing productions to match the input left to right.

### Left recursion breaks it
\`Expr → Expr + Term\` makes a top-down parser call itself forever. Rewrite **A → Aα | β** as:

\`\`\`text
A  → β A'
A' → α A' | ε
\`\`\`

### Recursive descent
One function per non-terminal; each function looks at the next token and calls the functions for that production's symbols.

\`\`\`python
def expr():            # Expr → Term Expr'
    term(); expr_prime()
\`\`\`
`],
    ["LL(1): FIRST, FOLLOW and the parse table", `
### Predictive parsing
An **LL(1)** parser chooses a production by looking at just **1** token of lookahead, using a table instead of backtracking.

### FIRST and FOLLOW
- **FIRST(α)**: terminals that can begin a string derived from α (plus ε if α can vanish).
- **FOLLOW(A)**: terminals that can appear immediately after A in some sentential form ($ for end of input).

\`\`\`text
E  → T E'        FIRST(E) = FIRST(T) = FIRST(F) = { (, id }
E' → + T E' | ε  FIRST(E') = { +, ε }
T  → F T'        FIRST(T') = { *, ε }
T' → * F T' | ε  FOLLOW(E) = FOLLOW(E') = { ), $ }
F  → ( E ) | id
\`\`\`

### Building the table
For A → α: put it in M[A, a] for each a in FIRST(α); if ε ∈ FIRST(α), also for each a in FOLLOW(A). If a cell gets two entries, the grammar isn't LL(1): try **left factoring**.
`],
    ["Bottom-up parsing: shift-reduce", `
### Building the tree from the leaves
A bottom-up parser finds a **rightmost derivation in reverse**. It keeps a stack and repeatedly:
- **shift**: push the next input token, or
- **reduce**: replace a **handle** on top of the stack (the right side of a production) with its left side.

\`\`\`text
Stack          Input           Action
$              int + int $     shift
$ int          + int $         reduce E → int
$ E            + int $         shift
$ E +          int $           shift
$ E + int      $               reduce E → E + int
$ E            $               accept
\`\`\`

> The hard part is knowing *when* the top of the stack is a handle: that's what LR tables decide.
`],
    ["LR(1) parsers", `
### Items and the canonical collection
An **LR(1) item** is a production with a dot showing how much has been seen, plus one lookahead symbol: \`[E → E • + T, $]\`.

- **closure**: if the dot is before a non-terminal B, add B's productions with the right lookaheads (from FIRST of what follows).
- **goto**: move the dot over a symbol.

The sets of items form the states of a DFA (the **canonical collection**); its transitions and reductions fill the **ACTION** and **GOTO** tables. Tools like **yacc/bison** build these tables for you, which is why most real parsers are bottom-up.
`],
  ]),
  assignments: [
    lab({
      key: "cc-lexer", course: C, week: 2, language: "python", title: "Ad-hoc Lexer for a Calculator Language", ...closed(5), marks: 10,
      instructions: "Write the scanner for a tiny calculator language.\n\n`tokenize(src)` returns a list of `(token_type, lexeme)` tuples, reading left to right:\n\n| Lexeme | Token type |\n| --- | --- |\n| one or more digits | `NUM` |\n| a letter or `_`, then letters, digits or `_` | `ID` (or `KEYWORD` if it is `let` or `print`) |\n| `+ - * / =` | `OP` |\n| `(` and `)` | `LPAREN`, `RPAREN` |\n| any other non-space character | `ERROR` |\n\nSpaces and tabs are skipped. Don't use the `re` module: write the character-by-character logic yourself.\n\nExample: `tokenize(\"let x = 42\")` returns `[('KEYWORD', 'let'), ('ID', 'x'), ('OP', '='), ('NUM', '42')]`.",
      starterCode: "KEYWORDS = {'let', 'print'}\n\n\ndef tokenize(src):\n    tokens = []\n    i = 0\n    # Look at src[i], decide which token starts here, and read the whole lexeme\n    return tokens\n\n\nprint(tokenize(\"let x = 42\"))\n",
      referenceSolution: "KEYWORDS = {'let', 'print'}\n\n\ndef tokenize(src):\n    tokens, i = [], 0\n    while i < len(src):\n        ch = src[i]\n        if ch in ' \\t':\n            i += 1\n        elif ch.isdigit():\n            j = i\n            while j < len(src) and src[j].isdigit():\n                j += 1\n            tokens.append(('NUM', src[i:j])); i = j\n        elif ch.isalpha() or ch == '_':\n            j = i\n            while j < len(src) and (src[j].isalnum() or src[j] == '_'):\n                j += 1\n            word = src[i:j]\n            tokens.append(('KEYWORD' if word in KEYWORDS else 'ID', word)); i = j\n        elif ch in '+-*/=':\n            tokens.append(('OP', ch)); i += 1\n        elif ch == '(':\n            tokens.append(('LPAREN', ch)); i += 1\n        elif ch == ')':\n            tokens.append(('RPAREN', ch)); i += 1\n        else:\n            tokens.append(('ERROR', ch)); i += 1\n    return tokens\n",
      tests: [
        { name: "Example from the brief", call: "tokenize(\"let x = 42\")" },
        { name: "No spaces", call: "tokenize(\"(a1+b_2)*10\")" },
        { name: "A keyword inside an identifier", call: "tokenize(\"printer = print\")" },
        { name: "An illegal character", call: "tokenize(\"x = 3 $ 4\")" },
        { name: "Empty input", call: "tokenize(\"   \")" },
      ],
    }),
    lab({
      key: "cc-dfa", course: C, week: 4, language: "python", title: "Simulate a DFA", ...closed(3), marks: 10,
      instructions: "A DFA is given as a dictionary:\n\n```python\nDIV3 = {\n    'start': 'r0',\n    'accept': {'r0'},\n    'delta': {('r0', '0'): 'r0', ('r0', '1'): 'r1', ('r1', '0'): 'r2',\n              ('r1', '1'): 'r0', ('r2', '0'): 'r1', ('r2', '1'): 'r2'},\n}\n```\n\nWrite:\n- `run_dfa(dfa, s)`: the state the DFA is in after reading all of `s`, or `None` if it gets stuck (no transition).\n- `accepts(dfa, s)`: `True` if `s` is accepted.\n\n`DIV3` accepts binary numbers divisible by 3, so `accepts(DIV3, '110')` is `True` (6) and `accepts(DIV3, '111')` is `False` (7).",
      starterCode: "DIV3 = {\n    'start': 'r0',\n    'accept': {'r0'},\n    'delta': {('r0', '0'): 'r0', ('r0', '1'): 'r1', ('r1', '0'): 'r2',\n              ('r1', '1'): 'r0', ('r2', '0'): 'r1', ('r2', '1'): 'r2'},\n}\n\n# Identifiers: a letter, then letters or digits (alphabet: a, b, 0, 1)\nIDENT = {\n    'start': 's',\n    'accept': {'id'},\n    'delta': {('s', 'a'): 'id', ('s', 'b'): 'id', ('id', 'a'): 'id', ('id', 'b'): 'id', ('id', '0'): 'id', ('id', '1'): 'id'},\n}\n\n\ndef run_dfa(dfa, s):\n    pass\n\n\ndef accepts(dfa, s):\n    pass\n\n\nprint(accepts(DIV3, '110'))\n",
      referenceSolution: "DIV3 = {\n    'start': 'r0',\n    'accept': {'r0'},\n    'delta': {('r0', '0'): 'r0', ('r0', '1'): 'r1', ('r1', '0'): 'r2',\n              ('r1', '1'): 'r0', ('r2', '0'): 'r1', ('r2', '1'): 'r2'},\n}\n\nIDENT = {\n    'start': 's',\n    'accept': {'id'},\n    'delta': {('s', 'a'): 'id', ('s', 'b'): 'id', ('id', 'a'): 'id', ('id', 'b'): 'id', ('id', '0'): 'id', ('id', '1'): 'id'},\n}\n\n\ndef run_dfa(dfa, s):\n    state = dfa['start']\n    for ch in s:\n        state = dfa['delta'].get((state, ch))\n        if state is None:\n            return None\n    return state\n\n\ndef accepts(dfa, s):\n    return run_dfa(dfa, s) in dfa['accept']\n",
      tests: [
        { name: "Six is divisible by 3", call: "accepts(DIV3, '110')" },
        { name: "Seven is not", call: "accepts(DIV3, '111')" },
        { name: "Where it stops", call: "run_dfa(DIV3, '1011')" },
        { name: "Empty string", call: "accepts(DIV3, '')" },
        { name: "Identifier can't start with a digit", call: "run_dfa(IDENT, '0ab')" },
        { name: "A valid identifier", call: "accepts(IDENT, 'ab01')" },
      ],
    }),
    written({
      key: "cc-ambiguity", course: C, week: 6, title: "Remove the Dangling-Else Ambiguity", ...closed(1), marks: 10,
      instructions: "Consider the grammar:\n\n```text\nStmt → if Expr then Stmt\n     | if Expr then Stmt else Stmt\n     | other\n```\n\nIn **150–250 words**:\n1. Show that `if a then if b then s1 else s2` has **two** parse trees (describe them in words or with indentation).\n2. Say which one programming languages choose, and why.\n3. Rewrite the grammar so it is unambiguous (hint: split `Stmt` into *matched* and *unmatched* statements), and explain in one sentence why it works.",
    }),
    quiz({
      key: "cc-quiz", course: C, week: 6, title: "Quiz: Scanning and Parsing Basics", ...open(3, 2), marks: 10,
      instructions: "A short timed quiz on weeks 1–6. One question at a time; you can't go back.",
      quiz: {
        draw: 6, timeLimitMinutes: 6, fullscreen: true,
        questions: [
          { kind: "mcq", prompt: "Which phase groups characters into tokens?", options: ["Parser", "Scanner", "Optimizer", "Code generator"], correct: 1 },
          { kind: "mcq", prompt: "Which of these can a finite automaton NOT recognize?", options: ["Identifiers", "Integers", "Balanced parentheses", "Binary multiples of 3"], correct: 2 },
          { kind: "mcq", prompt: "In subset construction, each DFA state represents:", options: ["One NFA state", "A set of NFA states", "A production", "A token"], correct: 1 },
          { kind: "mcq", prompt: "Why must left recursion be removed for a top-down parser?", options: ["It makes the grammar ambiguous", "The parser would recurse forever", "It is not context-free", "It breaks the scanner"], correct: 1 },
          { kind: "mcq", prompt: "A lex rule set matches `while` with both a keyword rule and an identifier rule. Which wins?", options: ["The identifier rule, always", "The longest match; on a tie, the rule listed first", "The shortest match", "Neither: it is an error"], correct: 1 },
          { kind: "mcq", prompt: "In the precedence grammar Expr → Expr + Term | Term, Term → Term * Factor | Factor, which operator binds tighter?", options: ["+", "*", "They are equal", "It depends on input"], correct: 1 },
          { kind: "short", prompt: "Rewrite A → Aα | β without left recursion: A → β A', A' → α A' | ? (The empty string symbol, or the word.)", accepted: ["ε", "epsilon", "eps", "e"] },
          { kind: "short", prompt: "How many tokens are in `x = y + 42`? (A number.)", accepted: ["5"] },
          { kind: "short", prompt: "What does the D in DFA stand for? (One word.)", accepted: ["deterministic"] },
        ],
      },
    }),
    lab({
      key: "cc-rd", course: C, week: 7, language: "python", title: "Recursive-Descent Parser for Expressions", ...open(5), marks: 10,
      instructions: "Write a **recursive-descent** parser for this grammar (left recursion already removed):\n\n```text\nExpr   → Term   { (+ | -) Term }\nTerm   → Factor { * Factor }\nFactor → ( Expr ) | number\n```\n\nNumbers are non-negative integers; spaces may appear anywhere. Write **one function per non-terminal**. Don't use `eval`: Ustaad's viva will ask you to walk through your functions.\n\n- `evaluate(text)`: the value of the expression, respecting precedence and parentheses. `evaluate(\"2 + 3 * 4\")` returns `14`.\n- `to_postfix(text)`: the expression in postfix, tokens separated by single spaces. `to_postfix(\"(2 + 3) * 4\")` returns `\"2 3 + 4 *\"`.\n- For a malformed expression (like `\"2 + * 3\"` or `\"(2 + 3\"`), both functions raise `SyntaxError`, and `is_valid(text)` returns `False`.",
      starterCode: "def evaluate(text):\n    pass\n\n\ndef to_postfix(text):\n    pass\n\n\ndef is_valid(text):\n    pass\n\n\nprint(evaluate(\"2 + 3 * 4\"))\n",
      referenceSolution: "class _Parser:\n    def __init__(self, text):\n        self.toks, i = [], 0\n        while i < len(text):\n            ch = text[i]\n            if ch.isspace():\n                i += 1\n            elif ch.isdigit():\n                j = i\n                while j < len(text) and text[j].isdigit():\n                    j += 1\n                self.toks.append(text[i:j]); i = j\n            elif ch in '+-*()':\n                self.toks.append(ch); i += 1\n            else:\n                raise SyntaxError('bad character ' + ch)\n        self.pos = 0\n\n    def peek(self):\n        return self.toks[self.pos] if self.pos < len(self.toks) else None\n\n    def take(self):\n        tok = self.peek()\n        self.pos += 1\n        return tok\n\n    def expr(self):\n        value, post = self.term()\n        while self.peek() in ('+', '-'):\n            op = self.take()\n            v2, p2 = self.term()\n            value = value + v2 if op == '+' else value - v2\n            post = post + p2 + [op]\n        return value, post\n\n    def term(self):\n        value, post = self.factor()\n        while self.peek() == '*':\n            self.take()\n            v2, p2 = self.factor()\n            value *= v2\n            post = post + p2 + ['*']\n        return value, post\n\n    def factor(self):\n        tok = self.take()\n        if tok == '(':\n            value, post = self.expr()\n            if self.take() != ')':\n                raise SyntaxError('missing )')\n            return value, post\n        if tok is not None and tok.isdigit():\n            return int(tok), [tok]\n        raise SyntaxError('expected a number or (')\n\n    def parse(self):\n        result = self.expr()\n        if self.peek() is not None:\n            raise SyntaxError('unexpected ' + self.peek())\n        return result\n\n\ndef evaluate(text):\n    return _Parser(text).parse()[0]\n\n\ndef to_postfix(text):\n    return ' '.join(_Parser(text).parse()[1])\n\n\ndef is_valid(text):\n    try:\n        _Parser(text).parse()\n        return True\n    except SyntaxError:\n        return False\n",
      tests: [
        { name: "Example from the brief", call: "evaluate(\"2 + 3 * 4\")" },
        { name: "Parentheses first", call: "evaluate(\"(2 + 3) * 4\")" },
        { name: "Left to right subtraction", call: "evaluate(\"10 - 4 - 3\")" },
        { name: "Postfix", call: "to_postfix(\"(2 + 3) * 4\")" },
        { name: "Postfix with precedence", call: "to_postfix(\"1 + 2 * 3 - 4\")" },
        { name: "Missing operand", call: "is_valid(\"2 + * 3\")" },
        { name: "Unclosed parenthesis", call: "is_valid(\"(2 + 3\")" },
      ],
    }),
    lab({
      key: "cc-first", course: C, week: 8, language: "python", title: "Compute FIRST Sets", ...draft(1), marks: 10,
      instructions: "A grammar is a dict mapping each non-terminal to a list of productions; each production is a list of symbols, and `[]` is ε. Any symbol that isn't a key is a terminal.\n\nWrite `first_sets(grammar)` returning a dict: non-terminal → sorted list of terminals in its FIRST set, with `'ε'` included when the non-terminal can derive the empty string.",
      starterCode: "EXPR = {\n    'E': [['T', \"E'\"]],\n    \"E'\": [['+', 'T', \"E'\"], []],\n    'T': [['F', \"T'\"]],\n    \"T'\": [['*', 'F', \"T'\"], []],\n    'F': [['(', 'E', ')'], ['id']],\n}\n\n\ndef first_sets(grammar):\n    pass\n",
      referenceSolution: "EXPR = {\n    'E': [['T', \"E'\"]],\n    \"E'\": [['+', 'T', \"E'\"], []],\n    'T': [['F', \"T'\"]],\n    \"T'\": [['*', 'F', \"T'\"], []],\n    'F': [['(', 'E', ')'], ['id']],\n}\n\n\ndef first_sets(grammar):\n    first = {a: set() for a in grammar}\n    changed = True\n    while changed:\n        changed = False\n        for a, prods in grammar.items():\n            for prod in prods:\n                add, nullable = set(), True\n                for sym in prod:\n                    if sym in grammar:\n                        add |= first[sym] - {'ε'}\n                        if 'ε' not in first[sym]:\n                            nullable = False\n                            break\n                    else:\n                        add.add(sym)\n                        nullable = False\n                        break\n                if nullable:\n                    add.add('ε')\n                if not add <= first[a]:\n                    first[a] |= add\n                    changed = True\n    return {a: sorted(s) for a, s in first.items()}\n",
      tests: [
        { name: "FIRST of E", call: "first_sets(EXPR)['E']" },
        { name: "A nullable non-terminal", call: "first_sets(EXPR)[\"E'\"]" },
        { name: "A chain through nullable symbols", call: "first_sets({'S': [['A', 'B', 'c']], 'A': [['a'], []], 'B': [['b'], []]})['S']" },
      ],
    }),
  ],
  announcements: [
    { course: C, title: "Recursive-descent lab is open", body: "One function per non-terminal, no eval. In the viva you'll be asked to trace your functions on a new expression, so make sure you can.", postedDaysAgo: 3 },
    { course: C, title: "Quiz this week", body: "Six questions in six minutes on scanning, automata and grammars.", postedDaysAgo: 2 },
    { course: C, title: "Office hours", body: "Thursday 11 AM–1 PM in the faculty block, room 214. Bring your FIRST/FOLLOW attempts.", postedDaysAgo: 12 },
  ],
};
