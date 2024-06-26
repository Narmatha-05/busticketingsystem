const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Import UUID module for unique IDs
const app = express();
const port = 3000;

// Middleware to parse JSON and URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'statics')));

// Path to store user data
const dataFilePath = path.join(__dirname, 'data.txt');

// Create data file if it doesn't exist
if (!fs.existsSync(dataFilePath)) {
    try {
        fs.writeFileSync(dataFilePath, '[]', 'utf8');
        console.log('Created new data file at:', dataFilePath);
    } catch (err) {
        console.error('Error creating data file:', err);
    }
} else {
    console.log('Data file exists at:', dataFilePath);
}

// Function to sanitize JSON data
function sanitizeJSON(data) {
    const lines = data.split('\n');
    const jsonLines = [];
    const nonJsonLines = [];

    lines.forEach(line => {
        try {
            jsonLines.push(JSON.parse(line));
        } catch (e) {
            if (line.trim() !== '') {
                nonJsonLines.push(line);
            }
        }
    });

    return { jsonLines, nonJsonLines };
}

// Serve HTML files from the 'templates' folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.post('/submit_form', (req, res) => {
    const { action, name, email, password } = req.body;

    fs.readFile(dataFilePath, 'utf8', (err, fileData) => {
        if (err) {
            console.error(`Error reading file: ${dataFilePath}`, err);
            return res.status(500).send('Internal Server Error: Unable to read data file.');
        }

        const { jsonLines, nonJsonLines } = sanitizeJSON(fileData);

        if (action === 'signup') {
            const existingUser = jsonLines.find(user => user.email === email);
            if (existingUser) {
                return res.status(400).send('User already exists.');
            }

            const newUser = { name, email, password };
            jsonLines.push(newUser);

            const allLines = [...jsonLines.map(data => JSON.stringify(data)), ...nonJsonLines];

            fs.writeFile(dataFilePath, allLines.join('\n') + '\n', 'utf8', (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                    return res.status(500).send('Internal Server Error: Unable to write data file.');
                }

                res.status(200).json({ message: 'Sign-up successful!' });
            });
        } else if (action === 'login') {
            const user = jsonLines.find(user => user.email === email && user.password === password);
            if (user) {
                res.status(200).json({ message: 'Log in successful!', user, redirectUrl: '/frontpage' });
            } else {
                res.status(400).send('Invalid email or password.');
            }
        } else {
            res.status(400).send('Invalid action.');
        }
    });
});

// Default route to serve frontpage.html
app.get('/frontpage', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'frontpage.html'));
});

app.get('/Profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'Profile.html'));
});

// Endpoint to update user profile
app.post('/updateProfile', (req, res) => {
    const updatedUser = req.body;

    fs.readFile(dataFilePath, 'utf8', (err, fileData) => {
        if (err) {
            console.error(`Error reading file: ${dataFilePath}`, err);
            return res.status(500).send('Internal Server Error: Unable to read data file.');
        }

        const { jsonLines, nonJsonLines } = sanitizeJSON(fileData);
        const userIndex = jsonLines.findIndex(user => user.email === updatedUser.email);

        if (userIndex !== -1) {
            jsonLines[userIndex] = updatedUser;
            const allLines = [...jsonLines.map(data => JSON.stringify(data)), ...nonJsonLines];

            fs.writeFile(dataFilePath, allLines.join('\n') + '\n', 'utf8', (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                    return res.status(500).send('Internal Server Error: Unable to write data file.');
                }
                res.status(200).json({ success: true, message: 'Profile updated successfully!' });
            });
        } else {
            res.status(404).json({ success: false, message: 'User not found.' });
        }
    });
});

app.get('/FAQ', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'FAQ.html'));
});

app.get('/bus', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'bus.html'));
});

// Endpoint to handle GET request from bus.html form submission
app.get('/submit', (req, res) => {
    const { state, wait, date } = req.query;

    // Read bus data from 'bus.txt' or your data source
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading bus data:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        try {
            const jsonData = JSON.parse(data);

            // Filter buses based on user input
            const filteredData = jsonData.filter(bus => {
                return bus.state === state && bus.wait === wait && bus.date === date;
            });

            res.json(filteredData); // Send filtered bus data as JSON response
        } catch (err) {
            console.error('Error parsing JSON data:', err);
            res.status(500).send('Internal Server Error');
        }
    });
});

// Serve seat selection page
app.get('/seat', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'seat.html'));
});

app.get('/bookedSeats', (req, res) => {
    const busNumber = req.query.busNumber;
    const date = req.query.date;
    fs.readFile(dataFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read booked seats:', err);
            return res.status(500).send('Failed to read booked seats');
        }

        const { jsonLines } = sanitizeJSON(data);
        const bookedSeats = jsonLines
            .filter(booking => booking.busNumber === busNumber && booking.date === date)
            .flatMap(booking => booking.seats || []);

        res.json(bookedSeats);
    });
});

app.post('/saveSeats', (req, res) => {
    const { selectedSeats, busNumber, date } = req.body;
    const batchId = uuidv4();

    fs.readFile(dataFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read data file:', err);
            return res.status(500).json({ error: 'Failed to save selected seats' });
        }

        const { jsonLines, nonJsonLines } = sanitizeJSON(data);

        // Check if seats are already booked
        const existingBookings = jsonLines.filter(booking => 
            booking.busNumber === busNumber && booking.date === date
        );
        const alreadyBookedSeats = existingBookings.flatMap(booking => booking.seats || []);
        const conflictingSeats = selectedSeats.filter(seat => alreadyBookedSeats.includes(seat));

        if (conflictingSeats.length > 0) {
            return res.status(400).json({
                error: 'Some seats are no longer available',
                conflictingSeats: conflictingSeats
            });
        }

        // Add new booking
        const newBooking = {
            batchId,
            busNumber,
            date,
            seats: selectedSeats
        };
        jsonLines.push(newBooking);

        // Write updated data back to file
        const updatedData = [...jsonLines.map(JSON.stringify), ...nonJsonLines].join('\n') + '\n';
        fs.writeFile(dataFilePath, updatedData, 'utf8', (writeErr) => {
            if (writeErr) {
                console.error('Failed to save selected seats:', writeErr);
                return res.status(500).json({ error: 'Failed to save selected seats' });
            }
            res.status(200).json({ 
                redirectUrl: `/passenger_details?seats=${encodeURIComponent(JSON.stringify(selectedSeats))}&busNumber=${encodeURIComponent(busNumber)}&date=${encodeURIComponent(date)}`
            });
        });
    });
});

// Serve passenger_details page
app.get('/passenger_details', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'passenger_details.html'));
    });


app.post('/savePassengerDetails', (req, res) => {
    const passengerDetails = req.body.passengers;
    const batchId = uuidv4(); // Unique identifier for this batch of passenger details
    let overallTotalAmount = 0;

    // Create data string for new passenger details
    const newData = passengerDetails.map(passenger => {
        let ticketPrice;
        if (passenger.age >= 4 && passenger.age <= 12) {
            ticketPrice = 12;
        } else if (passenger.age >= 13 && passenger.age <= 59) {
            ticketPrice = 22;
        } else {
            ticketPrice = 0;
        }

        let foodTotalAmount = 0;
        let foodOrder = {};
        for (let foodItem in passenger.food) {
            if (passenger.food[foodItem]) {
                const foodQuantity = passenger.food[foodItem];
                const foodPrice = getPrice(foodItem);
                foodTotalAmount += foodQuantity * foodPrice;
                foodOrder[foodItem] = foodQuantity;
            }
        }

        let totalPrice = ticketPrice + foodTotalAmount;
        overallTotalAmount += totalPrice;

        return `BatchId: ${batchId}, Seat: ${passenger.seat}, Name: ${passenger.name}, Age: ${passenger.age}, Ticket Price: MYR ${ticketPrice}, Food Order: ${JSON.stringify(foodOrder)}, Total Amount: MYR ${totalPrice}\n`;
    }).join('');

    // Append new data to data.txt
    fs.appendFile('data.txt', newData, 'utf8', (err) => {
        if (err) {
            console.error('Failed to save passenger details:', err);
            return res.status(500).send('Failed to save passenger details');
        }

        // Set latestBatchId after saving data
        latestBatchId = batchId;

        console.log('Passenger details saved successfully');
        res.status(200).send(overallTotalAmount.toFixed(2));
    });
});



// Serve payment page
app.get('/payment', (req, res) => {
res.sendFile(path.join(__dirname, 'templates', 'payment.html'));
});

// Handle payment submission
app.post('/payment', (req, res) => {
res.redirect('/receipt');
});

// Endpoint to serve receipt
app.get('/receipt', (req, res) => {
    fs.readFile('data.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read passenger details:', err);
            return res.status(500).send('Failed to generate invoice');
        }

        const passengers = data.split('\n').filter(line => line.trim() !== '');

        // Ensure latestBatchId is defined before filtering
        if (!latestBatchId) {
            console.error('latestBatchId is not defined');
            return res.status(500).send('Failed to generate invoice');
        }

        const filteredPassengers = passengers.filter(passenger => passenger.includes(`BatchId: ${latestBatchId}`));

        let overallTotalAmount = 0;
        const receiptRows = filteredPassengers.map(passenger => {
            const details = passenger.split(', ');
            const totalPriceStr = details.find(detail => detail.includes('Total Amount: MYR'));
            const totalPrice = parseFloat(totalPriceStr.split('Total Amount: MYR ')[1]);
            overallTotalAmount += totalPrice;

            return `
                <tr>
                    <td>${details[1].split(': ')[1]}</td>
                    <td>${details[2].split(': ')[1]}</td>
                    <td>${details[3].split(': ')[1]}</td>
                    <td>${details[4].split(': ')[1]}</td>
                    <td>${details[5].split(': ')[1]}</td>
                    <td>${totalPrice.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        fs.readFile(path.join(__dirname, 'templates', 'receipt.html'), 'utf8', (err, template) => {
            if (err) {
                console.error('Failed to read receipt template:', err);
                return res.status(500).send('Failed to generate invoice');
            }

            const receiptHtml = template.replace('<!-- Data rows will be inserted here dynamically -->', receiptRows);
            const finalReceiptHtml = receiptHtml.replace('<span id="totalAmount"></span>', overallTotalAmount.toFixed(2));

            res.send(finalReceiptHtml);
        });
    });
});


// Function to get food price
function getPrice(foodItem) {
    switch (foodItem) {
        case 'sandwich':
            return 4.50;
        case 'chickenburger':
            return 6.00;
        case '7Days Vanilla Croissant':
        case '7Days Chocolate Croissant':
            return 1.00;
        case 'nasilemak':
        case 'chickenrice':
            return 3.00;
        default:
            return 0;
    }
}


// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
