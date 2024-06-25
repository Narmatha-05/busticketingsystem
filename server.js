const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Import UUID module for unique IDs
const app = express();
const port = 3001;

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
    try {
        // Attempt to parse the data as JSON
        return JSON.parse(data);
    } catch (error) {
        // Handle JSON parsing errors
        console.error('Error parsing JSON data:', error);
        // Return an empty array if parsing fails
        return [];
    }
}


// Serve HTML files from the 'templates' folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'login.html'));
});

// Signup endpoint
app.post('/submit_form', (req, res) => {
    const { action, name, email, password } = req.body;

    fs.readFile(dataFilePath, 'utf8', (err, fileData) => {
        if (err) {
            console.error(`Error reading file: ${dataFilePath}`, err);
            return res.status(500).send('Internal Server Error: Unable to read data file.');
        }

        let jsonData = sanitizeJSON(fileData);

        if (action === 'signup') {
            const existingUser = jsonData.find(user => user.email === email);
            if (existingUser) {
                return res.status(400).send('User already exists.');
            }

            const newUser = { name, email, password };
            jsonData.push(newUser);
            fs.writeFile(dataFilePath, JSON.stringify(jsonData), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                    return res.status(500).send('Internal Server Error: Unable to write data file.');
                }

                res.status(200).json({ message: 'Sign-up successful!' });
            });
        } else if (action === 'login') {
            const user = jsonData.find(user => user.email === email && user.password === password);
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

        let jsonData = sanitizeJSON(fileData);
        const userIndex = jsonData.findIndex(user => user.email === updatedUser.email);

        if (userIndex !== -1) {
            jsonData[userIndex] = updatedUser;
            fs.writeFile(dataFilePath, JSON.stringify(jsonData), 'utf8', (err) => {
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

app.get('/getBookingHistory', (req, res) => {
    const email = req.query.email;

    fs.readFile('data.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read data file:', err);
            return res.status(500).send('Failed to read data file');
        }

        const bookings = data.split('\n').map(line => {
            const booking = {};
            line.split(', ').forEach(item => {
                const [key, value] = item.split(': ');
                booking[key] = value;
            });
            return booking;
        }).filter(booking => booking.Email === email); // Assuming each booking includes the user's email

        res.status(200).json(bookings);
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
    fs.readFile('data.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read selected seats:', err);
            return res.status(500).send('Failed to read selected seats');
        }
    
        const lines = data.split('\n');
        const bookedSeats = [];
    
        lines.forEach(line => {
            console.log('Processing line:', line); // Add this line for debugging
            if (!line.trim()) return; // Skip empty lines
            const parts = line.split(', ');
        
            const recordBusNumberPart = parts.find(part => part.startsWith('Bus Number:'));
            const recordDatePart = parts.find(part => part.startsWith('Date:'));
            const recordSeatPart = parts.find(part => part.startsWith('Seat:'));
        
            if (!recordBusNumberPart || !recordDatePart || !recordSeatPart) {
                console.log('Malformed line:', line); // Add this line for debugging
                return; // Skip malformed lines
            }
        
            const recordBusNumber = recordBusNumberPart.split(': ')[1];
            const recordDate = recordDatePart.split(': ')[1];
            const recordSeat = recordSeatPart.split(': ')[1];
        
            if (recordBusNumber === busNumber && recordDate === date) {
                bookedSeats.push(recordSeat);
            }
        });
    });    
        
    });
    
// Example to save booking data per session/user
app.post('/saveSeats', (req, res) => {
    const { selectedSeats, busNumber, date, userEmail } = req.body;
    const batchId = uuidv4(); // Unique identifier for this batch of seat selection

    // Example data structure for storing bookings
    const bookingData = {
        batchId: batchId,
        busNumber: busNumber,
        date: date,
        userEmail: userEmail,
        seats: selectedSeats
    };

    // Append booking data to a JSON file or database
    fs.appendFile('data.txt', JSON.stringify(bookingData) + '\n', (err) => {
        if (err) {
            console.error('Failed to save selected seats:', err);
            return res.status(500).send('Failed to save selected seats');
        }
        res.status(200).json({ redirectUrl: `/passenger_details?seats=${encodeURIComponent(JSON.stringify(selectedSeats))}` });
    });
});

// Example to retrieve booking history by email
app.get('/getBookingHistory', (req, res) => {
    const email = req.query.email;

    // Read bookings from a JSON file or database
    fs.readFile('data.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read booking data:', err);
            return res.status(500).send('Failed to read booking data');
        }

        const bookings = data.split('\n').map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                return null;
            }
        }).filter(booking => booking && booking.userEmail === email);

        res.status(200).json(bookings);
    });
});



// Serve passenger details page
app.get('/passenger_details', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'passenger_details.html'));
    });
    
    app.post('/savePassengerDetails', (req, res) => {
    const passengerDetails = req.body.passengers;
    const batchId = uuidv4(); // Unique identifier for this batch of passenger details
    latestBatchId = batchId; // Update the latest batch ID
    
    let overallTotalAmount = 0;
    
    const data = passengerDetails.map(passenger => {
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
    
    fs.appendFile('data.txt', data, (err) => {
        if (err) {
            console.error('Failed to save passenger details:', err);
            return res.status(500).send('Failed to save passenger details');
        }
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

app.get('/receipt', (req, res) => {
    fs.readFile('data.txt', 'utf8', (err, data) => {
    if (err) {
    console.error('Failed to read passenger details:', err);
    return res.status(500).send('Failed to generate invoice');
    }
    
        const passengers = data.split('\n').filter(line => line.trim() !== '');
    
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
                    <td>${details[4].split(': ')[1]}</td>node ser
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