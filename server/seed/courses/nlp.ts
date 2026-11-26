/** CS-461 Natural Language Processing: written by the team from their own lecture slides (Jurafsky & Martin). */
import { closed, draft, lab, open, quiz, weeks, written, type CoursePack } from "./kit.js";

const C = "cs461";

export const nlp: CoursePack = {
  course: { key: C, teacher: "farhan", code: "CS-461", name: "Natural Language Processing", section: "Section A", term: "Fall 2026", joinCode: "NLP3WX", students: [] },
  modules: weeks(C, [
    ["Why language is hard for computers", `
### NLP is everywhere
Search, autocorrect, translation, voice assistants, spam filters and chatbots like ChatGPT and DeepSeek all process human language.

### The core difficulty: ambiguity
- *"I saw the man with the telescope"*: who has the telescope?
- Roman Urdu adds more: no standard spelling (*acha / achha / achaa*), code-switching (*"meeting kal 3 baje hai, don't be late"*), and words that mean different things in Urdu and English (*"bus"*).

> Most of this course is about choosing the *most probable* interpretation using data, because rules alone can't cover real language.
`],
    ["Words, tokens and regular expressions", `
### How many words?
*"They lay back on the San Francisco grass and looked at the stars"* has 15 **tokens** (instances) and 13 **types** (distinct words) if *the* repeats. Vocabulary keeps growing with corpus size (Heaps' law: |V| = k·N^β).

### Regular expressions
| Pattern | Matches |
| --- | --- |
| \`[A-Z]\` | one capital letter |
| \`colou?r\` | color, colour |
| \`ba+d\` | bad, baad, baaad |
| \`\\b[0-9]{4}\\b\` | a 4-digit year |
| \`^[Pp]akistan\` | Pakistan at the start of a line |

### Normalization and subwords
Case folding, lemmatization (*am, are, is → be*) and stemming reduce variation. Modern models split rare words into **subwords** with Byte-Pair Encoding (BPE): the most frequent adjacent pair of symbols is merged repeatedly, so *"unhappiness"* might become \`un + happi + ness\`.
`],
    ["Minimum edit distance", `
### How similar are two strings?
The **minimum edit distance** is the cheapest sequence of insertions, deletions and substitutions turning one string into another. Used for spelling correction, comparing translations, and aligning DNA.

### Levenshtein costs (as in the lectures)
Insertion = 1, deletion = 1, **substitution = 2** (a substitution is a deletion plus an insertion). Matching characters cost 0.

### Dynamic programming
D[i][j] = distance between the first i characters of X and the first j of Y.

\`\`\`text
D[i][0] = i        D[0][j] = j
D[i][j] = min( D[i-1][j] + 1,                     # delete
               D[i][j-1] + 1,                     # insert
               D[i-1][j-1] + (0 if same else 2) ) # substitute
\`\`\`

> *intention → execution* has distance **8** with these costs. Keeping a backtrace of which cell each value came from gives the alignment.
`],
    ["N-gram language models", `
### Predicting the next word
A language model gives a probability to a sentence. By the **chain rule**, P(w₁…wₙ) = Π P(wᵢ | w₁…wᵢ₋₁), but long histories are never seen. The **Markov assumption** keeps only the last word (bigram) or two (trigram).

### Estimating bigrams (MLE)
P(wᵢ | wᵢ₋₁) = count(wᵢ₋₁ wᵢ) / count(wᵢ₋₁)

### Zeros and smoothing
An unseen bigram gets probability 0 and kills the whole sentence. **Add-one (Laplace)** smoothing:

P(wᵢ | wᵢ₋₁) = (count(wᵢ₋₁ wᵢ) + 1) / (count(wᵢ₋₁) + V)

where V is the vocabulary size.

### Evaluation
**Perplexity** is the inverse probability of the test set, normalized by length. Lower perplexity = better model.
`],
    ["Naive Bayes text classification", `
### The task
Spam or not? Positive or negative review? Which author wrote this?

### Bag of words + Bayes' rule
Ignore word order; keep counts. Choose the class c maximizing

P(c) × Π P(wᵢ | c)

- **Prior** P(c) = documents in c / all documents.
- **Likelihood** with add-one smoothing: P(w | c) = (count(w, c) + 1) / (total words in c + |V|).
- Work in **log space** to avoid underflow: add log-probabilities instead of multiplying.

### Worked example
Training reviews: *"zabardast acha"* (+), *"bekaar bura"* (−), *"acha khana"* (+). Test: *"acha"*. The positive class wins: *acha* appears twice in positive reviews, never in negative ones.

> Naive Bayes is fast, needs little data and is a strong baseline, but its independence assumption is wrong in theory.
`],
    ["Logistic regression", `
### A discriminative classifier
Instead of modelling how each class generates words, learn weights w for features x directly:

z = w · x + b,   P(y = 1 | x) = σ(z) = 1 / (1 + e^(−z))

The **sigmoid** squashes any number into (0, 1). Predict 1 if σ(z) > 0.5.

### Learning
Minimize **cross-entropy loss** with **gradient descent**: move each weight a small step (the learning rate) against its gradient. **Regularization** (L2) keeps weights small to avoid overfitting. **Softmax** extends this to many classes.
`],
    ["Vector semantics and embeddings", `
### Meaning from context
*"You shall know a word by the company it keeps."* Words used in similar contexts have similar meanings.

### Sparse vs. dense vectors
- **tf-idf / co-occurrence vectors**: long, sparse, one dimension per vocabulary word.
- **Embeddings** (word2vec skip-gram, GloVe): short (50–300) dense vectors learned by predicting context words.

### Cosine similarity
cos(v, w) = v·w / (|v||w|). Embeddings capture analogies: *king − man + woman ≈ queen*, *Lahore − Punjab + Sindh ≈ Karachi*. They also capture society's biases, which must be measured and mitigated.
`],
    ["Neural networks, RNNs and LSTMs", `
### Neural units
A unit computes y = σ(w·x + b). One unit can do AND or OR but not **XOR**; a hidden layer fixes that. Activation functions: sigmoid, tanh, **ReLU**.

### Neural language models
Feed the embeddings of the previous words into a network that outputs a softmax over the vocabulary. Unlike n-grams, similar words share statistical strength.

### Recurrent networks
An **RNN** keeps a hidden state hₜ = g(U·hₜ₋₁ + W·xₜ), so it can, in principle, remember the whole history. Training unrolls it in time; **vanishing gradients** make long dependencies hard. **LSTMs** add gates (forget, input, output) that decide what to keep.
`],
    ["Attention and transformers", `
### Why attention?
RNNs process words one at a time and forget. **Attention** lets every word look directly at every other word and decide which ones matter.

### Self-attention in one line
Each word has a **query**, a **key** and a **value** vector. The output for word i is a weighted sum of all values, with weights softmax(qᵢ·kⱼ / √d).

> In *"The animal didn't cross the road because **it** was tired"*, attention lets *it* weigh *animal* heavily.

### The transformer block
Multi-head self-attention → add & layer-norm → feed-forward → add & layer-norm, stacked many times, with **positional encodings** because attention itself ignores order. Decoder blocks mask future words.
`],
    ["BERT, LLMs and chatbots", `
### Three families
- **Encoders** (BERT): bidirectional, trained with **masked language modelling** (hide 15% of tokens, predict them) and next-sentence prediction. Great for classification and tagging.
- **Decoders** (GPT, LLaMA): predict the next token left to right; they *generate*.
- **Encoder-decoders** (T5): translation and summarization.

### Large language models
Pretrain on huge text, then instruction-tune and align with human feedback. They can **hallucinate**: fluent text is not necessarily true text.

### Dialogue systems
Chatbots (open-domain, like XiaoIce) vs. **task-based agents** that fill a frame of slots (*destination: Islamabad, date: Friday*) to complete a goal.
`],
  ]),
  assignments: [
    lab({
      key: "nlp-tokens", course: C, week: 2, language: "python", title: "Tokens and Types in Roman Urdu Tweets", ...closed(3), marks: 10,
      instructions: "Before training anything, a researcher wants basic counts for a Roman Urdu tweet corpus.\n\nWrite:\n- `tokenize(text)`: lowercase the text and return every match of `r\"[a-z0-9']+\"` (letters, digits and apostrophes).\n- `tokens_and_types(text)`: return `(number_of_tokens, number_of_types)`.\n- `top_words(text, k)`: the `k` most frequent tokens as `(word, count)` pairs, most frequent first; ties in alphabetical order.\n\nExample: `tokens_and_types(\"Bohat acha match tha, bohat acha!\")` returns `(6, 4)`.",
      starterCode: "import re\n\n\ndef tokenize(text):\n    pass\n\n\ndef tokens_and_types(text):\n    pass\n\n\ndef top_words(text, k):\n    pass\n\n\nprint(tokens_and_types(\"Bohat acha match tha, bohat acha!\"))\n",
      referenceSolution: "import re\n\n\ndef tokenize(text):\n    return re.findall(r\"[a-z0-9']+\", text.lower())\n\n\ndef tokens_and_types(text):\n    toks = tokenize(text)\n    return (len(toks), len(set(toks)))\n\n\ndef top_words(text, k):\n    counts = {}\n    for t in tokenize(text):\n        counts[t] = counts.get(t, 0) + 1\n    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:k]\n",
      tests: [
        { name: "Example from the brief", call: "tokens_and_types(\"Bohat acha match tha, bohat acha!\")" },
        { name: "Apostrophes stay in words", call: "tokenize(\"Babar's century, can't believe it\")" },
        { name: "Empty tweet", call: "tokens_and_types(\"!!!\")" },
        { name: "Most frequent words", call: "top_words(\"yaar exam kal hai yaar, kal exam nahi parhai\", 2)" },
      ],
    }),
    lab({
      key: "nlp-edit", course: C, week: 3, language: "python", title: "Minimum Edit Distance for Roman Urdu Spellings", ...closed(2), marks: 10,
      instructions: "Roman Urdu spellings vary (*kitab / kitaab*, *acha / achha*). A spell checker needs edit distance.\n\nWrite `edit_distance(source, target)` using dynamic programming with the lecture's costs: **insertion 1, deletion 1, substitution 2** (0 when the characters match).\n\nExample: `edit_distance(\"intention\", \"execution\")` returns `8`.\n\nThen write `closest(word, dictionary)`: the dictionary word with the smallest edit distance to `word` (ties: the one that comes first in the dictionary).",
      starterCode: "def edit_distance(source, target):\n    pass\n\n\ndef closest(word, dictionary):\n    pass\n\n\nprint(edit_distance(\"intention\", \"execution\"))\n",
      referenceSolution: "def edit_distance(source, target):\n    n, m = len(source), len(target)\n    d = [[0] * (m + 1) for _ in range(n + 1)]\n    for i in range(1, n + 1):\n        d[i][0] = i\n    for j in range(1, m + 1):\n        d[0][j] = j\n    for i in range(1, n + 1):\n        for j in range(1, m + 1):\n            sub = 0 if source[i - 1] == target[j - 1] else 2\n            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub)\n    return d[n][m]\n\n\ndef closest(word, dictionary):\n    return min(dictionary, key=lambda w: edit_distance(word, w))\n",
      tests: [
        { name: "Example from the brief", call: "edit_distance(\"intention\", \"execution\")" },
        { name: "One extra letter", call: "edit_distance(\"kitab\", \"kitaab\")" },
        { name: "From nothing", call: "edit_distance(\"\", \"chai\")" },
        { name: "A substitution costs 2", call: "edit_distance(\"cat\", \"cut\")" },
        { name: "Spell checker", call: "closest(\"achaa\", [\"acha\", \"bacha\", \"accha\"])" },
      ],
    }),
    lab({
      key: "nlp-bigram", course: C, week: 4, language: "python", title: "Bigram Probabilities with Add-One Smoothing", ...closed(1), marks: 10,
      instructions: "Train a tiny bigram language model on sentences from a chatbot's logs.\n\nEach sentence is a string; split on spaces, lowercase, and add `<s>` at the start and `</s>` at the end.\n\nWrite:\n- `bigram_prob(sentences, w1, w2)`: add-one smoothed P(w2 | w1) = (count(w1 w2) + 1) / (count(w1) + V), where V is the number of distinct tokens including `<s>` and `</s>`. Round to 4 decimals.\n- `sentence_prob(sentences, sentence)`: the product of smoothed bigram probabilities across the new sentence (with `<s>` and `</s>`), rounded to 6 decimals.\n\nExample corpus: `[\"main ghar ja raha hoon\", \"main school ja raha hoon\", \"tum ghar ja rahe ho\"]`.",
      starterCode: "CORPUS = [\"main ghar ja raha hoon\", \"main school ja raha hoon\", \"tum ghar ja rahe ho\"]\n\n\ndef bigram_prob(sentences, w1, w2):\n    pass\n\n\ndef sentence_prob(sentences, sentence):\n    pass\n\n\nprint(bigram_prob(CORPUS, \"ja\", \"raha\"))\n",
      referenceSolution: "CORPUS = [\"main ghar ja raha hoon\", \"main school ja raha hoon\", \"tum ghar ja rahe ho\"]\n\n\ndef _counts(sentences):\n    uni, bi = {}, {}\n    for s in sentences:\n        toks = ['<s>'] + s.lower().split() + ['</s>']\n        for t in toks:\n            uni[t] = uni.get(t, 0) + 1\n        for a, b in zip(toks, toks[1:]):\n            bi[(a, b)] = bi.get((a, b), 0) + 1\n    return uni, bi\n\n\ndef _p(uni, bi, w1, w2):\n    return (bi.get((w1, w2), 0) + 1) / (uni.get(w1, 0) + len(uni))\n\n\ndef bigram_prob(sentences, w1, w2):\n    uni, bi = _counts(sentences)\n    return round(_p(uni, bi, w1, w2), 4)\n\n\ndef sentence_prob(sentences, sentence):\n    uni, bi = _counts(sentences)\n    toks = ['<s>'] + sentence.lower().split() + ['</s>']\n    p = 1.0\n    for a, b in zip(toks, toks[1:]):\n        p *= _p(uni, bi, a, b)\n    return round(p, 6)\n",
      tests: [
        { name: "A seen bigram", call: "bigram_prob(CORPUS, \"ja\", \"raha\")" },
        { name: "An unseen bigram is not zero", call: "bigram_prob(CORPUS, \"tum\", \"school\")" },
        { name: "Sentence start", call: "bigram_prob(CORPUS, \"<s>\", \"main\")" },
        { name: "A whole sentence", call: "sentence_prob(CORPUS, \"main ghar ja raha hoon\")" },
        { name: "A less likely sentence", call: "sentence_prob(CORPUS, \"tum school ja rahe ho\")" },
      ],
    }),
    lab({
      key: "nlp-nb", course: C, week: 5, language: "python", title: "Naive Bayes: Is This Review Positive?", ...open(4), marks: 10,
      instructions: "A food delivery startup wants to sort Roman Urdu reviews.\n\n`train` is a list of `(text, label)` pairs. Write `nb_classify(train, text)` that returns the most likely label using multinomial Naive Bayes:\n\n- Tokens: `text.lower().split()`.\n- Prior: P(c) = documents with label c / all documents.\n- Likelihood with add-one smoothing: P(w | c) = (count(w, c) + 1) / (total tokens in c + |V|), where V is the training vocabulary.\n- Ignore test words that never appeared in training.\n- Compare **log** probabilities. On a tie, return the label that comes first alphabetically.\n\nAlso write `nb_scores(train, text)`: a dict of label → log probability, each rounded to 3 decimals.",
      starterCode: "import math\n\nREVIEWS = [\n    (\"zabardast khana bohat acha\", \"pos\"),\n    (\"bekaar service thanda khana\", \"neg\"),\n    (\"acha taste jaldi delivery\", \"pos\"),\n    (\"bura experience late delivery\", \"neg\"),\n]\n\n\ndef nb_scores(train, text):\n    pass\n\n\ndef nb_classify(train, text):\n    pass\n\n\nprint(nb_classify(REVIEWS, \"khana acha tha\"))\n",
      referenceSolution: "import math\n\nREVIEWS = [\n    (\"zabardast khana bohat acha\", \"pos\"),\n    (\"bekaar service thanda khana\", \"neg\"),\n    (\"acha taste jaldi delivery\", \"pos\"),\n    (\"bura experience late delivery\", \"neg\"),\n]\n\n\ndef nb_scores(train, text):\n    labels = sorted({c for _, c in train})\n    vocab = {w for t, _ in train for w in t.lower().split()}\n    scores = {}\n    for c in labels:\n        docs = [t for t, l in train if l == c]\n        words = [w for t in docs for w in t.lower().split()]\n        s = math.log(len(docs) / len(train))\n        for w in text.lower().split():\n            if w in vocab:\n                s += math.log((words.count(w) + 1) / (len(words) + len(vocab)))\n        scores[c] = round(s, 3)\n    return scores\n\n\ndef nb_classify(train, text):\n    scores = nb_scores(train, text)\n    return max(sorted(scores), key=lambda c: scores[c])\n",
      tests: [
        { name: "Example from the brief", call: "nb_classify(REVIEWS, \"khana acha tha\")" },
        { name: "A negative review", call: "nb_classify(REVIEWS, \"late aur thanda\")" },
        { name: "Unknown words only: the prior decides", call: "nb_classify(REVIEWS, \"theek theek\")" },
        { name: "Log scores", call: "nb_scores(REVIEWS, \"jaldi delivery\")" },
      ],
    }),
    quiz({
      key: "nlp-quiz", course: C, week: 5, title: "Quiz: Text Processing to Naive Bayes", ...open(3, 1), marks: 10,
      instructions: "A short timed quiz on weeks 2–5. One question at a time; you can't go back.",
      quiz: {
        draw: 6, timeLimitMinutes: 6, fullscreen: true,
        questions: [
          { kind: "mcq", prompt: "\"acha acha bohat acha\" has how many tokens and types?", options: ["4 tokens, 2 types", "4 tokens, 4 types", "2 tokens, 4 types", "3 tokens, 2 types"], correct: 0 },
          { kind: "mcq", prompt: "Which regex matches both `color` and `colour`?", options: ["colo+r", "colou?r", "colo[u]+r", "col*r"], correct: 1 },
          { kind: "mcq", prompt: "Why use add-one smoothing in a bigram model?", options: ["To make training faster", "So unseen bigrams don't get probability 0", "To remove stop words", "To increase perplexity"], correct: 1 },
          { kind: "mcq", prompt: "A better language model has:", options: ["Higher perplexity", "Lower perplexity", "More parameters, always", "No unknown words"], correct: 1 },
          { kind: "mcq", prompt: "Naive Bayes is called naive because it assumes:", options: ["All classes are equally likely", "Words are independent given the class", "Word order matters", "The vocabulary is small"], correct: 1 },
          { kind: "mcq", prompt: "Why compute Naive Bayes in log space?", options: ["Logs are more accurate", "To avoid underflow from multiplying many small numbers", "Because priors are negative", "To smooth the counts"], correct: 1 },
          { kind: "short", prompt: "With insertion 1, deletion 1 and substitution 2, what is the edit distance from `cat` to `cut`? (A number.)", accepted: ["2"] },
          { kind: "short", prompt: "Under the Markov assumption, a bigram model conditions on how many previous words? (A number.)", accepted: ["1", "one"] },
          { kind: "short", prompt: "Which subword algorithm repeatedly merges the most frequent adjacent pair? (Its initials.)", accepted: ["BPE", "byte pair encoding", "byte-pair encoding"] },
        ],
      },
    }),
    written({
      key: "nlp-attention", course: C, week: 9, title: "Explain Self-Attention to a First-Year Student", ...draft(2), marks: 10,
      instructions: "In **150–220 words**, explain self-attention to a first-year student who knows what a vector is but nothing about transformers.\n\nUse the sentence *\"Ali ne Sara ko kitab di kyunke woh parh chuka tha\"* (who is *woh*?) as your running example. Cover queries, keys and values in plain words, why the scores go through a softmax, and one advantage over an RNN.",
    }),
  ],
  announcements: [
    { course: C, title: "Naive Bayes lab is open", body: "Classify Roman Urdu food reviews. Work out the log probabilities for the example by hand first: the viva asks why we add one to every count.", postedDaysAgo: 3 },
    { course: C, title: "Quiz on weeks 2–5", body: "Six questions, six minutes. Bring your understanding of edit distance and smoothing, not memorized formulas.", postedDaysAgo: 1 },
    { course: C, title: "Project idea list", body: "Project ideas are up: Roman Urdu sentiment, Urdu news topic classification, and a spelling normalizer for Roman Urdu. Teams of two.", postedDaysAgo: 8 },
  ],
};
