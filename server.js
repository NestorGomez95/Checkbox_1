const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const usePostgres = true;
const pool = usePostgres ? new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Checkbox_db',
    password: 'Lemichu2021', // This is my personal password, please replace it with your own for pgAdmin 
    port: 5432,
}) : null;

const redisClient = usePostgres ? null : redis.createClient({
    host: 'localhost',
    port: 6379
});

const createTableIfNotExists = async () => {
    if (usePostgres) {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS checkbox_state (
                    id SERIAL PRIMARY KEY,
                    checkbox_id VARCHAR(255) NOT NULL,
                    checked BOOLEAN NOT NULL,
                    CONSTRAINT unique_checkbox_id UNIQUE (checkbox_id)
                );
            `);
            console.log('Table is ready');
        } catch (err) {
            console.error('Error creating table', err);
        }
    }
};

app.use(express.static('public'));

let checkboxes = {};
let count = 0;

const loadCheckboxesFromPostgres = async () => {
    try {
        const res = await pool.query('SELECT checkbox_id, checked FROM checkbox_state');
        res.rows.forEach(row => {
            checkboxes[row.checkbox_id] = row.checked;
            if (row.checked) count++;
        });
        console.log('Loaded checkboxes from PostgreSQL');
    } catch (err) {
        console.error('Error loading checkboxes from PostgreSQL', err);
    }
};

const saveCheckboxToPostgres = async (id, checked) => {
    try {
        await pool.query(`
            INSERT INTO checkbox_state (checkbox_id, checked)
            VALUES ($1, $2)
            ON CONFLICT (checkbox_id)
            DO UPDATE SET checked = EXCLUDED.checked;
        `, [id, checked]);
        console.log(`Checkbox ${id} set to ${checked}`);
    } catch (err) {
        console.error('Error saving checkbox to PostgreSQL', err);
    }
};

const loadCheckboxesFromRedis = async () => {
    try {
        redisClient.hgetall('checkbox_state', (err, obj) => {
            if (err) {
                console.error('Error loading checkboxes from Redis', err);
            } else {
                checkboxes = obj || {};
                count = 0;
                for (let key in checkboxes) {
                    checkboxes[key] = checkboxes[key] === 'true';
                    if (checkboxes[key]) count++;
                }
                console.log('Loaded checkboxes from Redis');
            }
        });
    } catch (err) {
        console.error('Error loading checkboxes from Redis', err);
    }
};

const saveCheckboxToRedis = async (id, checked) => {
    try {
        redisClient.hset('checkbox_state', id, checked.toString());
        console.log(`Checkbox ${id} set to ${checked}`);
    } catch (err) {
        console.error('Error saving checkbox to Redis', err);
    }
};

const initialize = async () => {
    await createTableIfNotExists();
    if (usePostgres) {
        await loadCheckboxesFromPostgres();
    } else {
        await loadCheckboxesFromRedis();
    }
};

io.on('connection', (socket) => {
    socket.emit('init', { checkboxes, count });
    socket.on('checkboxChange', (data) => {
        const { id, checked } = data;
        checkboxes[id] = checked;
        if (checked) {
            count++;
        } else {
            count--;
        }
        if (usePostgres) {
            saveCheckboxToPostgres(id, checked);
        } else {
            saveCheckboxToRedis(id, checked);
        }
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
