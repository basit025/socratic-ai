/** CS-352 Information Storage and Retrieval: written by the team from their own lecture slides (Manning, Raghavan & Schütze chapters 1–7). */
import { closed, draft, lab, open, quiz, weeks, type CoursePack } from "./kit.js";

const C = "cs352";

export const isr: CoursePack = {
  course: { key: C, teacher: "farhan", code: "CS-352", name: "Information Storage and Retrieval", section: "Section A", term: "Fall 2026", joinCode: "IRS8TV", students: [] },
  modules: weeks(C, [
    ["Boolean retrieval and the inverted index", `
### From grep to an index
Scanning every document for every query (like \`grep\`) is too slow for millions of pages and can't rank results. Instead we build an **inverted index**: for every term, the sorted list of document IDs that contain it (its **postings list**).

\`\`\`text
chai     → 1, 2, 4, 11
paratha  → 2, 4, 9
lahore   → 1, 4, 9, 12
\`\`\`

### Building it
1. Collect the documents. 2. **Tokenize** the text. 3. **Normalize** tokens (lowercase, strip punctuation). 4. Sort (term, docID) pairs and group them into postings.

### Boolean queries
**chai AND paratha** = intersect the two postings lists → \`2, 4\`. Because both lists are sorted, a single merge pass walks them together in **O(x + y)** time.

> Process AND queries in order of increasing postings length: start with the rarest term so the intermediate result stays small.
`],
    ["Terms, normalization and postings", `
### Tokens, types and terms
A **token** is an instance of a word in text; a **type** is the distinct string; a **term** is a normalized type that goes into the dictionary.

### Normalization choices
- **Case folding**: \`Lahore\` → \`lahore\` (but careful with acronyms like *PIA* vs *pia*).
- **Stop words**: dropping *the, of, ka, ki* saves space but hurts phrase queries like *"to be or not to be"*.
- **Stemming** chops suffixes (Porter: *running* → *run*); **lemmatization** uses a dictionary (*better* → *good*).
- Roman Urdu has no standard spelling (*kitab / kitaab*), which is why tolerant retrieval matters here.

### Faster postings and phrases
- **Skip pointers** let an intersection jump ahead in long lists.
- **Biword indexes** and **positional indexes** (store each position of a term in each document) answer phrase queries like *"Faisal Mosque"*.
`],
    ["Dictionaries and tolerant retrieval", `
### Finding terms fast
The dictionary can be a **hash table** (fast exact lookup, no prefix search) or a **B-tree** (supports prefix queries like \`isla*\`).

### Wildcard queries
- **Permuterm index**: store every rotation of \`term$\`; a query \`is*bad\` becomes a prefix lookup for \`bad$is*\`.
- **k-gram index**: map each k-gram (e.g. \`$is\`, \`isl\`, \`sla\`) to the terms containing it, then filter.

### Spelling correction
- **Edit (Levenshtein) distance**: the minimum number of insertions, deletions and substitutions to turn one string into another. \`kitab\` → \`kitaab\` is 1.
- Use k-gram overlap (Jaccard) to shortlist candidates, then rank them by edit distance.
- **Soundex** maps words to sound codes for names spelled many ways (*Mohammad, Muhammad, Mohd*).
`],
    ["Index construction", `
### When the index doesn't fit in memory
- **BSBI (blocked sort-based indexing)**: split the collection into blocks, build and sort (termID, docID) pairs for each block in memory, write each block to disk, then **merge** the sorted blocks.
- **SPIMI (single-pass in-memory indexing)**: write postings directly into per-term lists for a block with no global term IDs, then merge blocks. Faster and uses less memory.

### At web scale
**Distributed indexing** with MapReduce: *parsers* (map) emit (term, docID) pairs into term partitions (a–f, g–p, q–z); *inverters* (reduce) collect each partition's postings.

### Dynamic collections
New documents go into a small **auxiliary index** that is searched alongside the main one and periodically merged in.
`],
    ["Index compression", `
### How big is the vocabulary?
- **Heaps' law**: vocabulary M = k·T^b (typically 30 ≤ k ≤ 100, b ≈ 0.5). The dictionary keeps growing as documents arrive.
- **Zipf's law**: the i-th most frequent term has frequency proportional to 1/i. A few terms are everywhere; most are rare.

### Compressing postings
Store **gaps** between doc IDs instead of the IDs: \`283042, 283043, 283044\` → \`283042, 1, 1\`. Gaps for common terms are tiny.

### Variable byte (VB) encoding
Split a number into 7-bit chunks. Every byte uses its low 7 bits for data; the **high bit is 1 only on the last byte**.

| Number | VB bytes (decimal) |
| --- | --- |
| 5 | 133 |
| 130 | 1, 130 |
| 214577 | 13, 12, 177 |

**γ (gamma) codes** go further: a unary length followed by the offset, at bit level.
`],
    ["Term weighting and tf-idf", `
### Why ranking?
Boolean retrieval returns too many or too few results. **Ranked retrieval** scores each document for the query.

### Term frequency and document frequency
- **tf(t, d)**: how often t occurs in d. Relevance doesn't grow linearly, so use **1 + log₁₀ tf** (0 if tf = 0).
- **df(t)**: how many documents contain t. Rare terms are more informative.
- **idf(t) = log₁₀(N / df)**.

### tf-idf weight
w(t, d) = (1 + log₁₀ tf) × log₁₀(N / df)

> Example: N = 1,000,000 news articles. "budget" appears in 1,000 (idf = 3); an article mentioning it 10 times gets weight (1 + 1) × 3 = 6.
`],
    ["The vector space model", `
### Documents and queries as vectors
Each document is a vector of tf-idf weights, one dimension per term. A query is a short document.

### Cosine similarity
cos(q, d) = (q · d) / (|q| · |d|)

Dividing by the lengths (**length normalization**) stops long documents from winning just by being long. The angle, not the distance, measures similarity.

\`\`\`text
q = (1, 1, 0)    d1 = (2, 2, 0)    d2 = (0, 1, 1)
cos(q, d1) = 1.0       cos(q, d2) = 0.5
\`\`\`

### SMART notation
Weighting schemes are written ddd.qqq, e.g. **lnc.ltc**: documents use log tf, no idf, cosine normalization; queries use log tf, idf, cosine normalization.
`],
    ["Efficient scoring and ranking", `
### Don't score everything
- **Index elimination**: only consider documents containing high-idf query terms, or several of the query terms.
- **Champion lists**: precompute, for each term, the r documents with the highest weight for it.
- **Static quality scores** (like PageRank) let a good document rank well even when its tf-idf is modest.
- **Tiered indexes**: search the top tier first; drop to lower tiers only if too few results come back.

### Putting it together
A real search engine combines tf-idf (or BM25), phrase and proximity matches, link-based quality and freshness, then returns the top k with a heap instead of sorting every score.
`],
  ]),
  assignments: [
    lab({
      key: "ir-index", course: C, week: 1, language: "python", title: "Inverted Index of News Headlines", ...closed(4), marks: 10,
      instructions: "A small Urdu newspaper (headlines written in Roman Urdu and English) wants a search box.\n\nWrite `build_index(docs)`, where `docs` is a list of headlines and a headline's doc ID is its position in the list (starting at 0). Return a dictionary mapping each term to the **sorted list of doc IDs** that contain it.\n\n- Lowercase everything.\n- A term is a run of letters or digits: use `re.findall(r\"[a-z0-9]+\", text.lower())`.\n- A doc ID appears once per term, even if the term repeats in that headline.\n\nThen write `search_and(index, a, b)` returning the doc IDs containing **both** terms (an empty list if either is missing).",
      starterCode: "import re\n\nHEADLINES = [\n    'Lahore mein shadeed barish, schools band',\n    'Karachi traffic: barish ke baad sarkein band',\n    'PSL final Lahore mein hoga',\n    'Islamabad weather: aaj barish ka imkaan',\n]\n\n\ndef build_index(docs):\n    pass\n\n\ndef search_and(index, a, b):\n    pass\n\n\nprint(build_index(HEADLINES)['barish'])\n",
      referenceSolution: "import re\n\nHEADLINES = [\n    'Lahore mein shadeed barish, schools band',\n    'Karachi traffic: barish ke baad sarkein band',\n    'PSL final Lahore mein hoga',\n    'Islamabad weather: aaj barish ka imkaan',\n]\n\n\ndef build_index(docs):\n    index = {}\n    for doc_id, text in enumerate(docs):\n        for term in set(re.findall(r'[a-z0-9]+', text.lower())):\n            index.setdefault(term, []).append(doc_id)\n    return {t: sorted(ids) for t, ids in index.items()}\n\n\ndef search_and(index, a, b):\n    p1, p2 = index.get(a, []), index.get(b, [])\n    i = j = 0\n    out = []\n    while i < len(p1) and j < len(p2):\n        if p1[i] == p2[j]:\n            out.append(p1[i]); i += 1; j += 1\n        elif p1[i] < p2[j]:\n            i += 1\n        else:\n            j += 1\n    return out\n",
      tests: [
        { name: "Postings for barish", call: "build_index(HEADLINES)['barish']" },
        { name: "Case folding", call: "build_index(HEADLINES)['lahore']" },
        { name: "Number of distinct terms", call: "len(build_index(HEADLINES))" },
        { name: "AND query", call: "search_and(build_index(HEADLINES), 'barish', 'band')" },
        { name: "A term that isn't there", call: "search_and(build_index(HEADLINES), 'barish', 'cricket')" },
      ],
    }),
    lab({
      key: "ir-vb", course: C, week: 5, language: "python", title: "Gap and Variable Byte Encoding", ...closed(1), marks: 10,
      instructions: "Postings lists are stored compressed on disk.\n\nWrite:\n- `gaps(postings)`: turn a sorted list of doc IDs into the first ID followed by the gaps between neighbours. `gaps([824, 829, 215406])` returns `[824, 5, 214577]`.\n- `vb_encode(n)`: the variable byte encoding of one number as a list of byte values (0–255). Use 7 data bits per byte; set the high bit (add 128) **only on the last byte**. `vb_encode(130)` returns `[1, 130]`.\n- `vb_encode_list(postings)`: encode the gaps of a postings list, one flat list of bytes.\n- `vb_decode(bytes_list)`: turn a flat byte list back into the numbers it encodes.",
      starterCode: "def gaps(postings):\n    pass\n\n\ndef vb_encode(n):\n    pass\n\n\ndef vb_encode_list(postings):\n    pass\n\n\ndef vb_decode(bytes_list):\n    pass\n\n\nprint(vb_encode(130))\n",
      referenceSolution: "def gaps(postings):\n    return [postings[0]] + [b - a for a, b in zip(postings, postings[1:])] if postings else []\n\n\ndef vb_encode(n):\n    out = []\n    while True:\n        out.insert(0, n % 128)\n        if n < 128:\n            break\n        n //= 128\n    out[-1] += 128\n    return out\n\n\ndef vb_encode_list(postings):\n    out = []\n    for g in gaps(postings):\n        out.extend(vb_encode(g))\n    return out\n\n\ndef vb_decode(bytes_list):\n    numbers, n = [], 0\n    for b in bytes_list:\n        if b < 128:\n            n = 128 * n + b\n        else:\n            numbers.append(128 * n + b - 128)\n            n = 0\n    return numbers\n",
      tests: [
        { name: "Gaps from the brief", call: "gaps([824, 829, 215406])" },
        { name: "A small number", call: "vb_encode(5)" },
        { name: "Two bytes", call: "vb_encode(130)" },
        { name: "Three bytes", call: "vb_encode(214577)" },
        { name: "A whole postings list", call: "vb_encode_list([824, 829, 215406])" },
        { name: "Decode it back", call: "vb_decode([6, 184, 133, 13, 12, 177])" },
      ],
    }),
    quiz({
      key: "ir-quiz", course: C, week: 5, title: "Quiz: Indexing and Tolerant Retrieval", ...open(3, 2), marks: 10,
      instructions: "A short timed quiz on weeks 1–5: the inverted index, normalization, tolerant retrieval and compression. One question at a time; you can't go back.",
      quiz: {
        draw: 6, timeLimitMinutes: 6, fullscreen: true,
        questions: [
          { kind: "mcq", prompt: "Postings for A: 2, 4, 8. Postings for B: 1, 2, 3, 8. What is A AND B?", options: ["2, 8", "2, 4, 8", "1, 2, 3, 4, 8", "8"], correct: 0 },
          { kind: "mcq", prompt: "Why process an AND query starting with the shortest postings list?", options: ["It is required for correctness", "It keeps intermediate results small", "Short lists are stored first on disk", "It enables phrase search"], correct: 1 },
          { kind: "mcq", prompt: "Which index answers the phrase query \"Faisal Mosque\" exactly?", options: ["A plain inverted index", "A positional index", "A permuterm index", "A champion list"], correct: 1 },
          { kind: "mcq", prompt: "The wildcard query `isl*bad` in a permuterm index is looked up as:", options: ["isl*bad$", "bad$isl*", "$islbad*", "*bad$isl"], correct: 1 },
          { kind: "mcq", prompt: "Heaps' law describes:", options: ["How term frequency falls with rank", "How vocabulary size grows with collection size", "How long postings lists are", "How fast disks are"], correct: 1 },
          { kind: "mcq", prompt: "SPIMI improves on BSBI mainly by:", options: ["Using global term IDs", "Not needing a global term-ID mapping and writing postings directly", "Sorting on disk", "Compressing the dictionary"], correct: 1 },
          { kind: "short", prompt: "What is the edit distance between `kitab` and `kitaab`? (A number.)", accepted: ["1"] },
          { kind: "short", prompt: "In variable byte encoding, how many bytes does the number 130 take? (A number.)", accepted: ["2"] },
          { kind: "short", prompt: "Doc IDs 100, 103, 110 are stored as gaps. What is the third stored number? (A number.)", accepted: ["7"] },
        ],
      },
    }),
    lab({
      key: "ir-cosine", course: C, week: 7, language: "python", title: "Rank Documents with tf-idf and Cosine", ...open(6, 1), marks: 10,
      instructions: "Build the scoring core of a search engine for a university notice board.\n\nWrite:\n- `tf_idf(tf, df, n)`: the weight `(1 + log10(tf)) * log10(n / df)`, or `0.0` when `tf` is 0. Round to 3 decimals.\n- `cosine(u, v)`: the cosine similarity of two equal-length vectors, rounded to 3 decimals (`0.0` if either is all zeros).\n- `rank(query, docs)`: `query` is a list of words and `docs` a list of word lists. Build **raw term-count** vectors over the vocabulary of query and document words, and return the doc indexes sorted by cosine similarity with the query, highest first (ties: lower index first).\n\nExample: `tf_idf(10, 1000, 1000000)` returns `6.0`.",
      starterCode: "import math\n\n\ndef tf_idf(tf, df, n):\n    pass\n\n\ndef cosine(u, v):\n    pass\n\n\ndef rank(query, docs):\n    pass\n\n\nprint(tf_idf(10, 1000, 1000000))\n",
      referenceSolution: "import math\n\n\ndef tf_idf(tf, df, n):\n    if tf == 0:\n        return 0.0\n    return round((1 + math.log10(tf)) * math.log10(n / df), 3)\n\n\ndef cosine(u, v):\n    dot = sum(a * b for a, b in zip(u, v))\n    nu = math.sqrt(sum(a * a for a in u))\n    nv = math.sqrt(sum(b * b for b in v))\n    if nu == 0 or nv == 0:\n        return 0.0\n    return round(dot / (nu * nv), 3)\n\n\ndef rank(query, docs):\n    vocab = sorted(set(query) | {w for d in docs for w in d})\n    q = [query.count(w) for w in vocab]\n    scores = [cosine(q, [d.count(w) for w in vocab]) for d in docs]\n    return sorted(range(len(docs)), key=lambda i: (-scores[i], i))\n",
      tests: [
        { name: "Example from the brief", call: "tf_idf(10, 1000, 1000000)" },
        { name: "Term not in the document", call: "tf_idf(0, 50, 1000)" },
        { name: "Same direction", call: "cosine([1, 1, 0], [2, 2, 0])" },
        { name: "Partly similar", call: "cosine([1, 1, 0], [0, 1, 1])" },
        { name: "Ranking notices", call: "rank(['exam', 'schedule'], [['library', 'timings'], ['exam', 'schedule', 'midterm', 'exam'], ['sports', 'schedule']])" },
      ],
    }),
    lab({
      key: "ir-champion", course: C, week: 8, language: "python", title: "Champion Lists", ...draft(1), marks: 10,
      instructions: "Write `champion_list(weights, r)`: `weights` maps doc IDs to a term's weight in each document. Return the IDs of the `r` documents with the highest weight, highest first (ties: smaller doc ID first).",
      starterCode: "def champion_list(weights, r):\n    pass\n",
      referenceSolution: "def champion_list(weights, r):\n    return [d for d, _ in sorted(weights.items(), key=lambda kv: (-kv[1], kv[0]))[:r]]\n",
      tests: [
        { name: "Top two", call: "champion_list({1: 0.2, 2: 0.9, 3: 0.5}, 2)" },
        { name: "Ties", call: "champion_list({7: 1.0, 3: 1.0, 5: 0.1}, 2)" },
        { name: "r larger than the list", call: "champion_list({1: 0.3}, 5)" },
      ],
    }),
  ],
  announcements: [
    { course: C, title: "Cosine ranking lab is open", body: "Build tf-idf weights and cosine ranking for a notice board search. Check your tf-idf by hand for the example first: the viva will ask you why long documents don't automatically win.", postedDaysAgo: 1 },
    { course: C, title: "Quiz this week", body: "Six questions in six minutes on chapters 1–5. Know your postings intersection, wildcard lookups and variable byte encoding.", postedDaysAgo: 2 },
    { course: C, title: "Reading for week 6", body: "Read Manning, Raghavan & Schütze chapter 6 (6.2–6.3) before Tuesday's lecture on tf-idf.", postedDaysAgo: 6 },
  ],
};
