const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to the SQLite database');
    }
});

exports.users = {
  findOrCreate: function({ googleId }, cb) {
    db.get('SELECT * FROM users WHERE googleId = ?', [googleId], (err, user) => {
      if (err) {
        return cb(err);
      }
      if (!user) {
        db.run('INSERT INTO users (googleId) VALUES (?)', [googleId], function(err) {
          if (err) {
            return cb(err);
          }
          cb(null, { id: this.lastID });
        });
      } else {
        cb(null, user);
      }
    });
  },
  findById: function(id, cb) {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
      cb(err, user);
    });
  }
};
