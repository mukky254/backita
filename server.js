const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables with fallbacks
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukky254:muhidinaliko2006@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-key-12345';

console.log('Starting server with configuration:', {
  PORT,
  MONGO_URI: MONGO_URI ? 'Mongo URI is set' : 'Mongo URI is missing',
  JWT_SECRET: JWT_SECRET ? 'JWT Secret is set' : 'JWT Secret is missing'
});

// MongoDB Connection
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
    console.log('❌ MongoDB connection error:', err);
    console.log('💡 Please check your MongoDB connection string');
});

// Simple User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    location: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['employee', 'employer'], required: true },
    specialization: { type: String, default: '' },
    jobType: { type: String, default: '' },
    joinDate: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Simple Job Schema
const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String, default: '' },
    businessType: { type: String, default: 'Individual' },
    employerId: { type: String, required: true },
    employerName: { type: String, required: true },
    postedDate: { type: Date, default: Date.now },
    status: { type: String, default: 'active' }
});

const Job = mongoose.model('Job', jobSchema);

// Test route
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: '🚀 Kazi Mashinani API is running!', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is healthy ✅', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Get all jobs
app.get('/jobs', async (req, res) => {
    try {
        const jobs = await Job.find({ status: 'active' }).sort({ postedDate: -1 });
        res.json({ success: true, jobs });
    } catch (error) {
        console.error('Get jobs error:', error);
        res.json({ success: true, jobs: [] }); // Return empty array instead of error
    }
});

// Get all employees
app.get('/employees', async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' }).select('-password');
        res.json({ success: true, employees });
    } catch (error) {
        console.error('Get employees error:', error);
        res.json({ success: true, employees: [] }); // Return empty array instead of error
    }
});

// Sign up
app.post('/auth/signup', async (req, res) => {
    try {
        const { name, phone, location, password, role, specialization, jobType } = req.body;
        
        console.log('Signup attempt:', { name, phone: phone.substring(0, 6) + '...', location, role });
        
        // Validate required fields
        if (!name || !phone || !location || !password || !role) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        
        // Check if user already exists
        const existingUser = await User.findOne({ phone: cleanPhone });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'User already exists with this phone number' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            name,
            phone: cleanPhone,
            location,
            password: hashedPassword,
            role,
            specialization: role === 'employee' ? specialization : '',
            jobType: role === 'employer' ? jobType : ''
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id, phone: user.phone, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                location: user.location,
                role: user.role,
                specialization: user.specialization,
                jobType: user.jobType,
                joinDate: user.joinDate,
                lastLogin: user.lastLogin
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, error: 'Server error during registration' });
    }
});

// Sign in
app.post('/auth/signin', async (req, res) => {
    try {
        const { phone, password } = req.body;
        
        console.log('Signin attempt:', { phone: phone.substring(0, 6) + '...' });
        
        if (!phone || !password) {
            return res.status(400).json({ success: false, error: 'Phone and password are required' });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        
        // Find user
        const user = await User.findOne({ phone: cleanPhone });
        if (!user) {
            return res.status(400).json({ success: false, error: 'User not found' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ success: false, error: 'Invalid password' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id, phone: user.phone, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                location: user.location,
                role: user.role,
                specialization: user.specialization,
                jobType: user.jobType,
                joinDate: user.joinDate,
                lastLogin: user.lastLogin
            }
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

// Check if phone exists
app.post('/auth/check-phone', async (req, res) => {
    try {
        const { phone } = req.body;
        const cleanPhone = phone.replace(/\D/g, '');
        
        const existingUser = await User.findOne({ phone: cleanPhone });
        res.json({ exists: !!existingUser });
    } catch (error) {
        console.error('Check phone error:', error);
        res.json({ exists: false });
    }
});

// Post a job
app.post('/jobs', async (req, res) => {
    try {
        const { title, description, location, category, phone, whatsapp, businessType, employerId, employerName } = req.body;
        
        if (!title || !description || !location || !phone) {
            return res.status(400).json({ success: false, error: 'Required fields missing' });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const cleanWhatsapp = whatsapp ? whatsapp.replace(/\D/g, '') : '';

        const job = new Job({
            title,
            description,
            location,
            category: category || 'general',
            phone: cleanPhone,
            whatsapp: cleanWhatsapp,
            businessType: businessType || 'Individual',
            employerId: employerId || 'demo-user',
            employerName: employerName || 'Demo Employer'
        });

        await job.save();

        res.json({
            success: true,
            job: {
                _id: job._id,
                title: job.title,
                description: job.description,
                location: job.location,
                category: job.category,
                phone: job.phone,
                whatsapp: job.whatsapp,
                businessType: job.businessType,
                employerId: job.employerId,
                employerName: job.employerName,
                postedDate: job.postedDate
            }
        });

    } catch (error) {
        console.error('Post job error:', error);
        res.status(500).json({ success: false, error: 'Failed to post job' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🎯 Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Main endpoint: http://localhost:${PORT}/`);
});
