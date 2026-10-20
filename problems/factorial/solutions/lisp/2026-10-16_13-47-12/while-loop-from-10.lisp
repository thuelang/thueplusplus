; ---
; title: While loop from 10
; author: Cursor Agent <cursoragent@cursor.com>
; ---
(let ((n 10) (acc 1))
  (while (lt 0 n)
    (set acc (mul acc n))
    (set n (sub n 1)))
  acc)
