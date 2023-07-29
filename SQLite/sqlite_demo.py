#Constructed using Corey Schafer's SQLite Tutorial on YouTube:
#https://www.youtube.com/watch?v=pd-0G0MigUA

#included in standard library, can just import
import sqlite3
from employee import Employee

#creates .db database file in root directory; unreadable by humans
#conn = sqlite3.connect('employee.db')

#If instead of creating a .db file you'd like to create a database in RAM:
#better for testing over and over without repeated create/delete
conn = sqlite3.connect(':memory:')

#assigns to c a cursor pointing to the table
c = conn.cursor()

"""
You can do this without a docstring, but the python documentation uses a docstring.
SQLite documentation provides 5 data types: NULL, INTEGER, REAL, TEXT, BLOB
Notably, integers are stored in <8 bytes, reals are 8-byte IEEE floats, 
text is stored with the database encoding (UTF-8, UTF-16BE or UTF-16LE), and 
blobs are stored exactly as they are input.
"""
c.execute("""CREATE TABLE employees (
           first text,
           last text,
           pay integer
           )""")



#CREATE: add a row to the database manually
c.execute("INSERT INTO employees VALUES ('Cooper','Reed',75000)")
c.execute("INSERT INTO employees VALUES ('Zorn','Reed',100000000)")

#DO NOT USE - this is vulnerable to SQL injection attacks
#c.execute("INSERT INTO employees VALUES ('{}', '{}', {})".format(e1.first, e1.last, e1.pay))
#better execution, but not the best form (best form below)
#c.execute("INSERT INTO employees VALUES (?, ?, ?)", (e1.first, e1.last, e1.pay))

#CREATE
def insert_e(emp):
    #use the with conn contextmanager to avoid needing to conn.commit() after every action
    with conn:
        c.execute("INSERT INTO employees VALUES (:first, :last, :pay)", 
                    {'first': emp.first, 'last':emp.last, 'pay':emp.pay})

#READ
#doesn't need "with" or commit; no contextmanager like insert/update/delete
def get_e_by_name(lastname):
    #alternatively, use WHERE last='Zapper' for direct value retrieval instead of placeholder
    c.execute("SELECT * FROM employees WHERE last=:last", {'last':lastname})
    #alternately, use .fetchone() or .fetchmany(int) to fetch one or int rows
    return c.fetchall()

#UPDATE
def update_pay(emp, pay):
    with conn:
        c.execute("""UPDATE employees SET pay = :pay 
                  WHERE first = :first AND last = :last""",
                  {'first':emp.first, 'last':emp.last, 'pay':pay})

#DELETE
def remove_emp(emp):
    with conn:
        c.execute("DELETE from employees WHERE first = :first AND last = :last",
                  {'first':emp.first, 'last':emp.last})
        
"""
Sample run; if run without edits, output should mirror: 
[('Zeg', 'Zapper', 90000), ('Zunn', 'Zapper', 100000)] 
[('Zunn', 'Zapper', 700000)]
"""
e1 = Employee('Zeg', 'Zapper', 90000)
e2 = Employee('Zunn','Zapper', 100000)
insert_e(e1)
insert_e(e2)
es = get_e_by_name('Zapper')
print(es)
update_pay(e2,700000)
remove_emp(e1)
es = get_e_by_name('Zapper')
print(es)

#commits current transaction to database, and closes connection.
conn.commit()
conn.close()