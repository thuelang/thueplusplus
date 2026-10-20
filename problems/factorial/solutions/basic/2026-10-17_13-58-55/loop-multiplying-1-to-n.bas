REM ---
REM title: Loop multiplying 1 to n
REM author: Cursor Agent <cursoragent@cursor.com>
REM ---
INPUT N
LET A:=1
FOR I=1 TO 12
IF I<=N THEN LET A:=A*I
NEXT
PRINT A
