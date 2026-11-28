/** CS-341 Data Mining: notes, labs and quiz written by the team from their own lecture slides. */
import { closed, draft, lab, open, quiz, weeks, written, type CoursePack } from "./kit.js";

const C = "cs341";

export const dataMining: CoursePack = {
  course: { key: C, teacher: "ijaz", code: "CS-341", name: "Data Mining", section: "Section A", term: "Fall 2026", joinCode: "DMN5RK", students: [] },
  modules: weeks(C, [
    ["What data mining is", `
### Why mine data?
Shops, banks, hospitals and telcos collect far more data than anyone can read. **Data mining** finds patterns in it that are *valid, new, useful and understandable*. It is one step in the bigger **KDD process**: clean → integrate → select → transform → **mine** → evaluate → present.

### The main tasks
| Task | Question it answers | Example |
| --- | --- | --- |
| Classification | Which class does this belong to? | Is this loan applicant likely to default? |
| Regression | What number should we predict? | Next month's electricity demand in Lahore |
| Clustering | Which items naturally group together? | Customer segments for a mobile operator |
| Association rules | What happens together? | Customers who buy *doodh* also buy *double roti* |
| Outlier detection | What doesn't fit? | A credit-card charge in Dubai at 3 AM |

> Predictive tasks (classification, regression) learn from labelled examples. Descriptive tasks (clustering, association, outliers) find structure without labels.

### Check yourself
- Name the KDD step where you remove duplicate customer records.
- Is grouping news articles by topic, without any labels, classification or clustering?
`],
    ["Understanding your data", `
### Attributes come in types
- **Nominal**: labels with no order (city, blood group).
- **Ordinal**: ordered labels (grade A/B/C, satisfaction 1–5).
- **Interval / ratio**: numbers where differences (and for ratio, zero) mean something (temperature, salary).

### Central tendency and spread
- **Mean** is pulled by extreme values; the **median** isn't. Skewed data (like salaries) is better described by its median.
- **Quartiles** split sorted data into four parts. **IQR = Q3 − Q1** is the spread of the middle half.
- The **five-number summary** (min, Q1, median, Q3, max) is exactly what a **boxplot** draws.
- A common outlier rule: anything below **Q1 − 1.5·IQR** or above **Q3 + 1.5·IQR**.

### Worked example
PSL top-order scores: \`12, 27, 33, 45, 61, 78, 90\`
- Median = 45. Lower half \`12, 27, 33\` → Q1 = 27. Upper half \`61, 78, 90\` → Q3 = 78.
- IQR = 51, so the fences are 27 − 76.5 and 78 + 76.5: no outliers here.

### Correlation
For two numeric attributes, the **correlation coefficient** runs from −1 to +1. For two nominal attributes, the **χ² test** checks whether they are independent. Correlation never proves causation.
`],
    ["Data warehousing and OLAP", `
### Warehouse vs. operational database
A **data warehouse** is *subject-oriented, integrated, time-variant and non-volatile*. The bank's live system (OLTP) handles thousands of small transactions; the warehouse (OLAP) answers big analytical questions over years of history.

### Modelling: facts and dimensions
- A **fact table** holds measures (rupees sold, units) plus keys to dimensions.
- **Dimension tables** describe *who, what, where, when* (customer, product, branch, date).
- **Star schema**: one fact table, dimensions around it. **Snowflake**: dimensions normalised into sub-tables.

### The data cube and OLAP operations
| Operation | What it does | Example |
| --- | --- | --- |
| Roll-up | Climb a concept hierarchy | City → province totals |
| Drill-down | Go to finer detail | Quarter → month |
| Slice | Fix one dimension | Only 2026 |
| Dice | Fix ranges on several | Punjab and KP, Q3 only |
| Pivot | Rotate the view | Products as rows instead of columns |

> Concept hierarchies (day → month → quarter → year) are what make roll-up and drill-down possible.
`],
    ["Association rules I: support, confidence, Apriori", `
### Itemsets and rules
A **transaction** is a set of items bought together. A rule **X → Y** says "baskets with X tend to contain Y".

- **support(X → Y)** = fraction of transactions containing X ∪ Y.
- **confidence(X → Y)** = support(X ∪ Y) / support(X).
- **lift** = confidence / support(Y). Lift above 1 means X and Y appear together more than chance.

### Worked example (a kiryana store)
| TID | Items |
| --- | --- |
| 1 | doodh, double roti, anday |
| 2 | doodh, chai patti |
| 3 | doodh, double roti, chai patti, cheeni |
| 4 | double roti, anday |
| 5 | doodh, double roti, chai patti |

For **doodh → double roti**: support = 3/5 = 0.6, confidence = 3/4 = 0.75, lift = 0.75 / 0.8 ≈ 0.94.

### The Apriori principle
> If an itemset is frequent, all of its subsets are frequent. So if {anday} is infrequent, no larger set containing anday needs counting.

Apriori grows itemsets level by level (size 1, 2, 3 …), **joining** frequent (k−1)-itemsets into candidates and **pruning** any candidate with an infrequent subset, then counting the survivors in one pass over the data.
`],
    ["Association rules II: rule generation and interest", `
### From frequent itemsets to rules
For each frequent itemset L, try every split L = X ∪ Y and keep rules with confidence ≥ min_conf. Confidence is *anti-monotone* in the right-hand side, so once {A,B} → {C} fails, {A} → {B,C} can be skipped.

### When support and confidence mislead
High confidence can hide a negative relationship when Y is very common anyway. Always check **lift** (or χ²).

### Multiple minimum supports
One global min_sup is unfair to rare but valuable items (a microwave sells less often than bread). **MS-Apriori** gives each item its own minimum item support (MIS); an itemset is frequent if it reaches the lowest MIS among its items.

### Class association rules
When one item is a class label (e.g. *defaulted = yes*), mine only rules whose right side is a class. These rules double as an interpretable classifier.
`],
    ["Cluster analysis", `
### What makes a good clustering?
High similarity **within** clusters, low similarity **between** clusters. Methods: partitioning, hierarchical, density-based, grid-based.

### k-means, step by step
1. Pick k initial centroids.
2. **Assign** each point to its nearest centroid.
3. **Update** each centroid to the mean of its points.
4. Repeat 2–3 until nothing moves.

\`\`\`text
points:    (1,1) (2,1) (8,8) (9,8)
centroids: (1,1) (9,8)
assign:    {(1,1),(2,1)} {(8,8),(9,8)}
update:    (1.5,1) (8.5,8)
\`\`\`

> k-means minimises the sum of squared distances, needs k in advance, and is sensitive to the starting centroids and to outliers.

### Variants
- **k-medoids (PAM)** uses real points as centres, so outliers pull less.
- **k-modes** handles categorical data.
- **Hierarchical clustering** builds a **dendrogram**: agglomerative (merge closest clusters) or divisive (split).
`],
    ["Outlier detection", `
### Three kinds of outliers
- **Global**: far from everything (a 50,000-unit electricity bill in a small flat).
- **Contextual**: odd only in context (35 °C is normal in June, strange in January).
- **Collective**: a group that is odd together (many small transfers to one account in an hour).

### Statistical methods
- **z-score**: z = (x − μ) / σ. Values with |z| above a threshold (often 3, or 2 for small data) are suspects.
- **Boxplot rule**: outside Q1 − 1.5·IQR or Q3 + 1.5·IQR.
- **Grubbs' test** removes the most extreme value while it is statistically significant.

### Proximity-based methods
- **Distance-based**: a point is an outlier if few points lie within radius r.
- **Density-based (LOF)**: compare a point's local density with its neighbours'. Handles clusters of different densities.

> Outliers are not always errors: in fraud detection, the outliers *are* the result.
`],
    ["Trends: text, sentiment and responsible mining", `
### Mining rich data
Text, spatial-temporal data, graphs and networks each need their own methods. **Sentiment analysis** classifies opinions (e.g. Urdu and Roman Urdu product reviews) as positive, negative or neutral.

### Data mining and society
- **Privacy-preserving data mining**: anonymise, aggregate, or add noise so patterns survive but individuals don't leak.
- **Fairness**: a model trained on biased history repeats the bias.
- **Misinformation**: mining how false news spreads on social networks.

> A good data miner asks not only "is the pattern accurate?" but "who could this harm?"
`],
  ]),
  assignments: [
    lab({
      key: "dm-five", course: C, week: 2, language: "python", title: "Five-Number Summary of PSL Scores", ...closed(4), marks: 10,
      instructions: "A cricket analyst wants a quick picture of batting scores before drawing a boxplot.\n\nWrite `five_number_summary(scores)` that returns a tuple `(minimum, Q1, median, Q3, maximum)`.\n\n- Sort the scores first.\n- **Q1** is the median of the lower half and **Q3** the median of the upper half. With an odd count, leave the middle value out of both halves.\n- The median of an even-length list is the average of the two middle values.\n\nExample: `five_number_summary([45, 12, 78, 33, 90, 61, 27])` returns `(12, 27, 45, 78, 90)`.\n\nAlso write `iqr_outliers(scores)`: the sorted list of scores below `Q1 - 1.5*IQR` or above `Q3 + 1.5*IQR`.",
      starterCode: "def median(values):\n    # values is already sorted\n    pass\n\n\ndef five_number_summary(scores):\n    pass\n\n\ndef iqr_outliers(scores):\n    pass\n\n\nprint(five_number_summary([45, 12, 78, 33, 90, 61, 27]))\n",
      referenceSolution: "def median(values):\n    n = len(values)\n    m = n // 2\n    return values[m] if n % 2 else (values[m - 1] + values[m]) / 2\n\n\ndef five_number_summary(scores):\n    s = sorted(scores)\n    n = len(s)\n    lower, upper = s[: n // 2], s[(n + 1) // 2 :]\n    return (s[0], median(lower), median(s), median(upper), s[-1])\n\n\ndef iqr_outliers(scores):\n    _, q1, _, q3, _ = five_number_summary(scores)\n    iqr = q3 - q1\n    return sorted(x for x in scores if x < q1 - 1.5 * iqr or x > q3 + 1.5 * iqr)\n",
      tests: [
        { name: "Example from the brief", call: "five_number_summary([45, 12, 78, 33, 90, 61, 27])" },
        { name: "Even number of innings", call: "five_number_summary([10, 20, 30, 40, 50, 60])" },
        { name: "Repeated scores", call: "five_number_summary([0, 0, 4, 4, 4, 6, 100])" },
        { name: "A collapse and a century", call: "iqr_outliers([22, 25, 27, 30, 31, 33, 35, 120])" },
        { name: "No outliers", call: "iqr_outliers([45, 12, 78, 33, 90, 61, 27])" },
      ],
    }),
    written({
      key: "dm-star", course: C, week: 3, title: "Design a Star Schema for a Pharmacy Chain", ...closed(3), marks: 10,
      instructions: "A pharmacy chain with 40 branches across Punjab wants to answer questions like *\"Which medicines sold most in Rawalpindi branches during the dengue season?\"*\n\nIn **150–250 words**:\n1. Name the **fact table** and list its measures.\n2. List **four dimension tables**, with two attributes each, and one concept hierarchy (e.g. branch → city → province).\n3. Describe one **roll-up** and one **slice** a manager would run, in plain words.\n4. Say in one sentence why this belongs in a warehouse, not the branches' live billing system.",
    }),
    lab({
      key: "dm-basket", course: C, week: 4, language: "python", title: "Kiryana Store Basket Rules", ...closed(2), marks: 10,
      instructions: "A kiryana store owner wants to know which items to place together.\n\nEach transaction is a list of items. Write:\n\n- `support(transactions, itemset)`: the fraction of transactions that contain **every** item in `itemset`, rounded to 2 decimals.\n- `rule_metrics(transactions, lhs, rhs)`: returns `(support, confidence, lift)` for the rule **lhs → rhs**, each rounded to 2 decimals. If `lhs` never appears, confidence and lift are `0.0`.\n\nUse the unrounded values inside your calculations; round only what you return.\n\nExample: with the five baskets from this week's notes, `rule_metrics(T, ['doodh'], ['double roti'])` returns `(0.6, 0.75, 0.94)`.",
      starterCode: "T = [\n    ['doodh', 'double roti', 'anday'],\n    ['doodh', 'chai patti'],\n    ['doodh', 'double roti', 'chai patti', 'cheeni'],\n    ['double roti', 'anday'],\n    ['doodh', 'double roti', 'chai patti'],\n]\n\n\ndef support(transactions, itemset):\n    pass\n\n\ndef rule_metrics(transactions, lhs, rhs):\n    pass\n\n\nprint(rule_metrics(T, ['doodh'], ['double roti']))\n",
      referenceSolution: "T = [\n    ['doodh', 'double roti', 'anday'],\n    ['doodh', 'chai patti'],\n    ['doodh', 'double roti', 'chai patti', 'cheeni'],\n    ['double roti', 'anday'],\n    ['doodh', 'double roti', 'chai patti'],\n]\n\n\ndef _support(transactions, itemset):\n    if not transactions:\n        return 0.0\n    need = set(itemset)\n    return sum(1 for t in transactions if need <= set(t)) / len(transactions)\n\n\ndef support(transactions, itemset):\n    return round(_support(transactions, itemset), 2)\n\n\ndef rule_metrics(transactions, lhs, rhs):\n    s_both = _support(transactions, list(lhs) + list(rhs))\n    s_lhs = _support(transactions, lhs)\n    s_rhs = _support(transactions, rhs)\n    conf = s_both / s_lhs if s_lhs else 0.0\n    lift = conf / s_rhs if s_lhs and s_rhs else 0.0\n    return (round(s_both, 2), round(conf, 2), round(lift, 2))\n",
      tests: [
        { name: "Example from the brief", call: "rule_metrics(T, ['doodh'], ['double roti'])" },
        { name: "Support of a pair", call: "support(T, ['doodh', 'chai patti'])" },
        { name: "Two items on the left", call: "rule_metrics(T, ['doodh', 'chai patti'], ['double roti'])" },
        { name: "An item nobody bought", call: "rule_metrics(T, ['namak'], ['doodh'])" },
        { name: "A rule with lift above 1", call: "rule_metrics(T, ['anday'], ['double roti'])" },
      ],
    }),
    quiz({
      key: "dm-quiz", course: C, week: 5, title: "Quiz: Association Rules and OLAP", ...open(4, 2), marks: 10,
      instructions: "A short timed quiz on weeks 2–5: data summaries, warehouses and OLAP, and association rules. One question at a time; you can't go back.",
      quiz: {
        draw: 6, timeLimitMinutes: 7, fullscreen: true,
        questions: [
          { kind: "mcq", prompt: "In 5 baskets, {chai patti, cheeni} appears in 2 and {chai patti} in 4. What is the confidence of chai patti → cheeni?", options: ["0.4", "0.5", "0.8", "2.0"], correct: 1 },
          { kind: "mcq", prompt: "A rule has lift 0.7. What does that mean?", options: ["The items appear together more than chance", "The items appear together less than chance", "The rule has 70% confidence", "The rule is invalid"], correct: 1 },
          { kind: "mcq", prompt: "The Apriori principle says:", options: ["Every superset of a frequent itemset is frequent", "Every subset of a frequent itemset is frequent", "Infrequent itemsets have frequent supersets", "Support grows as itemsets grow"], correct: 1 },
          { kind: "mcq", prompt: "Going from monthly sales to quarterly sales is a:", options: ["Drill-down", "Slice", "Roll-up", "Pivot"], correct: 2 },
          { kind: "mcq", prompt: "Which schema normalises dimension tables into sub-tables?", options: ["Star", "Snowflake", "Fact constellation", "Flat file"], correct: 1 },
          { kind: "mcq", prompt: "Salaries in a company are heavily right-skewed. Which best describes a typical salary?", options: ["Mean", "Median", "Maximum", "Range"], correct: 1 },
          { kind: "short", prompt: "Q1 = 20 and Q3 = 50. What is the IQR? (A number.)", accepted: ["30"] },
          { kind: "short", prompt: "Which measure divides confidence(X → Y) by support(Y)? (One word.)", accepted: ["lift"] },
          { kind: "short", prompt: "What does the O in OLAP stand for? (One word.)", accepted: ["online", "on-line", "on line"] },
        ],
      },
    }),
    written({
      key: "dm-apriori", course: C, week: 5, title: "Apriori, Step by Step", ...open(6, 1), marks: 10,
      instructions: "Work this out step by step and **type your working** in the answer box (paste is off; show each step, not just the results).\n\nA pharmacy recorded five baskets:\n\n| TID | Items |\n| --- | --- |\n| 1 | panadol, ORS, vitamin C |\n| 2 | panadol, ORS |\n| 3 | ORS, vitamin C, mask |\n| 4 | panadol, ORS, mask |\n| 5 | panadol, vitamin C |\n\nWith **min_sup = 2 transactions**:\n1. List every frequent 1-itemset and 2-itemset with its count (show the candidates you pruned).\n2. Is there a frequent 3-itemset? Explain using the Apriori principle.\n3. For the rule **panadol → ORS**, compute support, confidence and lift, showing the fractions.\n\nUstaad's viva will give you a new basket and ask how your counts change.",
    }),
    lab({
      key: "dm-kmeans", course: C, week: 6, language: "python", title: "K-Means: One Step for Rickshaw Stands", ...open(5), marks: 10,
      instructions: "A ride-hailing startup in Rawalpindi wants to place rickshaw stands near clusters of pickup requests. Each request is an `(x, y)` position in km.\n\nWrite `kmeans_step(points, centroids)` that performs **one** k-means iteration and returns the new centroids as a list of `(x, y)` tuples of floats, each rounded to 2 decimals:\n\n1. **Assign** each point to its nearest centroid (straight-line distance). On a tie, choose the centroid that comes first.\n2. **Update** each centroid to the mean of its assigned points. A centroid with no points stays where it is.\n\nExample: `kmeans_step([(1, 1), (2, 1), (8, 8), (9, 8)], [(1, 1), (9, 8)])` returns `[(1.5, 1.0), (8.5, 8.0)]`.\n\nThen write `kmeans(points, centroids)` that repeats the step until the centroids stop changing (at most 20 steps) and returns the final centroids.",
      starterCode: "def kmeans_step(points, centroids):\n    pass\n\n\ndef kmeans(points, centroids):\n    pass\n\n\nprint(kmeans_step([(1, 1), (2, 1), (8, 8), (9, 8)], [(1, 1), (9, 8)]))\n",
      referenceSolution: "def kmeans_step(points, centroids):\n    groups = [[] for _ in centroids]\n    for (x, y) in points:\n        best = min(range(len(centroids)), key=lambda i: ((x - centroids[i][0]) ** 2 + (y - centroids[i][1]) ** 2, i))\n        groups[best].append((x, y))\n    new = []\n    for c, g in zip(centroids, groups):\n        if g:\n            new.append((round(sum(p[0] for p in g) / len(g), 2), round(sum(p[1] for p in g) / len(g), 2)))\n        else:\n            new.append((round(float(c[0]), 2), round(float(c[1]), 2)))\n    return new\n\n\ndef kmeans(points, centroids):\n    current = [tuple(c) for c in centroids]\n    for _ in range(20):\n        nxt = kmeans_step(points, current)\n        if nxt == current:\n            break\n        current = nxt\n    return current\n",
      tests: [
        { name: "Example from the brief", call: "kmeans_step([(1, 1), (2, 1), (8, 8), (9, 8)], [(1, 1), (9, 8)])" },
        { name: "A tie goes to the first centroid", call: "kmeans_step([(5.0, 0.0)], [(0.0, 0.0), (10.0, 0.0)])" },
        { name: "An empty cluster stays put", call: "kmeans_step([(1.0, 1.0), (2.0, 2.0)], [(0.0, 0.0), (50.0, 50.0)])" },
        { name: "Three stands", call: "kmeans_step([(0, 0), (1, 0), (10, 10), (11, 10), (0, 10), (1, 11)], [(0, 1), (10, 9), (2, 12)])" },
        { name: "Runs until stable", call: "kmeans([(1, 1), (1, 2), (2, 1), (8, 8), (9, 9), (8, 9)], [(1, 1), (2, 1)])" },
      ],
    }),
    lab({
      key: "dm-bills", course: C, week: 7, language: "python", title: "Flagging Unusual Electricity Bills", ...draft(1), marks: 10,
      instructions: "An electricity company wants to flag meter readings that may be faulty or tampered with.\n\nWrite `zscore_outliers(units, threshold)` that returns the **indexes** of readings whose z-score has an absolute value greater than `threshold`. Use the population standard deviation. If every reading is the same, return an empty list.\n\nExample: `zscore_outliers([210, 190, 205, 1500, 198, 202], 2)` returns `[3]`.",
      starterCode: "def zscore_outliers(units, threshold):\n    pass\n\n\nprint(zscore_outliers([210, 190, 205, 1500, 198, 202], 2))\n",
      referenceSolution: "def zscore_outliers(units, threshold):\n    n = len(units)\n    mean = sum(units) / n\n    sd = (sum((u - mean) ** 2 for u in units) / n) ** 0.5\n    if sd == 0:\n        return []\n    return [i for i, u in enumerate(units) if abs((u - mean) / sd) > threshold]\n",
      tests: [
        { name: "Example from the brief", call: "zscore_outliers([210, 190, 205, 1500, 198, 202], 2)" },
        { name: "All the same", call: "zscore_outliers([300, 300, 300], 1)" },
        { name: "Low and high", call: "zscore_outliers([5, 200, 210, 205, 195, 900], 1.5)" },
      ],
    }),
  ],
  announcements: [
    { course: C, title: "K-Means lab is open", body: "This week's lab places rickshaw stands with one step of k-means. Work it out on paper for the example first, then code it. Ustaad will ask you to explain your assignment step.", postedDaysAgo: 3 },
    { course: C, title: "Quiz on association rules", body: "The timed quiz covers weeks 2–5. It's 7 minutes, one question at a time. Revise support, confidence, lift and the OLAP operations.", postedDaysAgo: 2 },
    { course: C, title: "Project groups", body: "Form groups of three for the term project by Friday. Pick a Pakistani dataset (PBS, open data portals, or data you collect yourselves) and send me a one-paragraph proposal.", postedDaysAgo: 9 },
  ],
};
