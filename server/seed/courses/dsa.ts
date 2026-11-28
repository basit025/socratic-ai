/**
 * CS-201 Data Structures and Algorithms: weekly notes and new labs written by the team from their own
 * lecture slides. The course's earlier labs (Second Highest Score, Balanced Brackets, Bank Queue
 * Waiting Times, ...) live in content.ts because the demo class's past submissions use them.
 */
import { closed, draft, lab, open, quiz, weeks, written, type CoursePack } from "./kit.js";

const C = "cs201";

const LINKED = "class Node:\n    def __init__(self, value, next=None):\n        self.value = value\n        self.next = next\n\n\ndef from_list(values):\n    head = None\n    for v in reversed(values):\n        head = Node(v, head)\n    return head\n\n\ndef to_list(head):\n    out = []\n    while head:\n        out.append(head.value)\n        head = head.next\n    return out\n";

export const dsa: CoursePack = {
  course: { key: C, teacher: "naveed", code: "CS-201", name: "Data Structures and Algorithms", section: "Section A", term: "Fall 2026", joinCode: "DSA8MZ", students: [] },
  modules: weeks(C, [
    ["Abstract data types and the List ADT", `
### Abstraction
An **abstract data type** says *what* operations a type supports and what they mean, not *how* they are stored. A *Rational* number ADT offers add, multiply and compare; whether it stores numerator and denominator as two ints is hidden.

### The List ADT
Operations: insert, delete, find, get the k-th item, size, print.

| Implementation | get(k) | insert at front | insert at end |
| --- | --- | --- | --- |
| Static array | O(1) | O(n) (shift everything) | O(1) if space |
| Dynamic array | O(1) | O(n) | O(1) amortized |
| Linked list | O(n) | O(1) | O(n), or O(1) with a tail pointer |

> Choose the implementation by which operations your program does most often.
`],
    ["Linked lists", `
### Nodes and pointers
A **singly linked list** is a chain of nodes, each holding a value and a pointer to the next. The list is known by its **head**; the last node points to nothing.

\`\`\`python
class Node:
    def __init__(self, value, next=None):
        self.value = value
        self.next = next
\`\`\`

### Core operations
- **Insert at head**: new node points to the old head; head becomes the new node. O(1).
- **Delete a value**: walk with a \`prev\` pointer so you can bypass the node. Watch the head and empty-list cases.
- **Reverse**: walk once, turning each \`next\` pointer around (three pointers: prev, current, next).

### Doubly linked and circular lists
A **doubly linked list** adds a \`prev\` pointer, so you can delete a node in O(1) when you have it and walk backwards. A **dummy head** node removes most special cases for the empty list.
`],
    ["Stacks and queues", `
### Stack: last in, first out
\`push\`, \`pop\`, \`top\`, \`isEmpty\`, all O(1) with a linked list (push and pop at the head) or an array (at the end). Uses: undo, matching brackets, evaluating postfix expressions, function calls.

### Queue: first in, first out
\`enqueue\` at the rear, \`dequeue\` at the front. With an array, use a **circular buffer** so the front can move without shifting; with a linked list, keep both head and tail pointers.

\`\`\`text
bank line:  front → [Ali] [Sara] [Omar] ← rear
dequeue → Ali is served; enqueue(Hina) joins at the rear
\`\`\`

> In Python, \`list.pop()\` is a fast stack pop, but \`list.pop(0)\` is O(n). Use \`collections.deque\` for queues.
`],
    ["Algorithm analysis", `
### Counting steps, not seconds
Running time depends on the machine, so we count basic operations as a function of input size N, and look at the **worst case**.

### Asymptotic notation
- **O(g(N))**: an upper bound (grows no faster than g).
- **Ω(g(N))**: a lower bound.
- **Θ(g(N))**: both: a tight bound.

Typical growth rates: 1 < log N < N < N log N < N² < 2ᴺ.

### Rules of thumb
- A loop of N steps: O(N). Two nested loops over N: O(N²).
- Halving the problem each step (binary search): O(log N). T(N) = T(N/2) + 1.
- Divide and conquer with linear merging (merge sort): T(N) = 2T(N/2) + N = O(N log N).
`],
    ["Sorting", `
### Insertion sort
Grow a sorted prefix: take the next item and slide it left into place. O(N²) worst case, but O(N) on nearly sorted data, and fast for small arrays.

### Merge sort
Split in half, sort each half recursively, **merge** the two sorted halves in one pass. Always O(N log N), needs O(N) extra space, and is stable.

### Quicksort
Pick a **pivot**, **partition** so smaller items go left and larger go right, then sort each side. O(N log N) on average, O(N²) worst case (bad pivots, e.g. already sorted input with the first element as pivot). Median-of-three pivots avoid this in practice.

### Beating N log N
Comparison sorts can't beat Ω(N log N) (decision-tree argument). **Counting sort** and **radix sort** can, by using the digits of the keys: radix sort on d-digit numbers is O(d·(N + k)).
`],
    ["Trees and binary search trees", `
### Tree vocabulary
Root, parent, child, leaf, **depth** (edges from the root), **height** (longest path down to a leaf). File systems and expression trees are trees.

### Traversals
- **Preorder**: node, left, right (copying a tree, printing a directory).
- **Inorder**: left, node, right (gives a BST's keys in sorted order).
- **Postorder**: left, right, node (deleting a tree, evaluating an expression tree).

### Binary search trees
Every key in the left subtree is smaller, every key in the right subtree larger. Search, insert and delete follow one path: O(height). A balanced BST has height O(log N); inserting sorted data makes it a linked list with height N.

\`\`\`text
        50
      /    \\
    30      70        inorder: 20 30 40 50 70 80
   /  \\       \\
 20    40      80
\`\`\`
`],
    ["Heaps, AVL trees and B-trees", `
### Binary heaps and priority queues
A **heap** is a complete binary tree where every parent is ≤ its children (min-heap). Stored in an array: children of i are at 2i+1 and 2i+2. **Insert** bubbles up, **deleteMin** moves the last item to the root and sifts down: both O(log N). **Heapsort** is O(N log N) in place.

### AVL trees
A BST that keeps the heights of every node's two subtrees within **1**. After an insert, walk back up; at the first unbalanced node apply a **single rotation** (outside cases) or a **double rotation** (inside cases). Height stays O(log N).

### B-trees
For data on disk, reading a block is slow, so make nodes *wide*: an **M-ary** B-tree node holds many keys and children, keeping the tree only a few levels tall. B+ trees, with all data in the leaves, are what databases use for indexes.
`],
    ["Graphs: representation, BFS and topological sort", `
### Graphs
Vertices and edges: road maps, the metro network, course prerequisites, social networks. Directed or undirected, weighted or not.

| Representation | Space | Is (u, v) an edge? | Neighbours of u |
| --- | --- | --- | --- |
| Adjacency matrix | O(V²) | O(1) | O(V) |
| Adjacency list | O(V + E) | O(degree) | O(degree) |

### Breadth-first search
Visit the start, then all its neighbours, then theirs, using a **queue** and a visited set. BFS finds the **fewest-edges path** from the start to every reachable vertex in O(V + E). Record each vertex's parent to print the path.

### Topological sort
For a **DAG** (directed, no cycles), order vertices so every edge goes forward: e.g. a valid order to take courses given prerequisites. Repeatedly output a vertex with **indegree 0** and remove its edges.
`],
    ["Hashing and pattern matching", `
### Hash tables
A **hash function** maps a key to an array index, giving O(1) average insert and lookup. Two keys can land in the same slot (**collision**):
- **Separate chaining**: each slot holds a list.
- **Open addressing**: probe for another slot (linear probing, quadratic probing, double hashing).

Keep the **load factor** (items / slots) low, and resize when it grows.

### Pattern matching
- **Naive**: try every position: O(n·m).
- **Rabin-Karp**: compare rolling **hash values** first, then check characters only on a hash match.
- **Boyer-Moore**: compare from the end of the pattern and skip ahead on a mismatch: very fast in practice.
`],
  ]),
  assignments: [
    lab({
      key: "dsa-linked", course: C, week: 2, language: "python", title: "Linked List: Reverse and Remove", ...closed(4), marks: 10,
      instructions: "The `Node` class and the helpers `from_list` and `to_list` are already written for you.\n\nWrite, **using the nodes directly** (don't convert to a Python list):\n- `reverse(head)`: reverses the list in place and returns the new head.\n- `remove_all(head, value)`: removes every node holding `value` and returns the (possibly new) head.\n- `middle(head)`: returns the value of the middle node (for an even length, the second of the two middle nodes), or `None` for an empty list. Use the slow/fast pointer trick.\n\nExample: `to_list(reverse(from_list([1, 2, 3])))` returns `[3, 2, 1]`.",
      starterCode: LINKED + "\n\ndef reverse(head):\n    pass\n\n\ndef remove_all(head, value):\n    pass\n\n\ndef middle(head):\n    pass\n\n\nprint(to_list(reverse(from_list([1, 2, 3]))))\n",
      referenceSolution: LINKED + "\n\ndef reverse(head):\n    prev = None\n    while head:\n        head.next, prev, head = prev, head, head.next\n    return prev\n\n\ndef remove_all(head, value):\n    dummy = Node(None, head)\n    cur = dummy\n    while cur.next:\n        if cur.next.value == value:\n            cur.next = cur.next.next\n        else:\n            cur = cur.next\n    return dummy.next\n\n\ndef middle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow, fast = slow.next, fast.next.next\n    return slow.value if slow else None\n",
      tests: [
        { name: "Example from the brief", call: "to_list(reverse(from_list([1, 2, 3])))" },
        { name: "Reverse an empty list", call: "to_list(reverse(from_list([])))" },
        { name: "Remove from the head and the middle", call: "to_list(remove_all(from_list([7, 1, 7, 2, 7]), 7))" },
        { name: "Remove everything", call: "to_list(remove_all(from_list([4, 4]), 4))" },
        { name: "Middle of an odd list", call: "middle(from_list([1, 2, 3, 4, 5]))" },
        { name: "Middle of an even list", call: "middle(from_list([1, 2, 3, 4]))" },
      ],
    }),
    written({
      key: "dsa-bigo", course: C, week: 4, title: "Which Structure for the Fee Office?", ...closed(2), marks: 10,
      instructions: "The university fee office keeps 20,000 student records. Every day it (a) looks up a student by roll number thousands of times, (b) adds a few hundred new records, and (c) prints a list sorted by roll number once.\n\nIn **150–250 words**, compare an **unsorted array**, a **sorted array** and a **hash table** for this workload. Give the Big-O of (a), (b) and (c) for each, recommend one, and say what you would change if the office also needed \"all students with roll numbers between 2400 and 2500\" every hour.",
    }),
    quiz({
      key: "dsa-quiz-trees", course: C, week: 6, title: "Quiz: Trees, Heaps and Sorting", ...open(4, 1), marks: 10,
      instructions: "A short timed quiz on weeks 4–7. One question at a time; you can't go back.",
      quiz: {
        draw: 6, timeLimitMinutes: 6, fullscreen: true,
        questions: [
          { kind: "mcq", prompt: "Which traversal of a binary search tree lists the keys in sorted order?", options: ["Preorder", "Inorder", "Postorder", "Level order"], correct: 1 },
          { kind: "mcq", prompt: "Inserting 10, 20, 30, 40 (in that order) into an empty BST gives a tree of height:", options: ["1", "2", "3", "4"], correct: 2 },
          { kind: "mcq", prompt: "In an array-based heap, the children of index i are at:", options: ["i+1 and i+2", "2i+1 and 2i+2", "i/2 and i/2+1", "2i and 3i"], correct: 1 },
          { kind: "mcq", prompt: "What is quicksort's worst-case running time?", options: ["O(N)", "O(N log N)", "O(N²)", "O(log N)"], correct: 2 },
          { kind: "mcq", prompt: "An AVL tree keeps the heights of each node's subtrees within:", options: ["0", "1", "2", "log N"], correct: 1 },
          { kind: "mcq", prompt: "Why do databases use B-trees instead of binary search trees on disk?", options: ["B-trees use less memory", "Wide nodes mean fewer slow disk reads", "B-trees are always sorted", "Binary trees can't store strings"], correct: 1 },
          { kind: "mcq", prompt: "Which sort is O(N) on input that is already nearly sorted?", options: ["Merge sort", "Insertion sort", "Heapsort", "Selection sort"], correct: 1 },
          { kind: "short", prompt: "What is the time complexity of merge sort? (Big-O.)", accepted: ["O(N log N)", "O(n log n)", "N log N", "n log n", "O(nlogn)", "nlogn"] },
          { kind: "short", prompt: "A min-heap's smallest element is always at which position of the array? (An index.)", accepted: ["0", "index 0", "the root", "root"] },
        ],
      },
    }),
    lab({
      key: "dsa-bst", course: C, week: 6, language: "python", title: "Binary Search Tree for Exam Roll Numbers", ...open(6, 2), marks: 10,
      instructions: "The exam cell stores roll numbers in a binary search tree.\n\nWrite a class `BST` with:\n- `insert(key)`: adds a key (ignore duplicates).\n- `contains(key)`: `True` or `False`.\n- `inorder()`: the keys as a sorted list (an **inorder traversal**, written recursively).\n- `height()`: the number of **edges** on the longest root-to-leaf path; an empty tree has height `-1`, a single node `0`.\n- `min()`: the smallest key, or `None` if empty.\n\nAnd a function `build(keys)` that inserts the keys in order into a new `BST` and returns it.\n\nExample: `build([50, 30, 70, 20, 40, 80]).inorder()` returns `[20, 30, 40, 50, 70, 80]`.",
      starterCode: "class TreeNode:\n    def __init__(self, key):\n        self.key = key\n        self.left = None\n        self.right = None\n\n\nclass BST:\n    def __init__(self):\n        self.root = None\n\n\ndef build(keys):\n    tree = BST()\n    for k in keys:\n        tree.insert(k)\n    return tree\n\n\nprint(build([50, 30, 70, 20, 40, 80]).inorder())\n",
      referenceSolution: "class TreeNode:\n    def __init__(self, key):\n        self.key = key\n        self.left = None\n        self.right = None\n\n\nclass BST:\n    def __init__(self):\n        self.root = None\n\n    def insert(self, key):\n        def ins(node):\n            if node is None:\n                return TreeNode(key)\n            if key < node.key:\n                node.left = ins(node.left)\n            elif key > node.key:\n                node.right = ins(node.right)\n            return node\n        self.root = ins(self.root)\n\n    def contains(self, key):\n        node = self.root\n        while node:\n            if key == node.key:\n                return True\n            node = node.left if key < node.key else node.right\n        return False\n\n    def inorder(self):\n        out = []\n        def walk(node):\n            if node:\n                walk(node.left); out.append(node.key); walk(node.right)\n        walk(self.root)\n        return out\n\n    def height(self):\n        def h(node):\n            return -1 if node is None else 1 + max(h(node.left), h(node.right))\n        return h(self.root)\n\n    def min(self):\n        node = self.root\n        if node is None:\n            return None\n        while node.left:\n            node = node.left\n        return node.key\n\n\ndef build(keys):\n    tree = BST()\n    for k in keys:\n        tree.insert(k)\n    return tree\n",
      tests: [
        { name: "Example from the brief", call: "build([50, 30, 70, 20, 40, 80]).inorder()" },
        { name: "Height of a balanced tree", call: "build([50, 30, 70, 20, 40, 80]).height()" },
        { name: "Sorted input makes a tall tree", call: "build([1, 2, 3, 4, 5]).height()" },
        { name: "Empty tree", call: "(BST().height(), BST().min(), BST().inorder())" },
        { name: "Search", call: "(build([8, 3, 10]).contains(10), build([8, 3, 10]).contains(4))" },
        { name: "Duplicates are ignored", call: "build([5, 5, 3, 5]).inorder()" },
      ],
    }),
    written({
      key: "dsa-trace", course: C, week: 6, title: "Trace BST Insertions", ...open(5, 1), marks: 10,
      instructions: "Trace this yourself and **type your working** in the answer box (paste is off).\n\n1. Insert these roll numbers, in order, into an empty binary search tree: `45, 20, 70, 10, 30, 60, 80, 25`. After each insertion, write where the new key went (for example: \"25: left of 45, right of 20, left of 30\").\n2. Write the final tree level by level (root first, then each level left to right).\n3. Write the **preorder**, **inorder** and **postorder** traversals of the final tree.\n4. What is the tree's **height** (in edges)?\n5. Delete `20` (replace it with its inorder successor) and write the new level-by-level tree.\n\nUstaad's viva will give you a new key to insert and ask where it goes.",
    }),
    lab({
      key: "dsa-bfs", course: C, week: 8, language: "python", title: "Fewest Stops on the Metro (BFS)", ...draft(2), marks: 10,
      instructions: "The Rawalpindi–Islamabad Metro network is a graph: `METRO` maps each station to its neighbours.\n\nWrite `fewest_stops(graph, start, goal)` using **breadth-first search** with a queue. Return the list of stations on a path with the fewest stops, from `start` to `goal` inclusive, or `None` if there is no path. When there's a choice, explore neighbours in the order they are listed.",
      starterCode: "from collections import deque\n\nMETRO = {\n    'Saddar': ['Marrir Chowk'],\n    'Marrir Chowk': ['Saddar', 'Committee Chowk'],\n    'Committee Chowk': ['Marrir Chowk', 'Faizabad'],\n    'Faizabad': ['Committee Chowk', 'IJP Road', 'Shamsabad'],\n    'Shamsabad': ['Faizabad'],\n    'IJP Road': ['Faizabad', 'Faiz Ahmad Faiz', 'Peshawar Morr'],\n    'Faiz Ahmad Faiz': ['IJP Road', 'Peshawar Morr'],\n    'Peshawar Morr': ['IJP Road', 'Faiz Ahmad Faiz', 'Pak Secretariat'],\n    'Pak Secretariat': ['Peshawar Morr'],\n}\n\n\ndef fewest_stops(graph, start, goal):\n    pass\n",
      referenceSolution: "from collections import deque\n\nMETRO = {\n    'Saddar': ['Marrir Chowk'],\n    'Marrir Chowk': ['Saddar', 'Committee Chowk'],\n    'Committee Chowk': ['Marrir Chowk', 'Faizabad'],\n    'Faizabad': ['Committee Chowk', 'IJP Road', 'Shamsabad'],\n    'Shamsabad': ['Faizabad'],\n    'IJP Road': ['Faizabad', 'Faiz Ahmad Faiz', 'Peshawar Morr'],\n    'Faiz Ahmad Faiz': ['IJP Road', 'Peshawar Morr'],\n    'Peshawar Morr': ['IJP Road', 'Faiz Ahmad Faiz', 'Pak Secretariat'],\n    'Pak Secretariat': ['Peshawar Morr'],\n}\n\n\ndef fewest_stops(graph, start, goal):\n    parent = {start: None}\n    q = deque([start])\n    while q:\n        u = q.popleft()\n        if u == goal:\n            path = []\n            while u is not None:\n                path.append(u)\n                u = parent[u]\n            return path[::-1]\n        for v in graph.get(u, []):\n            if v not in parent:\n                parent[v] = u\n                q.append(v)\n    return None\n",
      tests: [
        { name: "Saddar to the Secretariat", call: "fewest_stops(METRO, 'Saddar', 'Pak Secretariat')" },
        { name: "Already there", call: "fewest_stops(METRO, 'Faizabad', 'Faizabad')" },
        { name: "No path", call: "fewest_stops({'A': ['B'], 'B': ['A'], 'C': []}, 'A', 'C')" },
      ],
    }),
  ],
  announcements: [
    { course: C, title: "BST lab is open", body: "Write inorder and height recursively. Draw the tree for the example on paper first: the viva will give you a new list of keys and ask for the height.", postedDaysAgo: 2 },
    { course: C, title: "Quiz on trees, heaps and sorting", body: "Six questions in six minutes. Know your traversals and the worst cases.", postedDaysAgo: 1 },
  ],
};
