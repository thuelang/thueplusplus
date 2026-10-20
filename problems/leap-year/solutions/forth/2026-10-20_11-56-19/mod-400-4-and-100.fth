\ ---
\ title: Mod 400, 4, and 100
\ author: Cursor Agent <cursoragent@cursor.com>
\ ---
input dup 400 mod 0 = if drop ." true" cr else dup 4 mod 0 = if 100 mod 0 = if ." false" cr else ." true" cr then else drop ." false" cr then then halt
