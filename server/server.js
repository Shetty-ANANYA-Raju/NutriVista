// File: server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Required for frontend communication
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For user authentication
const path = require('path'); // Core Node.js module for path handling

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb://localhost:27017/nutrivista'; // Replace with your MongoDB URI
const JWT_SECRET = 'your_super_secret_jwt_key'; // Use a strong, random key in production

// Import simplified food data
const foodData = require('./fooddata');

// Middleware
app.use(express.json()); // Allows parsing of JSON request bodies
app.use(cors()); // Enable CORS for frontend requests

// Serve static files from the 'public' directory
// This is the updated line to correctly serve the front-end files.
app.use(express.static(path.join(__dirname, '..', 'public')));


// MongoDB Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas & Models ---
// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    dailyCalorieGoal: { type: Number, default: 2000 },
    dailyProteinGoal: { type: Number, default: 150 },
    dailyCarbGoal: { type: Number, default: 200 },
    dailyFatGoal: { type: Number, default: 70 }
});

// Hash the password before saving the user
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model('User', UserSchema);

// Food Log Schema
const FoodLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    foodItem: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, default: "piece" },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    logDate: { type: Date, default: Date.now },
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'], default: 'snack' }
});

const FoodLog = mongoose.model('FoodLog', FoodLogSchema);

// Doctor Schema - New for this section
const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    bio: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviews: [{ userId: String, comment: String, rating: Number }],
    fee: { type: Number, default: 500 },
    imageUrl: { type: String, required: true }
});

const Doctor = mongoose.model('Doctor', DoctorSchema);

// Appointment Schema - New for this section
const AppointmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['scheduled', 'completed', 'canceled'], default: 'scheduled' }
});

const Appointment = mongoose.model('Appointment', AppointmentSchema);

// --- Authentication Middleware ---
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (e) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

// --- Seed Doctor Data (for demonstration) ---
async function seedDoctors() {
    await Doctor.deleteMany({}); // Clear existing doctors
    const doctors = [
        { name: "Dr. Anjali Sharma", specialization: "Dietitian", bio: "A seasoned dietitian with over 10 years of experience, specializing in personalized meal plans for weight management and chronic diseases.", rating: 4.8, fee: 800, imageUrl: "https://placehold.co/150x150/d1d5db/4b5563?text=Dr.AS" },
        { name: "Dr. Rahul Verma", specialization: "Nutritionist", bio: "Focuses on holistic nutrition and lifestyle changes to improve overall well-being and performance.", rating: 4.5, fee: 750, imageUrl: "https://placehold.co/150x150/d1d5db/4b5563?text=Dr.RV" },
        { name: "Dr. Priya Singh", specialization: "Dermatologist", bio: "Expert in skincare and haircare, providing evidence-based solutions for common conditions.", rating: 4.9, fee: 1200, imageUrl: "https://placehold.co/150x150/d1d5db/4b5563?text=Dr.PS" }
    ];
    await Doctor.insertMany(doctors);
    console.log('Doctors seeded successfully.');
}
seedDoctors(); // Call the function to seed the data on server start

// --- API Endpoints ---
// User registration, login, profile, and foodlog remain the same
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ msg: 'User already exists' });
        user = new User({ username, password });
        await user.save();
        const payload = { user: { id: user.id } };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, username: user.username } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });
        const payload = { user: { id: user.id } };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, username: user.username } });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/foodlog', auth, async (req, res) => {
    const { text } = req.body;
    let quantity = 1;
    const foundFood = foodData.find(food => text.toLowerCase().includes(food.name));

    if (foundFood) {
        const quantityMatch = text.match(/\d+/);
        if (quantityMatch) quantity = parseInt(quantityMatch[0], 10);
        const newFoodLog = new FoodLog({
            userId: req.user.id,
            foodItem: foundFood.name,
            quantity: quantity,
            calories: foundFood.calories * quantity,
            protein: foundFood.protein * quantity,
            carbs: foundFood.carbs * quantity,
            fat: foundFood.fat * quantity
        });
        await newFoodLog.save();
        return res.json(newFoodLog);
    }
    res.status(400).json({ msg: 'Food item not recognized' });
});

app.get('/api/foodlog/summary', auth, async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const summary = await FoodLog.aggregate([
            { $match: { userId: mongoose.Types.ObjectId(req.user.id), logDate: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: {
                _id: null,
                totalCalories: { $sum: '$calories' },
                totalProtein: { $sum: '$protein' },
                totalCarbs: { $sum: '$carbs' },
                totalFat: { $sum: '$fat' }
            }}
        ]);
        res.json(summary[0] || { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/doctors
// @desc    Get all doctors
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find({});
        res.json(doctors);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/appointments
// @desc    Book a new appointment
app.post('/api/appointments', auth, async (req, res) => {
    const { doctorId, date, reason } = req.body;
    try {
        const newAppointment = new Appointment({
            userId: req.user.id,
            doctorId,
            date,
            reason
        });
        await newAppointment.save();
        res.json(newAppointment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/appointments/user
// @desc    Get all appointments for the logged-in user
app.get('/api/appointments/user', auth, async (req, res) => {
    try {
        const appointments = await Appointment.find({ userId: req.user.id }).populate('doctorId', 'name specialization');
        res.json(appointments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
