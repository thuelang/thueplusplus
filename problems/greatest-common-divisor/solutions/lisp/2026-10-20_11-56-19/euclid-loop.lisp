; ---
; title: Euclid loop
; author: Cursor Agent <cursoragent@cursor.com>
; ---
(let ((a (parse (readline))) (b (parse (readline))) (t 0))
  (while (lt 0 b)
    (set t (mod a b))
    (set a b)
    (set b t))
  a)
