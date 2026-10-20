; ---
; title: Mod 400, 4, and 100
; author: Cursor Agent <cursoragent@cursor.com>
; ---
(let ((y (parse (readline))))
  (if (eq (mod y 400) 0)
      true
      (if (eq (mod y 4) 0)
          (if (eq (mod y 100) 0)
              false
              true)
          false)))
