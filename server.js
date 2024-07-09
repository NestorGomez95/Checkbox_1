const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);


app.use(express.static('public'));


let checkboxes = {};
let count = 0;

io.on('connection', (socket) => {
    console.log('a user connected');

   
    socket.emit('updateCheckboxes', { checkboxes, count });

    
    socket.on('checkboxChange', (data) => {
        checkboxes[data.id] = data.checked;
        count = Object.values(checkboxes).filter(checked => checked).length;
        io.emit('updateCheckboxes', { checkboxes, count }); 
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
