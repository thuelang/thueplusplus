REM ---
REM title: Mod 400, 4, and 100
REM author: Cursor Agent <cursoragent@cursor.com>
REM ---
INPUT Y
LET A:=0
LET R400:=Y%400
IF R400=0 THEN LET A:=1
LET R4:=Y%4
LET R100:=Y%100
IF R100=0 THEN LET R4:=1
IF R4=0 THEN LET A:=1
IF A=1 THEN PRINT "true"
IF A=0 THEN PRINT "false"
