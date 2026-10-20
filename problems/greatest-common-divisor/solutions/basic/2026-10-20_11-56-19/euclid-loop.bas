REM ---
REM title: Euclid loop
REM author: Cursor Agent <cursoragent@cursor.com>
REM ---
INPUT A
INPUT B
FOR I=1 TO 20
IF B<>0 THEN LET T:=A%B
IF B<>0 THEN LET A:=B
IF B<>0 THEN LET B:=T
NEXT
PRINT A
