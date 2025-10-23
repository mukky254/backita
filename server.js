const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware - Enable CORS for all origins during development
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukky254:muhidinaliko2006@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'my-super-secret-key-12345';

console.log('🔧 Starting Kazi Mashinani Backend...');
console.log('📊 MongoDB URI:', MONGO_URI ? 'Configured' : 'Missing');

// MongoDB Connection with better error handling
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ MongoDB connected successfully to kaziDB');
    console.log('📁 Collections:', Object.keys(mongoose.connection.collections));
})
.catch(err => {
    console.log('❌ MongoDB connection error:', err.message);
});

// User Schema
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

// Job Schema
const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, default: 'general' },
    phone: { type: String, required: true },
    whatsapp: { type: String, default: '' },
    businessType: { type: String, default: 'Individual' },
    employerId: { type: String, required: true },
    employerName: { type: String, required: true },
    postedDate: { type: Date, default: Date.now },
    status: { type: String, default: 'active' }
});

const Job = mongoose.model('Job', jobSchema);

// Application Schema (for tracking job applications)
const applicationSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeName: { type: String, required: true },
    employeePhone: { type: String, required: true },
    appliedDate: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' }
});

const Application = mongoose.model('Application', applicationSchema);

// ========== ROUTES ==========

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: '🚀 Kazi Mashinani API is running!', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        databaseName: 'kaziDB',
        collections: ['users', 'jobs', 'applications']
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: '✅ Server is healthy', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Test database connection
app.get('/test-db', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const jobCount = await Job.countDocuments();
        const applicationCount = await Application.countDocuments();
        
        res.json({
            success: true,
            database: 'Connected',
            collections: {
                users: userCount,
                jobs: jobCount,
                applications: applicationCount
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ========== AUTH ROUTES ==========

// Check if phone exists
app.post('/auth/check-phone', async (req, res) => {
    try {
        const { phone } = req.body;
        const cleanPhone = phone.replace(/\D/g, '');
        
        const existingUser = await User.findOne({ phone: cleanPhone });
        res.json({ exists: !!existingUser });
    } catch (error) {
        console.error('Check phone error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Sign up
app.post('/auth/signup', async (req, res) => {
    try {
        const { name, phone, location, password, role, specialization, jobType } = req.body;
        
        console.log('📝 Signup attempt:', { name, phone: phone?.substring(0, 6) + '...', location, role });
        
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
            specialization: role === 'employee' ? (specialization || '') : '',
            jobType: role === 'employer' ? (jobType || '') : ''
        });

        await user.save();
        console.log('✅ New user created:', user.name);

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
        console.error('❌ Signup error:', error);
        res.status(500).json({ success: false, error: 'Server error during registration' });
    }
});

// Sign in
app.post('/auth/signin', async (req, res) => {
    try {
        const { phone, password } = req.body;
        
        console.log('🔐 Signin attempt:', { phone: phone?.substring(0, 6) + '...' });
        
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

        console.log('✅ User signed in:', user.name);

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
        console.error('❌ Signin error:', error);
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

// ========== JOB ROUTES ==========

// Get all jobs
app.get('/jobs', async (req, res) => {
    try {
        const jobs = await Job.find({ status: 'active' })
            .sort({ postedDate: -1 })
            .limit(50);
        
        console.log(`📋 Sent ${jobs.length} jobs to client`);
        res.json({ success: true, jobs });
    } catch (error) {
        console.error('❌ Get jobs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
    }
});

// Post a job
app.post('/jobs', async (req, res) => {
    try {
        const { title, description, location, category, phone, whatsapp, businessType, employerId, employerName } = req.body;
        
        console.log('📮 New job posting:', { title, location, employerName });
        
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
        console.log('✅ Job posted successfully:', job.title);

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
        console.error('❌ Post job error:', error);
        res.status(500).json({ success: false, error: 'Failed to post job' });
    }
});

// ========== EMPLOYEE ROUTES ==========

// Get all employees
app.get('/employees', async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' })
            .select('-password')
            .sort({ joinDate: -1 })
            .limit(50);
        
        console.log(`👥 Sent ${employees.length} employees to client`);
        res.json({ success: true, employees });
    } catch (error) {
        console.error('❌ Get employees error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch employees' });
    }
});

// ========== APPLICATION ROUTES ==========

// Submit job application
app.post('/applications', async (req, res) => {
    try {
        const { jobId, employeeId, employeeName, employeePhone } = req.body;
        
        const application = new Application({
            jobId,
            employeeId,
            employeeName,
            employeePhone
        });

        await application.save();
        console.log('✅ Application submitted by:', employeeName);

        res.json({ success: true, application });
    } catch (error) {
        console.error('❌ Application error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit application' });
    }
});

// Get applications for a job
app.get('/applications/job/:jobId', async (req, res) => {
    try {
        const applications = await Application.find({ jobId: req.params.jobId })
            .sort({ appliedDate: -1 });
        
        res.json({ success: true, applications });
    } catch (error) {
        console.error('❌ Get applications error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch applications' });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Main endpoint: http://localhost:${PORT}/`);
    console.log(`🔗 Test DB: http://localhost:${PORT}/test-db`);
});
