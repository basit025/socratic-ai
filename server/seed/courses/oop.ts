/** CS-211 Object-Oriented Programming: written by the team from their own (Java) lecture slides. Labs run in Python in the browser. */
import { closed, draft, lab, open, quiz, weeks, written, type CoursePack } from "./kit.js";

const C = "cs211";

export const oop: CoursePack = {
  course: { key: C, teacher: "adeel", code: "CS-211", name: "Object-Oriented Programming", section: "Section B", term: "Fall 2026", joinCode: "OOP6YH", students: [] },
  modules: weeks(C, [
    ["Classes and objects", `
### Thinking in objects
A **class** is a blueprint; an **object** is one thing built from it, with its own **state** (fields) and **behaviour** (methods). A *Student* class has fields like name and CGPA, and methods like \`enroll()\`.

### In Java and in Python
\`\`\`java
public class Student {
    private String name;
    public Student(String name) { this.name = name; }
}
\`\`\`
\`\`\`python
class Student:
    def __init__(self, name):
        self.name = name
\`\`\`

> Lectures use Java; labs run in Python right in your browser. The ideas (classes, constructors, inheritance, equality, exceptions) are the same. Each lab notes where Java differs.

### UML class diagrams
A box with three parts: the class name, the fields (\`- name: String\`) and the methods (\`+ enroll(): void\`). \`-\` is private, \`+\` public.
`],
    ["Constructors, overloading and scope", `
### Constructors
A constructor runs when an object is created and sets up a valid state. If you write none, Java gives you a **default constructor**. Java lets you **overload** constructors (same name, different parameters); Python uses default arguments instead:

\`\`\`python
class Account:
    def __init__(self, owner, balance=0):   # Account("Ali") or Account("Ali", 500)
        ...
\`\`\`

### Three kinds of variables
- **Local**: inside a method, gone when it returns.
- **Object (instance) attributes**: one copy per object (\`self.balance\`).
- **Class attributes**: one copy shared by all objects (\`static\` in Java), e.g. a count of accounts opened.

> A common bug: a local variable with the same name as a field *shadows* it. In Java, \`this.name = name\` fixes it; in Python, always write \`self.\`.
`],
    ["Encapsulation and access control", `
### Hide the data, expose the behaviour
Fields are **private**; other code uses public methods. A bank account shouldn't let anyone write \`balance = -5000\`: \`withdraw()\` checks first.

| Java modifier | Visible to |
| --- | --- |
| \`private\` | the class only |
| (none) | the same package |
| \`protected\` | the package and subclasses |
| \`public\` | everyone |

Python has no enforced private; by convention a leading underscore (\`_balance\`) means "internal, don't touch".

### Packages
Group related classes (\`pk.edu.pothohar.accounts\`) to organise code and avoid name clashes.
`],
    ["Inheritance, overriding, this and super", `
### Is-a relationships
A **Square** is a **Rectangle**; a **SavingsAccount** is an **Account**. A subclass inherits fields and methods and can **override** them.

\`\`\`python
class Rectangle(Shape):
    def __init__(self, w, h):
        self.w, self.h = w, h
    def area(self):
        return self.w * self.h

class Square(Rectangle):
    def __init__(self, side):
        super().__init__(side, side)   # Java: super(side, side);
\`\`\`

### this and super
\`this\` (Python \`self\`) is the current object. \`super\` reaches the parent: to call its constructor (it must come first in a Java constructor) or an overridden method.

> **Overloading** is the same name with different parameters (chosen at compile time). **Overriding** is a subclass replacing a method with the same signature (chosen at run time).
`],
    ["Polymorphism and composition", `
### Polymorphism
One interface, many forms: a list of \`Shape\` objects can hold circles and squares, and \`shape.area()\` runs the right version for each. Code written against the parent type works for every subclass, including ones written later.

### Composition: has-a
A **Hostel has Rooms**; a **Car has an Engine**. Instead of inheriting, an object holds other objects and delegates to them.

> Prefer composition when the relationship is *has-a* or might change at run time. Use inheritance only for a true, stable *is-a*. A Stack that inherits from ArrayList exposes \`add(index, x)\` and breaks its own rules; a Stack that *has* a list doesn't.
`],
    ["Equality, hashing and cloning", `
### Identity vs. equality
- **Identity**: are these the same object in memory? Java \`==\` on objects, Python \`is\`.
- **Equality**: do they represent the same value? Java \`.equals()\`, Python \`==\` via \`__eq__\`.

\`new Fraction(1, 2) == new Fraction(2, 4)\` is false in Java (different objects), but \`.equals()\` can return true if you write it to compare reduced values.

### The contract
\`equals\` must be **reflexive, symmetric and transitive**, and equal objects must have **equal hash codes**; otherwise HashMap and HashSet break. In Python, defining \`__eq__\` means you must define \`__hash__\` too.

### Shallow vs. deep copy
A **shallow copy** copies references, so both copies share inner objects; changing one changes the other. A **deep copy** copies everything inside.
`],
    ["Exception handling", `
### When things go wrong
An **exception** is an event that disrupts normal flow: dividing by zero, a missing file, bad input. Instead of crashing, catch and handle it.

\`\`\`java
try {
    int marks = Integer.parseInt(input);
} catch (NumberFormatException e) {
    System.out.println("Marks must be a number");
} finally {
    scanner.close();
}
\`\`\`
\`\`\`python
try:
    marks = int(text)
except ValueError:
    print("Marks must be a number")
\`\`\`

- Java **checked** exceptions (IOException) must be caught or declared with \`throws\`; **unchecked** ones (RuntimeException) need not be.
- Catch the most specific exception first; never swallow errors silently.
- Raise your own when a method's rules are broken: \`raise ValueError("marks must be 0–100")\`.
`],
    ["Generics and collections", `
### Write once, type-safe for many types
A generic class works with any type while the compiler still checks it:

\`\`\`java
List<String> names = new ArrayList<>();
names.add("Ayesha");
String first = names.get(0);   // no cast needed
\`\`\`

Type parameters are usually single letters: \`T\` (type), \`E\` (element), \`K\`/\`V\` (key/value). Generic methods declare their own: \`static <T> T firstOf(List<T> xs)\`.

### The collections framework
| Need | Interface | Common class |
| --- | --- | --- |
| Ordered, duplicates allowed | List | ArrayList, LinkedList |
| No duplicates | Set | HashSet, TreeSet |
| Key → value | Map | HashMap, TreeMap |
| First in, first out | Queue | ArrayDeque |
`],
    ["Streams and file I/O", `
### Java I/O streams
Data flows through **streams**: \`InputStream\`/\`OutputStream\` for bytes, \`Reader\`/\`Writer\` for characters. Wrap them to add features: \`BufferedReader\` reads lines efficiently, \`DataOutputStream\` writes primitive types.

\`\`\`java
try (BufferedReader in = new BufferedReader(new FileReader("marks.txt"))) {
    String line;
    while ((line = in.readLine()) != null) { ... }
}
\`\`\`

The **try-with-resources** form closes the file even if an exception happens. Python's \`with open("marks.txt") as f:\` does the same.
`],
  ]),
  assignments: [
    lab({
      key: "oop-account", course: C, week: 2, language: "python", title: "A Bank Account Class", ...closed(4), marks: 10,
      instructions: "Model a mobile-wallet account.\n\nWrite a class `Account`:\n- The constructor takes `owner` and an optional starting `balance` (default 0).\n- `deposit(amount)`: adds a positive amount and returns the new balance; for an amount of 0 or less, returns `False` and changes nothing.\n- `withdraw(amount)`: subtracts and returns the new balance, or returns `False` (changing nothing) if the amount is 0 or less or more than the balance.\n- `describe()`: returns a string like `'Omar: Rs 1000'`.\n- A class attribute `count` that goes up by one every time an account is created.\n\n*In Java you would write two constructors (overloading); in Python one constructor with a default argument does the same job.*",
      starterCode: "class Account:\n    count = 0\n\n    def __init__(self, owner, balance=0):\n        pass\n\n\nwallet = Account(\"Omar\", 1000)\nprint(wallet.describe())\n",
      referenceSolution: "class Account:\n    count = 0\n\n    def __init__(self, owner, balance=0):\n        self.owner = owner\n        self.balance = balance\n        Account.count += 1\n\n    def deposit(self, amount):\n        if amount <= 0:\n            return False\n        self.balance += amount\n        return self.balance\n\n    def withdraw(self, amount):\n        if amount <= 0 or amount > self.balance:\n            return False\n        self.balance -= amount\n        return self.balance\n\n    def describe(self):\n        return f\"{self.owner}: Rs {self.balance}\"\n",
      tests: [
        { name: "Deposit returns the new balance", call: "Account(\"Sara\", 100).deposit(200)" },
        { name: "Can't overdraw", call: "Account(\"Ali\", 500).withdraw(600)" },
        { name: "Default balance", call: "Account(\"Hina\").balance" },
        { name: "Describe", call: "Account(\"Omar\", 1000).describe()" },
        { name: "Several operations in a row", call: "(lambda a: (a.deposit(50), a.withdraw(30), a.withdraw(0), a.balance))(Account(\"Zainab\"))" },
        { name: "Count goes up by one", call: "(lambda before: Account(\"Usman\") and Account.count - before)(Account.count)" },
      ],
    }),
    lab({
      key: "oop-shapes", course: C, week: 4, language: "python", title: "Shapes: Inheritance and Overriding", ...closed(2), marks: 10,
      instructions: "Build a small class hierarchy for a geometry tutor.\n\n- `Shape`: a class attribute `name = \"Shape\"`, `area()` returning `0`, and `describe()` returning `f\"{name} with area {area rounded to 2 decimals}\"`.\n- `Rectangle(Shape)`: constructor `(w, h)`; overrides `area()`.\n- `Square(Rectangle)`: constructor `(side)` that calls the parent constructor with `super()`.\n- `Circle(Shape)`: constructor `(r)`; area uses `math.pi`.\n- Each subclass sets its own `name`.\n- A function `total_area(shapes)`: the sum of the areas, rounded to 2 decimals.\n\nWrite `describe()` **once**, in `Shape`: polymorphism should do the rest.",
      starterCode: "import math\n\n\nclass Shape:\n    name = \"Shape\"\n\n    def area(self):\n        return 0\n\n    def describe(self):\n        pass\n\n\n# Rectangle, Square and Circle go here\n\n\ndef total_area(shapes):\n    pass\n",
      referenceSolution: "import math\n\n\nclass Shape:\n    name = \"Shape\"\n\n    def area(self):\n        return 0\n\n    def describe(self):\n        return f\"{self.name} with area {round(self.area(), 2)}\"\n\n\nclass Rectangle(Shape):\n    name = \"Rectangle\"\n\n    def __init__(self, w, h):\n        self.w, self.h = w, h\n\n    def area(self):\n        return self.w * self.h\n\n\nclass Square(Rectangle):\n    name = \"Square\"\n\n    def __init__(self, side):\n        super().__init__(side, side)\n\n\nclass Circle(Shape):\n    name = \"Circle\"\n\n    def __init__(self, r):\n        self.r = r\n\n    def area(self):\n        return math.pi * self.r * self.r\n\n\ndef total_area(shapes):\n    return round(sum(s.area() for s in shapes), 2)\n",
      tests: [
        { name: "A square describes itself", call: "Square(3).describe()" },
        { name: "A circle", call: "Circle(1).describe()" },
        { name: "A square is a rectangle", call: "isinstance(Square(2), Rectangle)" },
        { name: "Polymorphism in a list", call: "total_area([Rectangle(2, 3), Square(2), Circle(1)])" },
        { name: "The base shape", call: "Shape().describe()" },
      ],
    }),
    written({
      key: "oop-hostel", course: C, week: 5, title: "Composition or Inheritance? Model a Hostel", ...closed(1), marks: 10,
      instructions: "Your university wants software for its hostels. A **Hostel** has **Rooms**; each Room has up to 3 **Students**; there are **Wardens**, and both Students and Wardens are **People** with a name and CNIC.\n\nIn **150–250 words**:\n1. List the classes and say, for each relationship, whether it is **is-a** (inheritance) or **has-a** (composition), and why.\n2. Pick one place where a classmate might wrongly use inheritance, and explain what would go wrong.\n3. Name one method that should be **overridden** and one field that should be **private**, with a reason for each.",
    }),
    quiz({
      key: "oop-quiz", course: C, week: 5, title: "Quiz: Constructors to Equality (Java)", ...open(4, 2), marks: 10,
      instructions: "A short timed quiz on weeks 1–6, with Java code to read. One question at a time; you can't go back.",
      quiz: {
        draw: 6, timeLimitMinutes: 7, fullscreen: true,
        questions: [
          { kind: "mcq", prompt: "`Fraction a = new Fraction(1, 2); Fraction b = new Fraction(1, 2);` What is `a == b`?", options: ["true", "false", "A compile error", "It depends on equals()"], correct: 1 },
          { kind: "mcq", prompt: "You override `equals()` but not `hashCode()`. What breaks?", options: ["Nothing", "Objects can't be printed", "HashSet and HashMap may treat equal objects as different", "The class won't compile"], correct: 2 },
          { kind: "mcq", prompt: "Two methods named `add(int a, int b)` and `add(double a, double b)` in one class are an example of:", options: ["Overriding", "Overloading", "Inheritance", "Encapsulation"], correct: 1 },
          { kind: "mcq", prompt: "Where must `super(...)` appear in a Java constructor?", options: ["Anywhere", "As the first statement", "As the last statement", "Only in abstract classes"], correct: 1 },
          { kind: "mcq", prompt: "A `static` field is:", options: ["One copy per object", "One copy shared by all objects of the class", "A constant that can't change", "Visible only in one method"], correct: 1 },
          { kind: "mcq", prompt: "Which is a has-a relationship?", options: ["Square and Rectangle", "Car and Engine", "SavingsAccount and Account", "Dog and Animal"], correct: 1 },
          { kind: "mcq", prompt: "After a shallow copy of an array of Student objects, you change a student's name in the copy. The original:", options: ["Is unchanged", "Also shows the new name", "Throws an exception", "Becomes null"], correct: 1 },
          { kind: "short", prompt: "Which Java keyword declares that a method may throw a checked exception? (One word.)", accepted: ["throws"] },
          { kind: "short", prompt: "Which access modifier makes a field visible only inside its own class? (One word.)", accepted: ["private"] },
        ],
      },
    }),
    lab({
      key: "oop-fraction", course: C, week: 6, language: "python", title: "Equality vs Identity: A Fraction Class", ...open(5), marks: 10,
      instructions: "Build a `Fraction` class that behaves like a proper value type.\n\n- `Fraction(num, den)` stores the fraction **in lowest terms** with a positive denominator: `Fraction(6, -8)` is `-3/4`. A zero denominator raises `ZeroDivisionError`.\n- `__repr__` returns text like `3/4`.\n- `__eq__`: two fractions are equal if they have the same value (`Fraction(1, 2) == Fraction(2, 4)`); comparing with anything that isn't a Fraction returns `False`.\n- `__hash__`, consistent with `__eq__`, so fractions work in sets and as dict keys.\n- `__add__` returns a new Fraction.\n\nThis is Java's `equals()`/`hashCode()` contract in Python form; the viva will ask why both are needed.",
      starterCode: "from math import gcd\n\n\nclass Fraction:\n    def __init__(self, num, den):\n        pass\n\n\nprint(Fraction(2, 4) == Fraction(1, 2))\n",
      referenceSolution: "from math import gcd\n\n\nclass Fraction:\n    def __init__(self, num, den):\n        if den == 0:\n            raise ZeroDivisionError('denominator is zero')\n        if den < 0:\n            num, den = -num, -den\n        g = gcd(num, den) or 1\n        self.num, self.den = num // g, den // g\n\n    def __repr__(self):\n        return f\"{self.num}/{self.den}\"\n\n    def __eq__(self, other):\n        return isinstance(other, Fraction) and self.num == other.num and self.den == other.den\n\n    def __hash__(self):\n        return hash((self.num, self.den))\n\n    def __add__(self, other):\n        return Fraction(self.num * other.den + other.num * self.den, self.den * other.den)\n",
      tests: [
        { name: "Equal values", call: "Fraction(1, 2) == Fraction(2, 4)" },
        { name: "But not the same object", call: "Fraction(1, 2) is Fraction(1, 2)" },
        { name: "Lowest terms, sign on top", call: "Fraction(6, -8)" },
        { name: "Adding", call: "Fraction(1, 2) + Fraction(1, 3)" },
        { name: "Sets use the hash", call: "len({Fraction(1, 2), Fraction(2, 4), Fraction(3, 4)})" },
        { name: "Not equal to a float", call: "Fraction(1, 2) == 0.5" },
      ],
    }),
    lab({
      key: "oop-marks", course: C, week: 7, language: "python", title: "A Safe Marks Parser with Exceptions", ...draft(1), marks: 10,
      instructions: "Write `parse_marks(text)` that turns a line like `\"Ayesha, 87\"` into `('Ayesha', 87)`. Raise `ValueError` with a clear message if the line has no comma, the marks aren't a whole number, or they're outside 0–100. Then write `parse_all(lines)` returning `(valid, errors)`: the parsed tuples, and the line numbers (starting at 1) that failed.",
      starterCode: "def parse_marks(text):\n    pass\n\n\ndef parse_all(lines):\n    pass\n",
      referenceSolution: "def parse_marks(text):\n    if ',' not in text:\n        raise ValueError('expected \"name, marks\"')\n    name, marks = (p.strip() for p in text.split(',', 1))\n    try:\n        value = int(marks)\n    except ValueError:\n        raise ValueError('marks must be a whole number')\n    if not 0 <= value <= 100:\n        raise ValueError('marks must be between 0 and 100')\n    return (name, value)\n\n\ndef parse_all(lines):\n    valid, errors = [], []\n    for i, line in enumerate(lines, start=1):\n        try:\n            valid.append(parse_marks(line))\n        except ValueError:\n            errors.append(i)\n    return (valid, errors)\n",
      tests: [
        { name: "A good line", call: "parse_marks(\"Ayesha, 87\")" },
        { name: "Mixed lines", call: "parse_all([\"Ali, 90\", \"Sara 70\", \"Omar, abc\", \"Hina, 101\", \"Zainab, 0\"])" },
        { name: "Empty file", call: "parse_all([])" },
      ],
    }),
  ],
  announcements: [
    { course: C, title: "Fraction lab is open", body: "This one connects week 6's equality lecture to code. Make sure you can explain why equal objects need equal hash codes.", postedDaysAgo: 3 },
    { course: C, title: "Quiz: Java code reading", body: "Seven minutes, six questions with short Java snippets. Practise predicting what == and equals() return.", postedDaysAgo: 2 },
    { course: C, title: "Labs run in Python", body: "Our lectures use Java; the labs run in Python inside Socratic AI, so there's nothing to install. Every lab says where Java would differ.", postedDaysAgo: 20 },
  ],
};
