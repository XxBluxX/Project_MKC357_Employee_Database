const express = require('express');
const bodyParser = require('body-parser');
const pg = require('pg');
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const site = express();

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "employee-db",
    password: "59aLkn67mp9",
    port: 5432
});
db.connect();

site.set('view engine', 'ejs');
site.use(express.static('public'));
site.use(bodyParser.urlencoded({extended: true}));

site.use(session({
    secret: 'key',
    resave: false,
    saveUninitialized: true
}));

site.use(passport.initialize());
site.use(passport.session());

passport.use(new LocalStrategy( async (email, password, cb) => {
        try {
            const result = await db.query('SELECT * FROM employees WHERE e_email = $1', [email]);
            const user = result.rows[0];
            if (!user) return cb(null, false);
            if (user.password !== password) return cb(null, false);
            return cb(null, user)
        } catch (err) {
            return cb(err);
        }
    }
))

passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});




site.get('/', (req, res) => {
    res.render('login-page');
});

site.get('/login-page', (req, res) => {
    res.render('login-page');
});

site.get('/admin-home', async (req, res) => {
    if (req.isAuthenticated()) {
        const employees = await db.query('SELECT * FROM employees');
        res.render('admin-home', { employees: employees.rows });
    } else {
        res.render('login-page');
    }
});

site.get('/add-employee', (req, res) => {
    res.render('add-employee');
});

site.get('/edit/:id', passport.authenticate('local'), async (req, res) => {
    const id = req.params.id;
    const employee = await db.query('SELECT * FROM employees WHERE e_id = $1', [id]);
    res.render('edit', { employee: employee.rows[0] });
})

site.get('/employee-home', passport.authenticate('local'), async (req, res) => {
    const id = req.user.e_id;
    const employee = await db.query('SELECT * FROM employees WHERE e_id = $1', [id]);
    res.render('employee-home', { employee: employee.rows[0] });
});


site.post('/login-page', passport.authenticate('local', {
        successRedirect: '/employee-home',
        failureRedirect: '/login-page'
    })
);

site.post('/delete/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM employees WHERE e_id = $1', [id]);
    res.redirect('/admin-home');
});

site.post('/edit/:id', passport.authenticate('local'), async (req, res) => {
    const id = req.params.id;
    const user = req.user.admin
    const {fname, lname, yearsales, years, totalsales} = req.body;

    await db.query('UPDATE employees SET fname = $1, lname $2, yearsales = $3, years = $4, totalsales = $5 WHERE e_id = $6', [fname, lname, yearsales, years, totalsales, id]);
    if (user) {
        res.redirect('/admin-home');
    } else {
        res.redirect('/employee-home');
    }
});

site.post('/add-employee', async (req, res) => {
    try {
        const {email, password, admin, fname, lname, yearsales, years, totalsales} = req.body;
        await db.query('INSERT INTO employees (e_email, e_password, e_admin, e_fname, e_lname, e_yearsales, e_years, e_totalsales) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [email, password, admin, fname, lname, yearsales, years, totalsales]);
        res.redirect('/admin-home');
    } catch(err) {
        console.log(err);
    }
});




site.listen(3000, () => {
    console.log('server running at port 3000');
});