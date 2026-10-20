\ ---
\ title: Loop with input
\ author: Cursor Agent <cursoragent@cursor.com>
\ ---
input 1 swap begin dup 0 = if drop . cr true else swap over * swap 1 - false then until halt
