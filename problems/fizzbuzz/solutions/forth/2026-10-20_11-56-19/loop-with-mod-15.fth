\ ---
\ title: Loop with mod 15
\ author: Cursor Agent <cursoragent@cursor.com>
\ ---
input 0 begin 1 + over over < if drop drop true else dup 15 mod 0 = if ." FizzBuzz" else dup 3 mod 0 = if ." Fizz" else dup 5 mod 0 = if ." Buzz" else dup . then then then cr false then until halt
