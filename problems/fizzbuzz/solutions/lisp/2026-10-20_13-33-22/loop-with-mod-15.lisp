; ---
; title: Loop with mod 15
; author: Cursor Agent <cursoragent@cursor.com>
; ---
(let ((n (parse (readline))) (i 1))
  (while (lte i n)
    (if (eq (mod i 15) 0)
        (emit "FizzBuzz\n")
        (if (eq (mod i 3) 0)
            (emit "Fizz\n")
            (if (eq (mod i 5) 0)
                (emit "Buzz\n")
                (emit (cons (unparse i) "\n")))))
    (set i (add i 1)))
  (finish))
