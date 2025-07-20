/* For this project I chose to use express of course, bodyparser even though there is a version built into express, pg for my postgreSQL database, passport, express-session, and passport local to track the current user to help determine if they are an admin or basic employee */
const express = require('express');
const bodyParser = require('body-parser');
const pg = require('pg');
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const site = express();

/* Here I set up my database and connect to it */
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "employee-db",
    password: "59aLkn67mp9",
    port: 5432
});
db.connect();

/* set the view engine to ejs to render the ejs files that makeup each page of the site, set the public folder to serve static files such as the styles.css, allow me to use bodyparser to collect information from post method forms. */
site.set('view engine', 'ejs');
site.use(express.static('public'));
site.use(bodyParser.urlencoded({extended: true}));

/* initialize session middleware */
site.use(session({
    secret: 'key',
    resave: false,
    saveUninitialized: true
}));

/* initialize passport for authentication, and use persisting login sessions with passport */
site.use(passport.initialize());
site.use(passport.session());


/* serialize and deserialize the user into and from the session */
passport.serializeUser((user, cb) => {
    cb(null, user.e_id);
});

passport.deserializeUser(async (id, cb) => {
    try {
        const result = await db.query('SELECT * FROM employees WHERE e_id = $1', [id]);
        const user = result.rows[0];
        if (!user){
            return cb(null, false);
        }
        cb(null, user);
    } catch(err) {
        cb(err);
    }
});




/* all the get requests, the starting page being the login, the admin home which requires the database of employees to display for the admin to edit delete and add as needed, the edit page which is processed with the id of the employee being edited so that it may populate the information in the edit form, the employee home which finds which user is signed in and then displays that users information and allows it to be edited */
site.get('/', (req, res) => {
    res.render('login-page');
});

site.get('/login-page', (req, res) => {
    res.render('login-page');
});

site.get('/admin-home', ensureAuthenticated, async (req, res) => {
    admin = req.user.e_admin;
    if (admin) {
        const employees = await db.query('SELECT * FROM employees ORDER BY e_id ASC');
        res.render('admin-home', { employees: employees.rows });
    } else {
        res.redirect('/employee-home');
    }
});

site.get('/add-employee', ensureAuthenticated, (req, res) => {
    admin = req.user.e_admin;
    if (admin) {
        return res.render('add-employee');
    }
    res.redirect('/login-page');
});

site.get('/edit/:id', ensureAuthenticated, async (req, res) => {
    const id = req.params.id;
    const employee = await db.query('SELECT * FROM employees WHERE e_id = $1', [id]);
    res.render('edit', { employee: employee.rows[0] });
})

site.get('/employee-home', ensureAuthenticated, async (req, res) => {
    const id = req.user.e_id;
    const employee = await db.query('SELECT * FROM employees WHERE e_id = $1', [id]);
    res.render('employee-home', { employee: employee.rows[0] });
});

site.get('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) {
            return next(err);
        }
        res.redirect('/login-page');
    })
});


/* then the post requests, this first one having problems due to errors in my code that I am hopefully able to fix by the next phase, the delete request which takes parameters of the employee being requested to be removed from the database, the edit post request which updates the information in the database with the new inputted information, and finally the add employee request which takes the information from the form and inputs it into the database as a new record */
site.post('/login-page', passport.authenticate('local', {
        successRedirect: '/employee-home',
        failureRedirect: '/login-page'
    })
);

site.post('/delete/:id', async (req, res) => {
    const id = req.params.id;
    await db.query('DELETE FROM employees WHERE e_id = $1', [id]);
    res.redirect('/admin-home');
});

site.post('/edit/:id', async (req, res) => {
    const id = req.params.id;
    const admin = req.user.e_admin
    const {fname, lname} = req.body;
    const yearsales = parseIntOrNull(req.body.yearsales);
    const years = parseIntOrNull(req.body.years);
    const totalsales = parseIntOrNull(req.body.totalsales);

    await db.query('UPDATE employees SET e_fname = $1, e_lname = $2, e_yearsales = $3, e_years = $4, e_totalsales = $5 WHERE e_id = $6', [fname, lname, yearsales, years, totalsales, id]);
    if (admin) {
        res.redirect('/admin-home');
    } else {
        res.redirect('/employee-home');
    }
});

site.post('/add-employee', async (req, res) => {
    try {
        const {email, password, fname, lname} = req.body;
        const yearsales = parseIntOrNull(req.body.yearsales);
        const years = parseIntOrNull(req.body.years);
        const totalsales = parseIntOrNull(req.body.totalsales);
        const admin = req.body.admin === 'true';

        await db.query('INSERT INTO employees (e_email, e_password, e_admin, e_fname, e_lname, e_yearsales, e_years, e_totalsales) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [email, password, admin, fname, lname, yearsales, years, totalsales]);
        return res.redirect('/admin-home');
    } catch(err) {
        console.log(err);
    }
});


/* configure passport with a local strategy to allow logging in with an email and password */
 passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, cb) => {
        try {
            /* find the employee data where the email matches then store that in a variable */
            const result = await db.query('SELECT * FROM employees WHERE e_email = $1', [email]);
            const user = result.rows[0];
            /* if no results are returned use callback to convey that */
            if (!user) {
                return cb(null, false);
            }
            /* check if the entered password matches the employees stored password and if incorrect use callback to convey that */
            if (user.e_password !== password) {
                return cb(null, false);
            } else {
            /* otherwise return the user to be used with req.user to access user information */
                return cb(null, user)
            }
        } catch (err) {
            return cb(err);
        }
    }
 )); 

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login-page');
}

function parseIntOrNull(value) {
    if (value === '' || value === undefined || value === null) {
        return null;
    }
    const num = parseInt(value);
    return isNaN(num) ? null : num;
}


/* the port to set up the server on */
site.listen(3000, () => {
    console.log('server running at port 3000');
});
