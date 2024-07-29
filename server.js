const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const path = require('path');
const fs = require('fs');
const flash = require('connect-flash');
const helmet = require('helmet');

require('dotenv').config();
require('./config/passport'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const dbDir = path.join(__dirname, 'var', 'db');
const dbPath = path.join(dbDir, 'database.sqlite');


if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to the SQLite database');
        initializeDatabase();
    }
});

app.use(helmet());
app.use(express.static('public'));
app.use(session({
    secret: 'keyboard cat', 
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({ db: 'sessions.db', dir: dbDir })
}));
app.use(passport.initialize());
app.use(passport.session()); 
app.use(flash());

app.get('/favicon.ico', (req, res) => res.status(204).send());

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; font-src 'self';"
    );
    next();
});


app.use('/auth', require('./routes/auth'));


app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


const initializeDatabase = () => {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS checkbox_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                checkbox_id TEXT NOT NULL UNIQUE,
                checked BOOLEAN NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating checkbox_state table', err);
            } else {
                console.log('Checkbox state table is ready');
            }
        });
    });
};

let checkboxes = {};
let count = 0;

const loadCheckboxesFromSQLite = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT checkbox_id, checked FROM checkbox_state', [], (err, rows) => {
            if (err) {
                console.error('Error loading checkboxes from SQLite', err);
                reject(err);
            } else {
                rows.forEach(row => {
                    checkboxes[row.checkbox_id] = row.checked;
                    if (row.checked) count++;
                });
                console.log('Loaded checkboxes from SQLite');
                resolve();
            }
        });
    });
};

const saveCheckboxToSQLite = (id, checked) => {
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO checkbox_state (checkbox_id, checked)
            VALUES (?, ?)
            ON CONFLICT(checkbox_id) DO UPDATE SET checked = excluded.checked
        `, [id, checked], function(err) {
            if (err) {
                console.error('Error saving checkbox to SQLite', err);
                reject(err);
            } else {
                console.log(`Checkbox ${id} set to ${checked}`);
                resolve();
            }
        });
    });
};

const initialize = async () => {
    await new Promise((resolve) => {
        setTimeout(resolve, 1000);
    });
    await loadCheckboxesFromSQLite();
};

io.on('connection', (socket) => {
    socket.emit('init', { checkboxes, count });
    socket.on('checkboxChange', async (data) => {
        const { id, checked } = data;
        checkboxes[id] = checked;
        if (checked) {
            count++;
        } else {
            count--;
        }
        await saveCheckboxToSQLite(id, checked);
        io.emit('updateCheckboxes', { checkboxes, count });
    });
});

server.listen(3000, async () => {
    await initialize();
    console.log('Server is running on port 3000');
});


process.on('uncaughtException', (err) => {
    console.error('There was an uncaught error', err);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.info('SIGTERM signal received.');
    console.log('Closing http server.');
    server.close(() => {
        console.log('Http server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.info('SIGINT signal received.');
    console.log('Closing http server.');
    server.close(() => {
        console.log('Http server closed.');
        process.exit(0);
    });
});
