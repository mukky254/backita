const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: ['https://kazi-ocha-frontend-887d.vercel.app', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://mukky254:muhidinaliko2006@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.log('MongoDB connection error:', err));

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
    category: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String, default: '' },
    businessType: { type: String, default: 'Individual' },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employerName: { type: String, required: true },
    postedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
});

const Job = mongoose.model('Job', jobSchema);

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'my-super-secret-key-12345', (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Health check
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Kazi Mashinani API is running!', 
        timestamp: new Date().toISOString() 
    });
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
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Sign up
app.post('/auth/signup', async (req, res) => {
    try {
        const { name, phone, location, password, role, specialization, jobType } = req.body;
        
        console.log('Signup attempt:', { name, phone, location, role });
        
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
            process.env.JWT_SECRET || 'my-super-secret-key-12345',
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
        
        console.log('Signin attempt:', { phone });
        
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
            process.env.JWT_SECRET || 'my-super-secret-key-12345',
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

// Update profile
app.put('/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { name, location, specialization, jobType } = req.body;
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.name = name || user.name;
        user.location = location || user.location;
        
        if (user.role === 'employee') {
            user.specialization = specialization || user.specialization;
        } else {
            user.jobType = jobType || user.jobType;
        }

        await user.save();

        res.json({
            success: true,
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
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Change password
app.put('/auth/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current and new password are required' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }

        // Hash new password
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Get all jobs
app.get('/jobs', async (req, res) => {
    try {
        const jobs = await Job.find({ status: 'active' })
            .sort({ postedDate: -1 })
            .limit(50);
        
        res.json({ success: true, jobs });
    } catch (error) {
        console.error('Get jobs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
    }
});

// Post a job
app.post('/jobs', authenticateToken, async (req, res) => {
    try {
        const { title, description, location, category, phone, whatsapp, businessType } = req.body;
        
        if (!title || !description || !location || !phone) {
            return res.status(400).json({ success: false, error: 'Required fields missing' });
        }

        const user = await User.findById(req.user.userId);
        if (!user || user.role !== 'employer') {
            return res.status(403).json({ success: false, error: 'Only employers can post jobs' });
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
            employerId: user._id,
            employerName: user.name
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

// Update job
app.put('/jobs/:id', authenticateToken, async (req, res) => {
    try {
        const { title, description, location, category } = req.body;
        const jobId = req.params.id;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }

        // Check if user owns the job
        if (job.employerId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this job' });
        }

        job.title = title || job.title;
        job.description = description || job.description;
        job.location = location || job.location;
        job.category = category || job.category;

        await job.save();

        res.json({ success: true, job });

    } catch (error) {
        console.error('Update job error:', error);
        res.status(500).json({ success: false, error: 'Failed to update job' });
    }
});

// Delete job
app.delete('/jobs/:id', authenticateToken, async (req, res) => {
    try {
        const jobId = req.params.id;

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }

        // Check if user owns the job
        if (job.employerId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this job' });
        }

        await Job.findByIdAndDelete(jobId);

        res.json({ success: true, message: 'Job deleted successfully' });

    } catch (error) {
        console.error('Delete job error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete job' });
    }
});

// Get all employees (users with role 'employee')
app.get('/employees', async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' })
            .select('-password')
            .sort({ joinDate: -1 })
            .limit(50);
        
        res.json({ success: true, employees });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch employees' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running', 
        timestamp: new Date().toISOString() 
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
