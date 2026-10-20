export const sandboxGuides = [
  {
    id: 'forth',
    purpose: 'A Forth-style stack machine written as Thue++ rules. The program is whitespace-delimited tokens on --input.',
    useCases: [
      'Stack arithmetic and comparisons',
      'Printing text and numbers, and reading one line as an integer or a string',
    ],
    strengths: [
      'A program that never prints leaves the data stack, top first',
      'begin/until and if/else/then',
    ],
    command: "uv run thue langs/forth/forth.thue --input '1 2 +'",
    readmeSections: [],
    examples: [
      {
        name: 'Addition',
        input: '1 2 +',
        output: '3\n',
        program: 'langs/forth/forth.thue',
        args: ['--input', '1 2 +'],
        stdout: '3\n',
        stderr: '',
        exit: 0,
      },
      {
        name: 'Stack',
        input: '1 2 3',
        output: '3 2 1\n',
        program: 'langs/forth/forth.thue',
        args: ['--input', '1 2 3'],
        stdout: '3 2 1\n',
        stderr: '',
        exit: 0,
      },
    ],
  },
  {
    id: 'lisp',
    purpose: 'A Lisp evaluator written as Thue++ rules. The program is --input.',
    useCases: [
      'Arithmetic, lexical bindings, and lists',
      'Exact stdout through emit and finish',
    ],
    strengths: [
      'Closures and code as data',
      'emit writes raw text and finish exits before the value is rendered',
    ],
    command: "uv run thue langs/lisp/lisp.thue --input '(let ((x 10)) (sub x 3))'",
    readmeSections: [],
    examples: [
      {
        name: 'Subtraction',
        input: '(let ((x 10)) (sub x 3))',
        output: '7\n',
        program: 'langs/lisp/lisp.thue',
        args: ['--input', '(let ((x 10)) (sub x 3))'],
        stdout: '7\n',
        stderr: '',
        exit: 0,
      },
      {
        name: 'emit',
        input: '(let () (emit "hi\\n") (finish))',
        output: 'hi\n',
        program: 'langs/lisp/lisp.thue',
        args: ['--input', '(let () (emit "hi\\n") (finish))'],
        stdout: 'hi\n',
        stderr: '',
        exit: 0,
      },
    ],
  },
  {
    id: 'basic',
    purpose: 'A line-oriented BASIC interpreter written as Thue++ rules. The program is --input. Keywords and names are uppercase. One statement per line.',
    useCases: [
      'PRINT, LET, INPUT, IF/THEN, and FOR/NEXT',
    ],
    strengths: [
      'Integer arithmetic with one operator',
      'A true IF becomes that statement, so conditions can nest',
    ],
    command: 'uv run thue langs/basic/basic.thue --input \'PRINT "Hello, World!"\'',
    readmeSections: [],
    examples: [
      {
        name: 'PRINT',
        input: 'PRINT "Hello, World!"',
        output: 'Hello, World!\n',
        program: 'langs/basic/basic.thue',
        args: ['--input', 'PRINT "Hello, World!"'],
        stdout: 'Hello, World!\n',
        stderr: '',
        exit: 0,
      },
      {
        name: 'LET',
        input: 'LET N:=2\nPRINT N',
        output: '2\n',
        program: 'langs/basic/basic.thue',
        args: ['--input', 'LET N:=2\nPRINT N'],
        stdout: '2\n',
        stderr: '',
        exit: 0,
      },
    ],
  },
  {
    id: 'expr',
    purpose: 'An expression interpreter for everyday arithmetic, comparisons, booleans, and environment lookup. The expression is --line:expr. The environment is --line:env, a JSON object.',
    useCases: [
      'One expression in, one JSON value out',
      'Names looked up in the environment',
    ],
    strengths: [
      'Lazy &&, ||, !, ternary, and ??',
      'Errors are short codes on stderr, and the exit code is 2',
    ],
    command: "thue langs/expr/expr.thue --line:expr 'foo + 1' --line:env '{\"foo\":2}'",
    readmeSections: ['Resources', 'What works', 'Errors', 'Known differences'],
    examples: [
      {
        name: 'Environment',
        input: 'expr: foo + 1\nenv: {"foo":2}',
        output: '3\n',
        program: 'langs/expr/expr.thue',
        args: ['--line:expr', 'foo + 1', '--line:env', '{"foo":2}'],
        stdout: '3\n',
        stderr: '',
        exit: 0,
      },
      {
        name: 'Comparison chain',
        input: 'expr: 1 < 2 < 3\nenv: {}',
        output: 'true\n',
        program: 'langs/expr/expr.thue',
        args: ['--line:expr', '1 < 2 < 3', '--line:env', '{}'],
        stdout: 'true\n',
        stderr: '',
        exit: 0,
      },
      {
        name: 'Division by zero',
        input: 'expr: 1 / 0\nenv: {}',
        output: 'division_by_zero',
        program: 'langs/expr/expr.thue',
        args: ['--line:expr', '1 / 0', '--line:env', '{}'],
        stdout: '',
        stderr: 'division_by_zero',
        exit: 2,
      },
    ],
  },
]

export function guideFor(id) {
  const guide = sandboxGuides.find(item => item.id === id)
  if (!guide) throw new Error(`sandbox ${id} has no guide`)
  return guide
}

export function readmeSection(markdown, heading) {
  const lines = markdown.split('\n')
  const start = lines.findIndex(line => line === `## ${heading}`)
  if (start < 0) throw new Error(`missing section ${heading}`)
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      end = index
      break
    }
  }
  const section = lines.slice(start, end).join('\n').trim()
  if (section.length === 0) throw new Error(`section ${heading} is empty`)
  return section
}
